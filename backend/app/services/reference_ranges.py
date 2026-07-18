"""Biomarker naming and range logic.

Two jobs, both deliberately kept out of the model's hands:

1. **Canonical naming.** Labs print the same test a dozen ways -- "HbA1c",
   "Hb A1C", "Glycated Haemoglobin". Trends across reports only work if all of
   them collapse to one key.

2. **Flagging.** Whether a value is low, normal, or high is a numeric
   comparison. A model asked to extract *and* interpret in one pass will
   occasionally mislabel a normal value as high; comparing in Python cannot.
"""

from typing import Optional, Tuple

# Fallback ranges, used only when the report itself does not print one.
# Adult general-population values; not sex- or age-adjusted, which is why a
# range printed on the report always wins.
DEFAULT_RANGES = {
    "hba1c": (4.0, 5.6, "%"),
    "fasting_glucose": (70.0, 99.0, "mg/dL"),
    "total_cholesterol": (0.0, 200.0, "mg/dL"),
    "ldl": (0.0, 100.0, "mg/dL"),
    "hdl": (40.0, 60.0, "mg/dL"),
    "triglycerides": (0.0, 150.0, "mg/dL"),
    "hemoglobin": (13.0, 17.0, "g/dL"),
    "vitamin_d": (30.0, 100.0, "ng/mL"),
    "vitamin_b12": (200.0, 900.0, "pg/mL"),
    "tsh": (0.4, 4.0, "mIU/L"),
    "creatinine": (0.7, 1.3, "mg/dL"),
    "uric_acid": (3.4, 7.0, "mg/dL"),
    "alt": (7.0, 56.0, "U/L"),
    "ast": (10.0, 40.0, "U/L"),
}

# Maps the many printed spellings onto one canonical key.
ALIASES = {
    "hba1c": "hba1c",
    "hb a1c": "hba1c",
    "glycated hemoglobin": "hba1c",
    "glycated haemoglobin": "hba1c",
    "glycosylated hemoglobin": "hba1c",
    "fasting glucose": "fasting_glucose",
    "fasting blood sugar": "fasting_glucose",
    "fbs": "fasting_glucose",
    "glucose fasting": "fasting_glucose",
    "total cholesterol": "total_cholesterol",
    "cholesterol total": "total_cholesterol",
    "cholesterol": "total_cholesterol",
    "ldl": "ldl",
    "ldl cholesterol": "ldl",
    "ldl-c": "ldl",
    "hdl": "hdl",
    "hdl cholesterol": "hdl",
    "hdl-c": "hdl",
    "triglycerides": "triglycerides",
    "tg": "triglycerides",
    "hemoglobin": "hemoglobin",
    "haemoglobin": "hemoglobin",
    "hb": "hemoglobin",
    "vitamin d": "vitamin_d",
    "25-oh vitamin d": "vitamin_d",
    "vitamin d3": "vitamin_d",
    "vitamin b12": "vitamin_b12",
    "b12": "vitamin_b12",
    "cobalamin": "vitamin_b12",
    "tsh": "tsh",
    "thyroid stimulating hormone": "tsh",
    "creatinine": "creatinine",
    "serum creatinine": "creatinine",
    "uric acid": "uric_acid",
    "alt": "alt",
    "sgpt": "alt",
    "alt (sgpt)": "alt",
    "ast": "ast",
    "sgot": "ast",
    "ast (sgot)": "ast",
}


def canonical_name(raw: str) -> str:
    """Normalise a printed test name to a canonical key.

    Unknown tests pass through as a slug rather than being dropped -- storing an
    unrecognised marker is strictly better than losing the user's data.
    """
    cleaned = raw.strip().lower().replace("_", " ")
    cleaned = " ".join(cleaned.split())
    if cleaned in ALIASES:
        return ALIASES[cleaned]
    return cleaned.replace(" ", "_").replace("/", "_")


def resolve_range(
    name: str,
    ref_low: Optional[float],
    ref_high: Optional[float],
) -> Tuple[Optional[float], Optional[float]]:
    """Prefer the range printed on the report; fall back to defaults.

    The report's own range accounts for that lab's assay and the patient's
    demographics, so it is more trustworthy than any table we ship.
    """
    if ref_low is not None or ref_high is not None:
        return ref_low, ref_high

    default = DEFAULT_RANGES.get(canonical_name(name))
    if default:
        return default[0], default[1]
    return None, None


def flag_value(
    value: float,
    ref_low: Optional[float],
    ref_high: Optional[float],
) -> str:
    """Return 'low', 'normal', 'high', or 'unknown'.

    'unknown' when no range is available -- an unflagged value is honest, a
    guessed flag is not.
    """
    if ref_low is None and ref_high is None:
        return "unknown"
    if ref_low is not None and value < ref_low:
        return "low"
    if ref_high is not None and value > ref_high:
        return "high"
    return "normal"


def display_name(canonical: str) -> str:
    """Human-readable label for the UI."""
    special = {
        "hba1c": "HbA1c",
        "ldl": "LDL Cholesterol",
        "hdl": "HDL Cholesterol",
        "tsh": "TSH",
        "alt": "ALT (SGPT)",
        "ast": "AST (SGOT)",
        "vitamin_b12": "Vitamin B12",
        "vitamin_d": "Vitamin D",
    }
    if canonical in special:
        return special[canonical]
    return canonical.replace("_", " ").title()
