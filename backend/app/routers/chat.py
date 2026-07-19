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
    reply = answer(db, user, payload.message)
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
    limit: int = 50,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[ChatMessage]:
    rows = (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == user.id)
        .order_by(ChatMessage.id.desc())
        .limit(min(limit, 200))
        .all()
    )
    return list(reversed(rows))


@router.delete("/history", status_code=status.HTTP_204_NO_CONTENT)
def clear_history(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    db.query(ChatMessage).filter(ChatMessage.user_id == user.id).delete()
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
