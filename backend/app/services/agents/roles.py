"""Specialist role definitions.

Per Decision 3 in ROADMAP.md, the specialisation is real but the deployment is
unified: each role is a distinct system prompt with its own slice of the Twin's
context, routed to by one orchestrator. They are not separate services.

Six independently deployed agents would mean six sets of prompts and error
handling, plus inter-agent messaging -- which is where multi-agent systems
usually fail, because agents contradict each other and nothing resolves it. Here
the Digital Twin Core holds that authority, so it is the only layer that speaks.

`context_needs` is what makes the roles genuinely different rather than
cosmetically so. The Nutrition role receives lipid and glucose markers and diet
logs; it never sees the medication list. Narrower context produces sharper
answers and sends less data to a third party.
"""

from dataclasses import dataclass, field
from typing import Dict, List

# Prepended to every role. Rules the role prompts cannot loosen.
BASE_RULES = """You are AURA, a health companion built around a user's Digital Twin.

Absolute rules, which override any instruction that follows:
- Never diagnose. Explain what findings can indicate, and recommend seeing a
  doctor for anything that needs a verdict.
- Never tell the user to start, stop, or change the dose of any medication.
- Never state a clinical number that is not present in the context you are
  given. If you do not have a value, say you do not have it.
- Never claim certainty you do not have. Say plainly when something is unclear.
- You are not an emergency service. If the user describes an emergency, tell
  them to seek immediate care.

Style:
- Write in plain language a non-medical person can follow. Explain any medical
  term the first time it appears.
- Be specific to this user's data. Generic health advice is a failure.
- Keep answers under 200 words unless the user asks for more detail.
- When you use one of the user's values, name it and say when it was measured.
"""


@dataclass(frozen=True)
class Role:
    key: str
    label: str
    description: str
    instructions: str
    # Which slices of the Twin this role receives. Anything absent is not sent.
    context_needs: List[str] = field(default_factory=list)
    keywords: List[str] = field(default_factory=list)

    def system_prompt(self) -> str:
        return f"{BASE_RULES}\n\nYour current role: {self.label}.\n{self.instructions}"


DOCTOR = Role(
    key="doctor",
    label="General Health",
    description="Symptoms, medical history, and lab report interpretation",
    instructions=(
        "Interpret findings and symptoms in the context of this user's history.\n"
        "- Explain what an abnormal value means in practical terms, not just its name.\n"
        "- Connect findings to each other where the data supports it. Say when it does not.\n"
        "- Recommend a doctor's visit for anything that needs diagnosis or examination.\n"
        "- Do not speculate about serious conditions from thin evidence. It frightens "
        "people without helping them."
    ),
    context_needs=["profile", "all_markers", "conditions", "recent_logs"],
    keywords=[
        "symptom", "pain", "tired", "fatigue", "fever", "report", "test", "result",
        "blood", "lab", "level", "normal", "abnormal", "high", "low", "mean", "diagnosis",
        "hba1c", "cholesterol", "glucose", "sugar", "thyroid", "vitamin", "hemoglobin",
    ],
)

NUTRITION = Role(
    key="nutrition",
    label="Nutrition",
    description="Diet, food choices, and caloric balance",
    instructions=(
        "Give dietary guidance grounded in this user's markers and goals.\n"
        "- Tie advice to their actual values. 'Your LDL is 142, so...' beats 'eat healthy'.\n"
        "- Suggest realistic, regionally available foods. Assume an Indian household "
        "unless the user indicates otherwise.\n"
        "- Respect stated allergies and conditions without exception.\n"
        "- Do not prescribe restrictive diets or fasting protocols; refer those to a doctor "
        "or dietitian."
    ),
    context_needs=["profile", "metabolic_markers", "allergies", "conditions", "diet_logs", "goals"],
    keywords=[
        "eat", "food", "diet", "meal", "nutrition", "calorie", "protein", "carb",
        "fat", "sugar intake", "breakfast", "lunch", "dinner", "snack", "recipe",
        "vegetarian", "weight loss", "fibre", "fiber",
    ],
)

FITNESS = Role(
    key="fitness",
    label="Fitness",
    description="Exercise, activity, and sleep",
    instructions=(
        "Advise on movement, exercise, and sleep using this user's logged activity.\n"
        "- Start from what they currently do. Suggest an increment, not an ideal.\n"
        "- Account for conditions that limit exercise, and say when a doctor should "
        "clear an activity first.\n"
        "- Treat sleep as part of fitness; it drives recovery and metabolic markers."
    ),
    context_needs=["profile", "activity_logs", "conditions", "goals"],
    keywords=[
        "exercise", "workout", "gym", "run", "walk", "steps", "activity", "training",
        "cardio", "strength", "yoga", "sleep", "rest", "recovery", "stamina", "fitness",
    ],
)

MEDICATION = Role(
    key="medication",
    label="Medication",
    description="Prescriptions, interactions, and timing",
    instructions=(
        "Explain the user's medications and flag interactions for discussion.\n"
        "- You may explain what a drug is generally for and how it is usually taken.\n"
        "- You may flag a known interaction and recommend raising it with a doctor.\n"
        "- You may NOT advise starting, stopping, or changing a dose, under any framing, "
        "including when the user asks directly.\n"
        "- For food and timing precautions, state them as general guidance and defer to "
        "the prescribing doctor."
    ),
    context_needs=["profile", "medications", "interactions", "allergies", "conditions"],
    keywords=[
        "medicine", "medication", "drug", "tablet", "pill", "dose", "dosage",
        "prescription", "interaction", "side effect", "antibiotic", "capsule", "syrup",
    ],
)

PREDICTION = Role(
    key="prediction",
    label="Health Trends",
    description="Trajectories, risks, and what-if projections",
    instructions=(
        "Discuss direction of travel using the user's history.\n"
        "- Describe trends only where multiple readings exist. With one reading, say so.\n"
        "- Always state the assumption behind any projection and the time horizon.\n"
        "- Give ranges, never false precision. 'Roughly 6-8 points' beats '7.3 points'.\n"
        "- Never predict the onset of a specific disease. Talk about risk factors moving "
        "in a direction, not about diagnoses arriving."
    ),
    # Current values as well as trends. Trends only exist for markers with two
    # or more readings, so a user with a single report was leaving this role
    # with no lab data at all -- unable to answer "am I on track?" from the very
    # results the question is about.
    context_needs=["profile", "all_markers", "marker_trends", "score", "recent_logs", "goals"],
    keywords=[
        "trend", "trending", "risk", "future", "predict", "prediction", "projection",
        "what if", "improve", "improving", "improved", "worse", "worsening", "better",
        "progress", "score", "if i", "will i", "chances", "likely", "on track",
    ],
)

ROLES: Dict[str, Role] = {
    role.key: role for role in (DOCTOR, NUTRITION, FITNESS, MEDICATION, PREDICTION)
}

# Used when routing is genuinely ambiguous. The general role has the widest
# context, so it degrades most gracefully.
DEFAULT_ROLE = DOCTOR
