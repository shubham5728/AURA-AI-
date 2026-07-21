"""Plain-language descriptions of what each measurement means.

Domain reference data, the same category as reference_ranges.py -- what a test
measures, in language a non-medical person can follow. Mirrors the set the
frontend uses on the report card, extended with the lifestyle and computed
metrics the Digital Twin shows.

Two rules, unchanged from the frontend copy: describe what a value *measures*,
never what a result *means* ("how much your red cell sizes vary", not "high
values suggest anaemia"); and use no jargon inside the explanation itself.
"""

EXPLANATIONS = {
    # Red cells
    "hemoglobin": "Carries oxygen from your lungs to the rest of your body",
    "rbc": "How many red blood cells you have",
    "hct": "What share of your blood is made up of red cells",
    "mcv": "The average size of your red blood cells",
    "mch": "The average amount of oxygen-carrying protein per red cell",
    "mchc": "How tightly packed that protein is inside each red cell",
    "rdw": "How much your red blood cells vary in size",
    # White cells
    "wbc": "Your total infection-fighting cells",
    "neutrophils": "The white cells that respond first to bacterial infection",
    "lymphocytes": "The white cells that deal with viruses and build immunity",
    "eosinophils": "White cells linked to allergies and parasites",
    "monocytes": "White cells that clear away damaged cells and debris",
    "basophils": "The rarest white cells, involved in allergic reactions",
    # Platelets
    "platelets": "The cells that help your blood clot and stop bleeding",
    "mpv": "The average size of your platelets",
    "pdw": "How much your platelets vary in size",
    # Blood sugar
    "hba1c": "Your average blood sugar over the past 2 to 3 months",
    "fasting_glucose": "Your blood sugar after not eating overnight",
    # Cholesterol
    "total_cholesterol": "All the cholesterol circulating in your blood",
    "ldl": "The cholesterol that can build up inside artery walls",
    "hdl": "The cholesterol that helps clear the other kind away",
    "triglycerides": "Fat carried in your blood, mostly from food and alcohol",
    # Organs
    "alt": "A liver enzyme that leaks into the blood when liver cells are stressed",
    "ast": "An enzyme found in the liver, heart and muscles",
    "creatinine": "A waste product your kidneys filter out",
    "uric_acid": "A waste product that can collect in joints",
    # Thyroid and vitamins
    "tsh": "The signal your brain sends to control your thyroid",
    "vitamin_d": "Helps your body absorb calcium for bones and muscles",
    "vitamin_b12": "Needed to make red blood cells and keep nerves healthy",
    # Computed and lifestyle
    "bmi": "Your weight relative to your height",
    "bmr": "The calories your body burns at complete rest",
    "steps": "How much you move through the day",
    "sleep": "How long you sleep each night",
    "water": "How much water you drink each day",
}


def explain(key: str) -> str:
    return EXPLANATIONS.get(key, "")
