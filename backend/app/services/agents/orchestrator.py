"""The Digital Twin Core.

The single layer that turns a user message into an answer. It owns the order of
operations, and the order is the design:

1. Screen the input. Emergencies never reach the model.
2. Route to a specialist role.
3. Assemble only that role's slice of context.
4. Generate.
5. Screen the output, as a backup to the system prompt.

Step 1 before step 4 is the whole point. Filtering a generated reply means the
unsafe text already existed and any gap in the filter ships it.
"""

import logging
from dataclasses import dataclass, field
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models import ChatMessage, User
from app.services.agents import safety
from app.services.agents.context import build_context
from app.services.agents.llm import LLMClient, LLMError, get_llm
from app.services.agents.roles import ROLES, Role
from app.services.agents.router import classify
from app.services.agents.trace import Timer

logger = logging.getLogger(__name__)

# Turns of prior conversation sent to the model. Enough for a follow-up like
# "what about the other one?" to resolve, short enough to keep the health data
# dominant in the context.
HISTORY_TURNS = 5

# The union of every role's context_needs. Lets the trace show what a role was
# denied, not only what it received -- the withheld list is the evidence that
# the slices are real.
ALL_SLICES = sorted({slice_ for role in ROLES.values() for slice_ in role.context_needs})

FAILURE_REPLY = (
    "I could not generate an answer just now. Please try again in a moment. "
    "If this keeps happening, your health data is still safe and viewable on "
    "your dashboard."
)


@dataclass
class AgentReply:
    text: str
    role_key: str
    role_label: str
    routing_method: str
    routing_confidence: str
    emergency: bool = False
    emergency_category: Optional[str] = None
    context_sections: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    # How the reply was produced: stages, timings, and the context sent.
    trace: dict = field(default_factory=dict)


def _load_history(db: Session, user_id: int) -> List[dict]:
    rows = (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == user_id)
        .order_by(ChatMessage.id.desc())
        .limit(HISTORY_TURNS * 2)
        .all()
    )
    return [{"role": row.role, "content": row.content} for row in reversed(rows)]


def _persist(db: Session, user_id: int, role: str, content: str, agent_role: Optional[str]) -> None:
    db.add(
        ChatMessage(
            user_id=user_id, role=role, content=content, agent_role=agent_role
        )
    )
    db.commit()


def answer(
    db: Session,
    user: User,
    message: str,
    llm: Optional[LLMClient] = None,
) -> AgentReply:
    """Produce a reply to one user message, recording how it was produced."""
    llm = llm or get_llm()
    timer = Timer()
    _persist(db, user.id, "user", message, None)

    with timer.stage("safety_in", "Safety screen") as stage:
        verdict = safety.screen_input(message)
        stage.detail = (
            f"Emergency detected: {verdict.category}"
            if verdict.blocked
            else "No emergency pattern matched"
        )
        stage.data = {"blocked": verdict.blocked, "category": verdict.category}

    if verdict.blocked:
        # Logged at warning level: an emergency interception is something a
        # human should be able to find in the logs afterwards.
        logger.warning(
            "Emergency intercepted for user=%s category=%s", user.id, verdict.category
        )
        _persist(db, user.id, "assistant", verdict.response, "emergency")
        trace = timer.finish()
        # The absence of later stages is the point: it shows the model was never
        # reached, rather than asking anyone to take that on trust.
        return AgentReply(
            text=verdict.response,
            role_key="emergency",
            role_label="Emergency",
            routing_method="safety",
            routing_confidence="high",
            emergency=True,
            emergency_category=verdict.category,
            trace=trace.as_dict(),
        )

    with timer.stage("routing", "Route to specialist") as stage:
        decision = classify(message, llm=llm)
        role: Role = decision.role
        stage.detail = (
            f"{role.label} — chosen by {decision.method}, {decision.confidence} confidence"
        )
        stage.data = {
            "chosen": role.key,
            "label": role.label,
            "method": decision.method,
            "confidence": decision.confidence,
            # Every role considered, so a close call is visible rather than
            # presented as an obvious one.
            "scores": decision.scores,
        }

    with timer.stage("context", "Assemble context") as stage:
        bundle = build_context(db, user, role.context_needs)
        stage.detail = (
            f"{len(bundle.sections)} slice(s), {len(bundle.text)} characters"
        )
        # Two different reasons a slice is absent, kept apart on purpose.
        #
        # `withheld` means the role is not permitted it -- that is the claim
        # this trace exists to evidence. `empty` means the role was allowed it
        # and the user simply has no such data yet. Reporting the second as the
        # first would overstate the guarantee: it would show the Nutrition role
        # being "denied" lab results it is entitled to read.
        allowed = set(role.context_needs)
        stage.data = {
            "sections": bundle.sections,
            "withheld": [n for n in ALL_SLICES if n not in allowed],
            "empty": [n for n in role.context_needs if n not in bundle.sections],
            "characters": len(bundle.text),
        }

    system = (
        f"{role.system_prompt()}\n\n"
        f"--- THIS USER'S DATA ---\n{bundle.text}\n--- END OF DATA ---\n\n"
        "Use only the data above. If the answer requires something not listed, "
        "say you do not have that information yet."
    )

    history = _load_history(db, user.id)[:-1]  # drop the message just persisted

    try:
        with timer.stage("generation", "Generate reply") as stage:
            text = llm.chat(system, history, message)
            stage.detail = f"{len(text)} characters returned"
            stage.data = {"history_turns": len(history)}
    except LLMError:
        # Not persisted: a failure is not part of the conversation, and storing
        # it would poison the history of every later turn.
        logger.exception("Generation failed for user=%s", user.id)
        trace = timer.finish()
        trace.context_sent = bundle.text
        return AgentReply(
            text=FAILURE_REPLY,
            role_key=role.key,
            role_label=role.label,
            routing_method=decision.method,
            routing_confidence=decision.confidence,
            warnings=["generation_failed"],
            trace=trace.as_dict(),
        )

    with timer.stage("safety_out", "Check the reply") as stage:
        warnings = safety.screen_output(text)
        fabricated = safety.find_unsupported_numbers(text, bundle.known_numbers)
        if fabricated:
            # Not blocked, only flagged. The check is deliberately loose, and
            # suppressing good answers over a false positive would cost more than
            # it saves -- but a real pattern here should be visible.
            warnings.append("unsupported_numbers")
            logger.info("Reply cites numbers not in context: %s", fabricated[:5])

        stage.detail = (
            "No diagnosis, no medication advice, every figure traced to your data"
            if not warnings
            else f"Flagged: {', '.join(warnings)}"
        )
        stage.data = {
            "warnings": warnings,
            "numbers_checked": len(bundle.known_numbers),
            "unsupported": fabricated[:5],
        }

    if warnings:
        logger.warning("Safety warnings for user=%s: %s", user.id, warnings)

    _persist(db, user.id, "assistant", text, role.key)

    trace = timer.finish()
    # The de-identified bytes the model received, returned so the user can see
    # exactly what left the server. This is the claim the product makes about
    # privacy, made checkable.
    trace.context_sent = bundle.text

    return AgentReply(
        text=text,
        role_key=role.key,
        role_label=role.label,
        routing_method=decision.method,
        routing_confidence=decision.confidence,
        context_sections=bundle.sections,
        warnings=warnings,
        trace=trace.as_dict(),
    )
