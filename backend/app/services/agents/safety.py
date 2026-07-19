"""Safety guardrails for the AI layer.

Per ROADMAP.md these are enforced in the response path, not delegated to the
README disclaimer.

The ordering matters more than the rules themselves. Emergency detection runs
*before* the model is called: a generated response that then gets filtered has
already cost latency, and any gap in the filter means unsafe text reaches the
user. Intercepting first makes the failure mode safe by construction.
"""

import re
from dataclasses import dataclass
from typing import List, Optional

EMERGENCY_NUMBER_IN = "112"

# Phrases that must never reach a language model for a considered opinion.
# Matched as word-boundary regexes so "chest pain" fires but "chesty" does not.
EMERGENCY_PATTERNS = {
    # Phrased the way people actually write, not the way textbooks list symptoms.
    # "chest tightness" alone missed "my chest feels tight", which is the far
    # more common wording.
    "cardiac": [
        r"\bchest (?:pain|tightness|pressure|discomfort)\b",
        r"\bchest (?:feels|is|felt) (?:tight|heavy|crushing)\b",
        r"\bcrushing (?:chest )?pain\b",
        r"\bpain (?:in|radiating to) (?:my )?(?:left |right )?arm\b",
        r"\b(?:left |right )?arm (?:hurts|is numb|feels numb)\b",
        r"\bheart attack\b",
    ],
    "breathing": [
        r"\b(?:can'?t|cannot|unable to) breathe\b",
        r"\bdifficulty breathing\b",
        r"\bshortness of breath\b",
        r"\bchoking\b",
        r"\bgasping\b",
    ],
    "neurological": [
        r"\bstroke\b",
        r"\bface (?:is )?drooping\b",
        r"\bslurred speech\b",
        r"\bsudden(?:ly)? (?:numb|weakness|paralysis)\b",
        r"\bseizure\b",
        r"\bunconscious\b",
        r"\bfainted\b",
    ],
    "bleeding": [
        r"\bsevere bleeding\b",
        r"\bbleeding (?:heavily|profusely|non.?stop)\b",
        r"\bvomiting blood\b",
        r"\bcoughing (?:up )?blood\b",
    ],
    "self_harm": [
        r"\bkill(?:ing)? myself\b",
        r"\bsuicid(?:e|al)\b",
        r"\bend(?:ing)? (?:my|it) (?:life|all)\b",
        r"\bwant to die\b",
        r"\bdon'?t want to (?:live|be here)\b",
        r"\b(?:harm|hurt)(?:ing)? myself\b",
    ],
    "poisoning": [
        r"\boverdose(?:d)?\b",
        r"\btook too many (?:pills|tablets)\b",
        r"\bpoison(?:ed|ing)\b",
    ],
}

EMERGENCY_RESPONSES = {
    "self_harm": (
        "It sounds like you may be going through something very painful, and I want "
        "you to speak to someone who can help right now.\n\n"
        "**Please call Tele-MANAS at 14416 (free, 24x7) or emergency services at 112.**\n\n"
        "If you are in immediate danger, please reach out to someone nearby who can "
        "stay with you. You deserve support from a real person, and I am not able to "
        "provide the help you need here."
    ),
    "default": (
        "**These symptoms need immediate medical attention. Please call emergency "
        f"services at {EMERGENCY_NUMBER_IN} or get to the nearest emergency room now.**\n\n"
        "I am not able to assess symptoms like these, and waiting for an answer here "
        "could delay care you may need urgently. Please treat this as an emergency."
    ),
}

# Phrasings that would make the assistant an authority on medication changes.
MEDICATION_ACTION_PATTERNS = [
    r"\byou should (?:stop|start|increase|decrease|reduce|double)\b",
    r"\bstop taking\b",
    r"\bdiscontinue\b",
    r"\bincrease your dose\b",
    r"\breduce your dose\b",
    r"\bdouble the dose\b",
    r"\bswitch to\b.{0,30}\binstead of\b",
]

# Conclusive diagnostic claims. Hedged discussion ("this can be associated
# with") is allowed; a verdict is not.
DIAGNOSIS_PATTERNS = [
    # "you have" needs a negative lookahead. Without one it fired on "if you
    # have any further questions, speak to your doctor" -- a sentence that is
    # the assistant behaving correctly. A warning that flags good answers is
    # worse than no warning, because it teaches everyone to ignore the panel.
    r"\byou have\b(?!\s+(?:any|some|no|further|other|more|additional|"
    r"questions?|concerns?|been|had|a\s+question|an\s+appointment))",
    r"\byou (?:are suffering from|are diagnosed with|clearly have)\b",
    r"\bthis (?:is|confirms) (?:definitely |certainly )?(?:diabetes|cancer|a tumou?r)\b",
    r"\bi diagnose\b",
]


@dataclass
class SafetyVerdict:
    blocked: bool
    category: Optional[str] = None
    response: Optional[str] = None


def screen_input(message: str) -> SafetyVerdict:
    """Check a user message before any model call.

    Self-harm is tested first: a message can match several categories at once,
    and it is the one whose response must never be replaced by a generic
    "go to the emergency room".
    """
    text = message.lower()

    ordered = ["self_harm"] + [k for k in EMERGENCY_PATTERNS if k != "self_harm"]
    for category in ordered:
        for pattern in EMERGENCY_PATTERNS[category]:
            if re.search(pattern, text):
                return SafetyVerdict(
                    blocked=True,
                    category=category,
                    response=EMERGENCY_RESPONSES.get(category, EMERGENCY_RESPONSES["default"]),
                )

    return SafetyVerdict(blocked=False)


def screen_output(reply: str) -> List[str]:
    """Report which safety rules a generated reply violates.

    A backup, not the primary control. The system prompt is what should prevent
    these; this catches the cases where it did not.
    """
    violations: List[str] = []
    text = reply.lower()

    if any(re.search(p, text) for p in MEDICATION_ACTION_PATTERNS):
        violations.append("medication_change")
    if any(re.search(p, text) for p in DIAGNOSIS_PATTERNS):
        violations.append("diagnosis")

    return violations


def find_unsupported_numbers(reply: str, known_values: List[float]) -> List[float]:
    """Find clinical-looking numbers in a reply that are not in the user's data.

    Guards the "no fabricated values" rule. Deliberately narrow: it ignores
    integers under 25, which are overwhelmingly step counts, hours, ages, and
    list numbering rather than invented lab results.

    Known limitation: it cannot tell an invented lab value from arithmetic the
    model performed legitimately. "Raise your 3,200 steps to 3,700" produces a
    number that appears nowhere in the context but is sound advice. This is why
    the result is a warning and never a block -- treat a hit as a prompt to read
    the reply, not as proof of fabrication.
    """
    known = {round(v, 2) for v in known_values}
    suspicious: List[float] = []

    # Strip dates first. Replies are asked to cite when a value was measured, so
    # "6.4% on 2026-07-10" is correct behaviour -- but the year reads as an
    # unexplained four-digit number and flagged every well-formed answer.
    text = re.sub(r"\b\d{4}-\d{2}-\d{2}\b", " ", reply)
    text = re.sub(r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b", " ", text)
    # Models often render a date as prose rather than echoing the ISO form.
    text = re.sub(
        r"\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b",
        " ",
        text,
        flags=re.IGNORECASE,
    )

    for raw in re.findall(r"\b\d+(?:\.\d+)?\b", text):
        value = float(raw)
        if "." not in raw and value < 25:
            continue
        if round(value, 2) not in known:
            suspicious.append(value)

    return suspicious
