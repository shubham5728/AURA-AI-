"""Hereditary risk from recorded family history.

Not genetics. There is no sequencing data here and there will not be, so this
does the honest version of the same job: a condition that runs in the family
tells you which of your own results are worth watching, and roughly how closely.

The whole module is a lookup plus a comparison. That is deliberate -- the value
is in connecting two things the user already has (a relative's diagnosis and
their own lab values), not in modelling anything.

What it must never do is predict. "Your father has diabetes and your HbA1c is
6.4" is a fact worth surfacing. "You will develop diabetes" is a claim no data
here supports.
"""

from dataclasses import dataclass
from typing import Dict, List, Optional

# How much a relative's diagnosis bears on the user's own risk. First-degree
# relatives share about half their genes; second-degree, a quarter. The weights
# reflect that ordering without pretending to be a clinical risk model.
RELATION_WEIGHT: Dict[str, float] = {
    "mother": 1.0,
    "father": 1.0,
    "brother": 1.0,
    "sister": 1.0,
    "son": 1.0,
    "daughter": 1.0,
    "grandmother": 0.5,
    "grandfather": 0.5,
    "aunt": 0.5,
    "uncle": 0.5,
    "cousin": 0.25,
}
DEFAULT_WEIGHT = 0.25

FIRST_DEGREE = {"mother", "father", "brother", "sister", "son", "daughter"}


@dataclass(frozen=True)
class Condition:
    key: str
    label: str
    # Canonical marker names this condition is tracked by.
    markers: List[str]
    watch: str


# Conditions with a known familial component that AURA can actually track,
# because it already reads the markers involved. A condition nobody can measure
# here would produce a warning with nothing behind it.
CONDITIONS: List[Condition] = [
    Condition(
        "diabetes",
        "Diabetes",
        ["hba1c", "fasting_glucose"],
        "Blood sugar is worth checking regularly when diabetes runs in the family.",
    ),
    Condition(
        "heart_disease",
        "Heart disease",
        ["total_cholesterol", "ldl", "hdl", "triglycerides"],
        "Cholesterol and triglycerides are the results most closely watched here.",
    ),
    Condition(
        "hypertension",
        "High blood pressure",
        [],
        "Blood pressure is not something AURA measures yet -- worth tracking with your doctor.",
    ),
    Condition(
        "thyroid",
        "Thyroid disease",
        ["tsh"],
        "TSH is the usual first check for thyroid function.",
    ),
    Condition(
        "kidney_disease",
        "Kidney disease",
        ["creatinine", "uric_acid"],
        "Creatinine reflects how well the kidneys are filtering.",
    ),
    Condition(
        "anaemia",
        "Anaemia",
        ["hemoglobin", "rbc", "hct", "mcv", "vitamin_b12"],
        "Haemoglobin and red cell measures are the ones to follow.",
    ),
    Condition(
        "liver_disease",
        "Liver disease",
        ["alt", "ast"],
        "Liver enzymes rise when liver cells are under stress.",
    ),
]

# What people actually type. Matched as substrings, so "type 2 diabetes" and
# "diabetes mellitus" both land on the same condition.
ALIASES: Dict[str, str] = {
    "diabetes": "diabetes",
    "diabetic": "diabetes",
    "sugar": "diabetes",
    "type 2": "diabetes",
    "type 1": "diabetes",
    "heart": "heart_disease",
    "cardiac": "heart_disease",
    "cholesterol": "heart_disease",
    "heart attack": "heart_disease",
    "stroke": "heart_disease",
    "bp": "hypertension",
    "blood pressure": "hypertension",
    "hypertension": "hypertension",
    "thyroid": "thyroid",
    "hypothyroid": "thyroid",
    "hyperthyroid": "thyroid",
    "kidney": "kidney_disease",
    "renal": "kidney_disease",
    "anaemia": "anaemia",
    "anemia": "anaemia",
    "liver": "liver_disease",
    "fatty liver": "liver_disease",
    "hepatitis": "liver_disease",
}

BY_KEY = {c.key: c for c in CONDITIONS}


def match_condition(text: str) -> Optional[str]:
    """Map free text to a tracked condition, or None.

    Longest alias first, so "blood pressure" is not claimed by "bp" appearing
    inside another word.
    """
    cleaned = " ".join(text.strip().lower().split())
    for alias in sorted(ALIASES, key=len, reverse=True):
        if alias in cleaned:
            return ALIASES[alias]
    return None


@dataclass
class Finding:
    condition_key: str
    condition: str
    relatives: List[str]
    closest_relation: str
    strength: str  # "higher" | "some"
    watch: str
    your_markers: List[dict]

    def as_dict(self) -> dict:
        return {
            "condition_key": self.condition_key,
            "condition": self.condition,
            "relatives": self.relatives,
            "closest_relation": self.closest_relation,
            "strength": self.strength,
            "watch": self.watch,
            "your_markers": self.your_markers,
        }


def assess(family: List[dict], markers: List[dict]) -> List[dict]:
    """Connect recorded family conditions to the user's own results.

    `family` is [{name, relation, conditions[]}], `markers` is the user's latest
    readings. Returns one finding per condition that appears in the family and
    that AURA can track.
    """
    by_name = {m["name"]: m for m in markers}
    grouped: Dict[str, List[dict]] = {}

    for member in family:
        relation = (member.get("relation") or "").strip().lower()
        for raw in member.get("conditions") or []:
            key = match_condition(str(raw))
            if not key:
                continue
            grouped.setdefault(key, []).append(
                {
                    "name": member.get("name") or "A relative",
                    "relation": relation,
                    "weight": RELATION_WEIGHT.get(relation, DEFAULT_WEIGHT),
                }
            )

    findings: List[Finding] = []
    for key, relatives in grouped.items():
        condition = BY_KEY[key]
        closest = max(relatives, key=lambda r: r["weight"])

        # Two first-degree relatives, or any first-degree relative, is the line
        # at which family history is usually considered significant.
        first_degree = [r for r in relatives if r["relation"] in FIRST_DEGREE]
        strength = "higher" if first_degree else "some"

        your_markers = [
            {
                "name": name,
                "label": by_name[name]["label"],
                "value": by_name[name]["value"],
                "unit": by_name[name].get("unit"),
                "flag": by_name[name]["flag"],
            }
            for name in condition.markers
            if name in by_name
        ]

        findings.append(
            Finding(
                condition_key=key,
                condition=condition.label,
                relatives=[f"{r['name']} ({r['relation']})" for r in relatives],
                closest_relation=closest["relation"],
                strength=strength,
                watch=condition.watch,
                your_markers=your_markers,
            )
        )

    # Strongest family link first, then conditions where the user has readings
    # that relate to it -- those are the ones with something to act on.
    findings.sort(
        key=lambda f: (f.strength == "higher", len(f.your_markers)), reverse=True
    )
    return [f.as_dict() for f in findings]
