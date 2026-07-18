"""Tests for drug interaction detection.

The highest-liability feature in the product. A missed interaction is a safety
failure, and a false one erodes trust in every other warning.
"""

from app.services.interactions import find_interactions, normalise_drug


def test_indian_brand_names_map_to_generics():
    """Prescriptions print brands; the interaction table is keyed by generic."""
    assert normalise_drug("Ecosprin") == "aspirin"
    assert normalise_drug("Thyronorm") == "levothyroxine"
    assert normalise_drug("Glycomet") == "metformin"


def test_strength_and_form_are_ignored():
    """Real labels read 'Ecosprin 75mg Tablet', never a bare generic."""
    assert normalise_drug("Ecosprin 75mg Tablet") == "aspirin"
    assert normalise_drug("  ATORVA  10 mg  ") == "atorvastatin"


def test_known_major_interaction_is_flagged():
    found = find_interactions(["Warfarin", "Ecosprin"])
    assert len(found) == 1
    assert found[0]["severity"] == "major"
    assert sorted(found[0]["drugs"]) == ["aspirin", "warfarin"]


def test_detection_is_order_independent():
    assert find_interactions(["Aspirin", "Warfarin"]) == find_interactions(["Warfarin", "Aspirin"])


def test_safe_combination_is_not_flagged():
    """False warnings are their own harm."""
    assert find_interactions(["Metformin", "Vitamin D"]) == []


def test_duplicate_prescriptions_do_not_double_report():
    found = find_interactions(["Aspirin", "Ecosprin", "Warfarin"])
    assert len(found) == 1


def test_multiple_distinct_interactions_all_surface():
    found = find_interactions(["Warfarin", "Aspirin", "Ibuprofen"])
    pairs = {tuple(sorted(f["drugs"])) for f in found}
    assert ("aspirin", "warfarin") in pairs
    assert ("ibuprofen", "warfarin") in pairs
    assert ("aspirin", "ibuprofen") in pairs


def test_single_or_empty_medication_list_is_safe():
    assert find_interactions([]) == []
    assert find_interactions(["Aspirin"]) == []
    assert find_interactions(["", "   "]) == []


def test_unknown_drug_passes_through_without_crashing():
    assert find_interactions(["Zzyzx 50mg", "Warfarin"]) == []


def test_every_interaction_explains_itself_in_plain_language():
    for entry in find_interactions(["Warfarin", "Aspirin", "Ibuprofen"]):
        assert entry["description"].strip().endswith(".")
        assert entry["severity"] in {"moderate", "major"}
