"""Dashboard reads recorded inputs; it never repairs history or changes finance."""
import copy
import json
from pathlib import Path

import jsonschema
import pytest

from core.redcf.dashboard import query_dashboard
from core.redcf.recompute import input_hash, recompute

ROOT = Path(__file__).resolve().parents[1]
ENGINE = json.loads((ROOT / "schemas/examples/v2/v2_案例A_都更全案管理.json").read_text(encoding="utf-8"))["engine"]


def point(identity="one", ts="2026-06-01T10:00:00+08:00", price=None):
    engine = copy.deepcopy(ENGINE)
    if price is not None:
        engine["params"]["住宅單價"] = price
    return {"point_id": identity, "ts": ts, "engine": engine,
            "input_hash": input_hash(engine), "core_version": "0.5.0"}


def test_replay_verbatim_and_schema():
    p = point()
    original = copy.deepcopy(p)
    out = query_dashboard([p], today="2026-10-05")
    expected = recompute(p["engine"])
    row = out["points"][0]
    assert out["range"]["start"] == "2026-06-01"
    for key in ("total_sales", "shared_cost", "owner_return_value", "return_rate", "saleable_area"):
        assert row["values"][key] == expected[key]
    assert sum(row["costs"].values()) == pytest.approx(expected["shared_cost"])
    assert row["recorded_core_version"] == "0.5.0"
    assert row["core_version"] == out["core_version"]
    assert row["ts"] == original["ts"]
    assert p == original
    assert out["chart"]["interpolation"] == "none"
    assert out["chart"]["editable"] is False
    jsonschema.validate(out, json.loads((ROOT / "schemas/dashboard_query.schema.v0.1.json").read_text()))


def test_deltas_in_core_and_no_fabricated_metrics():
    out = query_dashboard([point("two", "2026-09-29", 70), point("one", "2026-06-19", 60)], today="2026-10-05")
    a, b = out["points"]
    assert out["current_id"] == "two"
    assert out["previous_id"] == "one"
    assert out["deltas"]["return_rate"]["value"] == b["values"]["return_rate"] - a["values"]["return_rate"]
    assert "pp" in out["deltas"]["return_rate"]["display"]
    assert a["values"]["agreed"] is None
    assert a["values"]["funding_gap"] is None
    assert "profit" not in a["values"]


def test_missing_point_not_skipped_for_previous_comparison():
    missing = {"point_id": "missing", "ts": "2026-08-01", "engine": None}
    out = query_dashboard([point("one"), missing, point("three", "2026-09-01")], today="2026-10-05")
    assert out["previous_id"] == "missing"
    assert out["deltas"]["return_rate"]["value"] is None
    assert out["points"][1]["display"]["total_sales"] == "—"
    assert out["points"][1]["error"]


def test_unknown_date_and_mismatched_hash_are_not_inferred():
    a, b = point(), point("bad", "2026-09-01")
    a["ts"] = None
    b["input_hash"] = "sha256:old"
    out = query_dashboard([a, b], today="2026-10-05")
    assert all(p["error"] for p in out["points"])
    assert all(p["values"]["total_sales"] is None for p in out["points"])
    assert out["current_id"] == "bad"


@pytest.mark.parametrize("period,expected", [("3m", "2026-07-05"), ("6m", "2026-04-05"), ("1y", "2025-10-05")])
def test_period_calendar(period, expected):
    assert query_dashboard([], period=period, today="2026-10-05")["range"]["start"] == expected


def test_month_end_and_taipei_date_inclusive():
    assert query_dashboard([], period="3m", end="2026-05-31")["range"]["start"] == "2026-02-28"
    rows = [point("in", "2026-10-04T16:00:00Z"), point("out", "2026-10-05T16:00:00Z")]
    out = query_dashboard(rows, period="custom", start="2026-10-05", end="2026-10-05")
    assert [p["point_id"] for p in out["points"]] == ["in"]
    assert out["points"][0]["ts"].endswith("+00:00")


@pytest.mark.parametrize("kwargs", [{"metric": "profit"}, {"period": "unknown"}, {"start": "2026-10-05", "end": "2026-01-01"}])
def test_invalid_query(kwargs):
    with pytest.raises(ValueError):
        query_dashboard([], **kwargs)


@pytest.mark.parametrize("points", [[None], [{"ts": None}], [point(), point()], [{"point_id": "bad-time", "ts": 123}]])
def test_invalid_point_identity(points):
    with pytest.raises(ValueError):
        query_dashboard(points)


def test_limit_applies_after_period_filter():
    points = [{"point_id": str(i), "ts": "2026-01-01"} for i in range(300)]
    assert query_dashboard(points, start="2026-02-01", end="2026-10-05")["points"] == []
    with pytest.raises(ValueError, match="256"):
        query_dashboard(points, end="2026-10-05")


def test_recorded_consent_only_and_zero_delta():
    a, b = point("a"), point("b", "2026-09-01")
    a.update(agreed=0, consent_source="recorded")
    b.update(agreed=0, consent_source="recorded")
    out = query_dashboard([a, b], today="2026-10-05")
    assert out["deltas"]["agreed"]["value"] == 0
    assert out["deltas"]["total_sales"]["value"] == 0
    b["consent_source"] = "current"
    assert query_dashboard([b], today="2026-10-05")["points"][0]["values"]["agreed"] is None
