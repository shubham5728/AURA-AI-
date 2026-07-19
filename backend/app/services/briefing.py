"""The daily briefing shown at the top of the overview.

Two layers, in a deliberate order.

The **facts** are computed: the score, what moved it, what has not been
assessed, and what is worth doing next. These are derived from the same
`calculate_score` the dashboard shows, so the narrative can never disagree with
the number beside it.

The **narration** is optional. A model is asked to write those facts as prose,
and is given no numbers to work out for itself. If it is unavailable, out of
quota, or writes something that fails the checks, the computed text is shown
instead -- and the response says which it was, rather than passing a fallback
off as generated insight.

A briefing that invents a figure on the first screen of a health app would
undo every other guarantee in the product, so generation is the part that is
allowed to fail.
"""

import logging
from dataclasses import dataclass
from datetime import date
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models import DailyBriefing, User
from app.services.agents import safety
from app.services.agents.llm import LLMClient, LLMError, get_llm
from app.services.scoring import ScoreResult, calculate_score
from app.twin import build_health_state

logger = logging.getLogger(__name__)

MAX_WORDS = 90

PROMPT = """Write a short morning health briefing for someone using a health app.

Facts you may use, and nothing else:
{facts}

Rules:
- Under 70 words, two or three sentences.
- Warm and direct. No greeting, no sign-off, no bullet points.
- Use only the figures listed above. Do not calculate, estimate or add any number.
- Do not diagnose and do not tell them to change any medication.
- If something has not been assessed, say it is not known rather than assuming it is fine.
"""


@dataclass
class Briefing:
    text: str
    source: str  # "model" | "computed"
    score: Optional[int]
    actions: List[str]

    def as_dict(self) -> dict:
        return {
            "text": self.text,
            "source": self.source,
            "score": self.score,
            "actions": self.actions,
        }


def _facts(result: ScoreResult, unassessed: List[str]) -> str:
    lines: List[str] = []

    if result.score is None:
        lines.append("No health score yet: not enough data has been recorded.")
    else:
        lines.append(f"Health score: {result.score} out of 100.")
        lines.append(f"Summary: {result.summary}")

    for deduction in result.deductions[:3]:
        lines.append(f"Costing {deduction.points:g} points: {deduction.reason}")

    if unassessed:
        lines.append("Not assessed at all: " + ", ".join(unassessed) + ".")

    return "\n".join(f"- {line}" for line in lines)


def _computed_text(result: ScoreResult, unassessed: List[str]) -> str:
    """The briefing when no model writes it.

    Deliberately plain. It states the score, the largest factor, and what has
    not been looked at -- which is the same information, without the prose.
    """
    if result.score is None:
        return (
            "There is not enough data to assess your health yet. Add your profile, "
            "upload a report, or log a day, and a score will appear here."
        )

    parts = [f"Your health score is {result.score} out of 100. {result.summary}"]

    # The summary already names the largest area ("the largest single factor is
    # daily activity"), so repeating that framing produced the same sentence
    # twice. What it does not carry is the measurement, which is the part worth
    # adding.
    if result.deductions:
        biggest = result.deductions[0]
        detail = biggest.evidence or biggest.reason
        parts.append(detail if detail.endswith('.') else f"{detail}.")

    if unassessed:
        # Said out loud, because a high score built on one measurement reads as
        # a clean bill of health when it is nothing of the kind.
        parts.append(
            "Not yet assessed: " + ", ".join(unassessed) +
            ". Your score only reflects what has been recorded."
        )

    return " ".join(parts)


def _actions(result: ScoreResult, unassessed: List[str]) -> List[str]:
    """What to do next, derived from the score rather than written by hand.

    The overview previously listed three fixed instructions -- drink water, walk,
    sleep early -- shown identically to everyone regardless of their data.
    """
    actions: List[str] = []

    for deduction in result.deductions[:3]:
        if deduction.category == "hydration":
            actions.append("Drink more water today")
        elif deduction.category == "activity":
            actions.append("Add a short walk to your day")
        elif deduction.category == "sleep":
            actions.append("Aim for an earlier night")
        elif deduction.category == "labs":
            actions.append(f"Ask your doctor about {deduction.reason.split(':')[0]}")
        elif deduction.category == "medication":
            actions.append("Raise the medication interaction with your doctor")
        elif deduction.category == "body":
            actions.append("Discuss a realistic weight target with your doctor")

    if "lab results" in unassessed:
        actions.append("Upload a lab report so results can be read")
    if "daily activity" in unassessed:
        actions.append("Log a day to start tracking sleep and steps")

    # Three is what fits on the card and what a person will actually do.
    return actions[:3]


def _unassessed(result: ScoreResult) -> List[str]:
    friendly = {
        "labs": "lab results",
        "sleep": "sleep",
        "activity": "daily activity",
        "body": "height and weight",
        "hydration": "hydration",
        "medication": "medications",
    }
    return [friendly[key] for key, covered in result.coverage.items() if not covered]


def _generate(llm: LLMClient, facts: str, allowed: List[float]) -> Optional[str]:
    """Ask a model to narrate the facts. Returns None if it cannot be trusted."""
    try:
        text = llm.generate_text(PROMPT.format(facts=facts)).strip()
    except LLMError as exc:
        logger.info("Briefing generation unavailable: %s", exc)
        return None
    except Exception:
        logger.exception("Briefing generation failed")
        return None

    if not text or len(text.split()) > MAX_WORDS:
        logger.info("Briefing rejected: empty or too long")
        return None

    # The same check the chat replies get. A briefing is the first thing seen
    # each day, so an invented figure here is the most damaging place for one.
    invented = safety.find_unsupported_numbers(text, allowed)
    if invented:
        logger.warning("Briefing rejected, cites figures not in the facts: %s", invented[:4])
        return None

    if safety.screen_output(text):
        logger.warning("Briefing rejected by output screening")
        return None

    return text


def build(db: Session, user: User, llm: Optional[LLMClient] = None) -> Briefing:
    """Today's briefing, generated at most once per day per user."""
    state = build_health_state(db, user)
    result = calculate_score(state)
    unassessed = _unassessed(result)
    actions = _actions(result, unassessed)

    today = date.today()
    cached = (
        db.query(DailyBriefing)
        .filter(DailyBriefing.user_id == user.id, DailyBriefing.date == today)
        .first()
    )

    # Reused only while it still describes the current state. Uploading a report
    # at noon changes the score, and yesterday's sentence about it would then be
    # wrong rather than merely old.
    if cached and cached.score_at_generation == result.score:
        return Briefing(cached.text, cached.source, result.score, actions)

    computed = _computed_text(result, unassessed)

    # With no score there is nothing to narrate, and a model asked to write a
    # briefing anyway will fill the gap: given an empty account it produced
    # "your score is steady today", which is not merely wrong but reassuring
    # about a state that has never been measured. Generation is skipped
    # entirely rather than relying on the output checks to catch it.
    if result.score is None:
        text, source = computed, "computed"
    else:
        allowed = [float(result.score)] + [float(d.points) for d in result.deductions]
        generated = _generate(llm or get_llm(), _facts(result, unassessed), allowed)
        text = generated or computed
        source = "model" if generated else "computed"

    if cached:
        cached.text = text
        cached.source = source
        cached.score_at_generation = result.score
    else:
        db.add(
            DailyBriefing(
                user_id=user.id,
                date=today,
                text=text,
                source=source,
                score_at_generation=result.score,
            )
        )
    db.commit()

    return Briefing(text, source, result.score, actions)
