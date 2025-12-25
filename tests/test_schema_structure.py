import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent


def load_json(relative_path: str):
    return json.loads((ROOT / relative_path).read_text(encoding="utf-8"))


def test_form_bindings_and_fields():
    form = load_json("schemas/2024/form.json")

    field_names = {field["name"] for field in form.get("fields", [])}
    expected = {
        "filingYear",
        "taxpayerId",
        "residentType",
        "aggregateTransferAmount",
        "aggregateAcquisitionAmount",
        "aggregateExpenses",
        "aggregateNetGain",
        "basicDeduction",
        "taxableBase",
        "progressiveTax",
    }
    assert expected.issubset(field_names)

    aggregates = form.get("bindings", {}).get("aggregates", {})
    for key in [
        "totalTransferAmount",
        "totalAcquisitionAmount",
        "totalExpenses",
        "totalGain",
    ]:
        assert key in aggregates


def test_schedule_aggregates_match_form():
    schedules = {
        "real_estate": load_json("schemas/2024/schedules/real_estate.json"),
        "financial_assets": load_json("schemas/2024/schedules/financial_assets.json"),
        "virtual_assets": load_json("schemas/2024/schedules/virtual_assets.json"),
    }

    for name, schedule in schedules.items():
        aggregates = schedule.get("aggregates", {})
        assert set(aggregates) >= {
            "totalTransferAmount",
            "totalAcquisitionAmount",
            "totalExpenses",
            "totalGain",
        }, f"schedule {name} missing aggregate bindings"


def test_rate_table_contains_basic_and_long_term_caps():
    rates = load_json("tables/2024/rates.json")
    assert "basicDeduction" in rates
    assert rates.get("basicDeduction", {}).get("amount") == 2_500_000

    long_term = rates.get("longTermHoldingSpecialDeductionLimit", {})
    for asset in ["real_estate", "financial_assets", "virtual_assets"]:
        assert asset in long_term
        assert "brackets" in long_term[asset]
