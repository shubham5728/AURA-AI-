from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import ChatMessage, User
from app.services.agents.orchestrator import answer
from app.services.agents.roles import ROLES

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    # Which conversation thread this message belongs to. Omitted means the
    # legacy thread (messages written before threads existed).
    conversation_id: Optional[str] = Field(default=None, max_length=64)


class ChatOut(BaseModel):
    reply: str
    role_key: str
    role_label: str
    routing_method: str
    routing_confidence: str
    emergency: bool
    context_sections: List[str]
    warnings: List[str]
    # How the reply was produced -- stages, real timings, and the exact
    # de-identified context sent. Returned so the pipeline can be inspected
    # while it is used, not only described.
    trace: dict = {}


class ChatTurnOut(BaseModel):
    role: str
    content: str
    agent_role: Optional[str]


@router.post("", response_model=ChatOut)
def send_message(
    payload: ChatIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatOut:
    """Send a message and get the specialist's reply.

    `role_label` is returned so the interface can show which specialist handled
    the question. That is what makes the multi-agent design visible rather than
    merely claimed.
    """
    reply = answer(db, user, payload.message, conversation_id=payload.conversation_id)
    return ChatOut(
        reply=reply.text,
        role_key=reply.role_key,
        role_label=reply.role_label,
        routing_method=reply.routing_method,
        routing_confidence=reply.routing_confidence,
        emergency=reply.emergency,
        context_sections=reply.context_sections,
        warnings=reply.warnings,
        trace=reply.trace,
    )


@router.get("/history", response_model=List[ChatTurnOut])
def history(
    conversation_id: Optional[str] = None,
    limit: int = 50,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[ChatMessage]:
    # Scoped to one thread. A missing id returns the legacy thread (rows whose
    # conversation_id is NULL), which is what pre-thread history reads as.
    rows = (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == user.id)
        .filter(ChatMessage.conversation_id == conversation_id)
        .order_by(ChatMessage.id.desc())
        .limit(min(limit, 200))
        .all()
    )
    return list(reversed(rows))


class ConversationOut(BaseModel):
    """A chat thread, summarised for the list of past conversations."""

    conversation_id: Optional[str]
    title: str
    updated_at: datetime
    message_count: int


@router.get("/conversations", response_model=List[ConversationOut])
def list_conversations(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[ConversationOut]:
    """Every thread this user has, newest first, titled by its first message."""
    rows = (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == user.id)
        .order_by(ChatMessage.id.asc())
        .all()
    )

    threads: dict = {}
    for row in rows:
        cid = row.conversation_id
        thread = threads.get(cid)
        if thread is None:
            thread = {"conversation_id": cid, "title": None, "updated_at": row.created_at, "message_count": 0}
            threads[cid] = thread
        thread["message_count"] += 1
        thread["updated_at"] = row.created_at  # rows are ascending, so this ends on the latest
        # Title from the first thing the user said; assistant-only threads fall back below.
        if thread["title"] is None and row.role == "user":
            thread["title"] = row.content[:60]

    out = [
        ConversationOut(
            conversation_id=t["conversation_id"],
            title=t["title"] or "New conversation",
            updated_at=t["updated_at"],
            message_count=t["message_count"],
        )
        for t in threads.values()
    ]
    out.sort(key=lambda c: c.updated_at, reverse=True)
    return out


@router.delete("/history", status_code=status.HTTP_204_NO_CONTENT)
def clear_history(
    conversation_id: Optional[str] = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    # With a conversation_id, deletes just that thread; without one, clears the
    # legacy thread. Kept null-scoped so a stray call cannot wipe every thread.
    (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == user.id)
        .filter(ChatMessage.conversation_id == conversation_id)
        .delete()
    )
    db.commit()


@router.get("/roles")
def list_roles() -> List[dict]:
    """The specialist roles available. Unauthenticated -- no user data.

    `reads` exposes each role's context slice. It is what makes the
    specialisation inspectable rather than asserted: the Fitness role genuinely
    never receives the medication list, and this is where anyone can check that.
    """
    return [
        {
            "key": role.key,
            "label": role.label,
            "description": role.description,
            "reads": role.context_needs,
        }
        for role in ROLES.values()
    ]
