"""Curated drug interaction pairs.

A deliberately small, hand-checked table of well-documented interactions rather
than a live drug database. Per ROADMAP.md, free interaction APIs have
restrictive rate limits and inconsistent uptime, and a runtime dependency that
can fail on stage is worse than a smaller table that cannot.

Scope is flagging for discussion with a doctor. Nothing here advises starting,
stopping, or adjusting a medication -- that boundary is a safety rule, not a
stylistic one.
"""

from typing import Dict, List, NamedTuple, Set, Tuple


class Interaction(NamedTuple):
    severity: str  # "moderate" | "major"
    description: str


# Normalised generic name -> the brand and spelling variants seen on prescriptions.
DRUG_ALIASES: Dict[str, str] = {
    "warfarin": "warfarin",
    "coumadin": "warfarin",
    "aspirin": "aspirin",
    "acetylsalicylic acid": "aspirin",
    "asa": "aspirin",
    "disprin": "aspirin",
    "ecosprin": "aspirin",
    "ibuprofen": "ibuprofen",
    "brufen": "ibuprofen",
    "combiflam": "ibuprofen",
    "metformin": "metformin",
    "glycomet": "metformin",
    "glucophage": "metformin",
    "atorvastatin": "atorvastatin",
    "lipitor": "atorvastatin",
    "atorva": "atorvastatin",
    "clarithromycin": "clarithromycin",
    "clopidogrel": "clopidogrel",
    "plavix": "clopidogrel",
    "omeprazole": "omeprazole",
    "omez": "omeprazole",
    "levothyroxine": "levothyroxine",
    "thyronorm": "levothyroxine",
    "eltroxin": "levothyroxine",
    "calcium carbonate": "calcium",
    "calcium": "calcium",
    "shelcal": "calcium",
    "amlodipine": "amlodipine",
    "amlong": "amlodipine",
    "simvastatin": "simvastatin",
    "lisinopril": "lisinopril",
    "losartan": "losartan",
    "losar": "losartan",
    "spironolactone": "spironolactone",
    "potassium chloride": "potassium",
    "potassium": "potassium",
}

# Keyed by a sorted pair so lookup is order-independent.
INTERACTIONS: Dict[Tuple[str, str], Interaction] = {
    ("aspirin", "warfarin"): Interaction(
        "major", "Taking these together raises the risk of serious bleeding."
    ),
    ("clopidogrel", "warfarin"): Interaction(
        "major", "Both reduce clotting; combined use increases bleeding risk."
    ),
    ("ibuprofen", "warfarin"): Interaction(
        "major", "Anti-inflammatory painkillers increase bleeding risk with blood thinners."
    ),
    ("aspirin", "ibuprofen"): Interaction(
        "moderate", "Ibuprofen can blunt aspirin's heart-protective effect and irritate the stomach."
    ),
    ("atorvastatin", "clarithromycin"): Interaction(
        "major", "This antibiotic raises statin levels, increasing the risk of muscle damage."
    ),
    ("clarithromycin", "simvastatin"): Interaction(
        "major", "This antibiotic raises statin levels, increasing the risk of muscle damage."
    ),
    ("clopidogrel", "omeprazole"): Interaction(
        "moderate", "Omeprazole can reduce how well clopidogrel works."
    ),
    ("calcium", "levothyroxine"): Interaction(
        "moderate", "Calcium blocks absorption of thyroid medicine when taken at the same time."
    ),
    ("potassium", "spironolactone"): Interaction(
        "major", "Both raise potassium levels, which can affect heart rhythm."
    ),
    ("lisinopril", "potassium"): Interaction(
        "moderate", "This combination can push potassium levels too high."
    ),
    ("lisinopril", "spironolactone"): Interaction(
        "moderate", "Both raise potassium; levels may need monitoring."
    ),
}


def normalise_drug(name: str) -> str:
    """Map a prescription label to a generic name.

    Indian prescriptions usually print a brand ("Ecosprin"), while interaction
    data is keyed by generic ("aspirin"). Without this mapping the table would
    almost never match anything real.
    """
    cleaned = " ".join(name.strip().lower().split())
    if cleaned in DRUG_ALIASES:
        return DRUG_ALIASES[cleaned]

    # Prescriptions append strength and form: "Ecosprin 75mg Tablet".
    for token in cleaned.split():
        if token in DRUG_ALIASES:
            return DRUG_ALIASES[token]
    return cleaned


def find_interactions(drug_names: List[str]) -> List[dict]:
    """Return every known interaction among the given medications.

    Duplicate prescriptions of the same drug are collapsed first, so a pair is
    never reported twice.
    """
    generics: Set[str] = {normalise_drug(n) for n in drug_names if n and n.strip()}
    ordered = sorted(generics)

    found: List[dict] = []
    for i, first in enumerate(ordered):
        for second in ordered[i + 1 :]:
            interaction = INTERACTIONS.get((first, second))
            if interaction:
                found.append(
                    {
                        "drugs": [first, second],
                        "severity": interaction.severity,
                        "description": interaction.description,
                    }
                )
    return found
