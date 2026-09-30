"""Synthetic-only regressions for the local intake and existing cashflow facade."""
import copy
import json
from pathlib import Path

import jsonschema
import pytest

from core.redcf import CORE_VERSION, input_hash, recompute, recompute_cashflow

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture
def engine():
    return json.loads((ROOT / "schemas/examples/v2/v2_案例A_都更全案管理.json").read_text(encoding="utf-8"))["engine"]


@pytest.mark.parametrize("mode", ["全案管理", "合建", "買賣"])
def test_cashflow_facade_is_bound_and_conserves_existing_costs(engine, mode):
    engine["mode"] = mode
    before = copy.deepcopy(engine)
    result = recompute(engine)
    flow = recompute_cashflow(engine)
    schema = json.loads((ROOT / "schemas/cashflow_view.schema.v0.1.json").read_text(encoding="utf-8"))
    jsonschema.validate(flow, schema)
    assert flow["input_hash"] == input_hash(engine)
    assert flow["core_version"] == CORE_VERSION
    assert sum(flow["期別出資"]) == pytest.approx(sum(flow["科目"].values()), abs=0.01)
    assert flow["累積"][-1] == pytest.approx(result["shared_cost"], abs=1)
    assert flow["basis"] == "cost-disbursement-only"
    assert flow["structural"] is True
    assert engine == before


def test_changed_cost_input_recomputes_flow_and_identity(engine):
    before = recompute_cashflow(engine)
    engine["params"].setdefault("財務覆寫", {})["營造單價"] = 37
    after = recompute_cashflow(engine)
    assert before["input_hash"] != after["input_hash"]
    assert before["科目"] != after["科目"]
    assert before["期別出資"] != after["期別出資"]


def test_site_sketch_schema_rejects_geospatial_authority_and_oversize():
    schema = json.loads((ROOT / "schemas/site_intake.schema.v0.1.json").read_text(encoding="utf-8"))
    doc = {"schema_version": "site-intake-0.1", "project_id": "synthetic",
           "coordinate_space": "normalized-unlocated", "land": {},
           "parcels": [{"id": "p-one", "label": "Synthetic", "points": [[0.1, 0.2], [0.8, 0.2], [0.5, 0.9]]}]}
    jsonschema.validate(doc, schema)
    for bad in [dict(doc, coordinate_space="EPSG:3826"), dict(doc, measured_area=10),
                dict(doc, parcels=doc["parcels"] * 9)]:
        with pytest.raises(jsonschema.ValidationError):
            jsonschema.validate(bad, schema)


def test_cashflow_is_available_without_pandas(engine, monkeypatch):
    import sys
    monkeypatch.setitem(sys.modules, "pandas", None)
    assert recompute_cashflow(engine)["input_hash"] == input_hash(engine)
