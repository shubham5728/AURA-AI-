"""Routing: which specialist role should answer this message.

A two-stage design. Keyword scoring runs first because it is free, instant, and
deterministic -- and it resolves the majority of real questions, which name what
they are about ("what should I eat", "my chest feels tight", "explain my LDL").
Only genuinely ambiguous messages fall through to a model call.

That ordering keeps the common path off the network. A router that costs an API
call per message doubles latency and adds a failure point in front of every
answer, which is a poor trade for accuracy on the minority of hard cases.
"""

import logging
import re
from dataclasses import dataclass
from typing import Dict, List, Optional

from app.services.agents.roles import DEFAULT_ROLE, ROLES, Role

logger = logging.getLogger(__name__)

# A single keyword hit is weak evidence; two agreeing hits is decent. Below this
# margin the top two roles are treated as tied.
DECISIVE_MARGIN = 1.0


@dataclass
class RoutingDecision:
    role: Role
    confidence: str  # "high" | "low"
    method: str  # "keywords" | "model" | "default"
    scores: Dict[str, float]


def score_roles(message: str) -> Dict[str, float]:
    """Score each role by keyword evidence in the message.

    Multi-word keywords score higher than single words. "what if" is a far
    stronger signal for the prediction role than "if" would be, and weighting by
    specificity is what stops common words from dominating.
    """
    text = f" {message.lower().strip()} "
    scores: Dict[str, float] = {key: 0.0 for key in ROLES}

    for key, role in ROLES.items():
        for keyword in role.keywords:
            # Word boundaries so "run" does not match "running nose". Plurals are
            # allowed because "two tablets together" is how the question is
            # actually asked, but no broader stemming -- prefix matching would
            # make "run" fire on "runny nose", which is a symptom, not exercise.
            if re.search(rf"\b{re.escape(keyword)}(?:s|es)?\b", text):
                scores[key] += 1.0 + 0.5 * keyword.count(" ")

    return scores


def _model_classify(message: str, llm) -> Optional[str]:
    """Ask the model to pick a role. Used only when keywords are inconclusive."""
    options = "\n".join(f"- {key}: {role.description}" for key, role in ROLES.items())
    prompt = (
        "Classify this health question into exactly one category.\n"
        f"{options}\n\n"
        f'Question: "{message}"\n\n'
        "Reply with the category key only, nothing else."
    )

    try:
        raw = (llm.generate_text(prompt) or "").strip().lower()
    except Exception as exc:
        logger.warning("Model routing failed, falling back: %s", exc)
        return None

    # Models occasionally answer "category: nutrition" instead of "nutrition".
    for key in ROLES:
        if re.search(rf"\b{key}\b", raw):
            return key

    logger.info("Model routing returned an unrecognised value: %r", raw)
    return None


def classify(message: str, llm=None) -> RoutingDecision:
    """Choose the role that should answer.

    Never raises. Routing failure must degrade to the general role rather than
    break the conversation -- a slightly mis-routed answer is recoverable, a
    failed request is not.
    """
    scores = score_roles(message)
    ranked: List[tuple] = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
    top_key, top_score = ranked[0]
    runner_up = ranked[1][1] if len(ranked) > 1 else 0.0

    if top_score > 0 and (top_score - runner_up) >= DECISIVE_MARGIN:
        return RoutingDecision(ROLES[top_key], "high", "keywords", scores)

    if llm is not None:
        chosen = _model_classify(message, llm)
        if chosen:
            return RoutingDecision(ROLES[chosen], "high", "model", scores)

    # Ambiguous with no model available: prefer the keyword leader if there was
    # one at all, since weak evidence still beats no evidence.
    if top_score > 0:
        return RoutingDecision(ROLES[top_key], "low", "keywords", scores)

    return RoutingDecision(DEFAULT_ROLE, "low", "default", scores)
