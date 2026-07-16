# -*- coding: utf-8 -*-
"""
tests/test_workflow.py — Workflow OS 合約 wf-1.0 驗收（M3-C・C1）
==================================================================
C1 範圍：schema 結構驗證（T1）＋遷移骨架（T5）＋凍結守衛。
同意狀態機的完整不變式在 C3（本檔只放最小 sanity）。
合成範例，零真實資料（僅匿名代號）。
"""
import hashlib
import json
import pathlib

import pytest

根 = pathlib.Path(__file__).resolve().parents[1]
WF_EX = 根 / "schemas" / "examples" / "workflow" / "wf_案例D_示範.json"


def _load(p):
    return json.load(open(p, encoding="utf-8"))


# ── T1：範例通過 wf schema；壞值被擋 ──
def test_wf_範例通過schema():
    pytest.importorskip("jsonschema")
    from core.redcf.workflow import validate_workflow
    ok, errs = validate_workflow(_load(WF_EX))
    assert ok, errs


def test_wf_缺project_id被擋():
    pytest.importorskip("jsonschema")
    from core.redcf.workflow import validate_workflow
    bad = _load(WF_EX)
    del bad["project"]["project_id"]
    ok, errs = validate_workflow(bad)
    assert not ok and any("project_id" in e for e in errs)


def test_wf_未知同意事件被擋():
    pytest.importorskip("jsonschema")
    from core.redcf.workflow import validate_workflow
    bad = _load(WF_EX)
    bad["consent_events"][0]["kind"] = "bribed"   # 不在列舉內
    ok, errs = validate_workflow(bad)
    assert not ok


def test_wf_snapshot_引用計算檔而非複製數字():
    """管理層只存 input_hash 溯源指紋＋引用的欄位『名稱』，不複製 result 物件/數值（SSOT）。"""
    doc = _load(WF_EX)
    snap = doc["project"]["snapshots"][0]
    assert snap["input_hash"].startswith("sha256:")
    # snapshot 不得夾帶 result 物件或財務數值欄位（欄位名稱出現在 result_fields_cited 是允許的稽核痕跡）
    for banned in ("result", "total_sales", "shared_cost", "owner_return_value"):
        assert banned not in snap


def test_wf_stakeholder_零真實PII():
    """僅匿名代號；不得出現姓名欄位。"""
    doc = _load(WF_EX)
    for s in doc["stakeholders"]:
        assert s["stakeholder_id"] and "name" not in s


# ── T5：遷移骨架（wf-1.0 冪等；未知版本報錯）──
def test_wf_遷移冪等():
    from core.redcf.workflow import migrate_workflow
    doc = _load(WF_EX)
    assert migrate_workflow(doc)["schema_version"] == "wf-1.0"


def test_wf_未知版本報錯():
    from core.redcf.workflow import migrate_workflow
    with pytest.raises(ValueError):
        migrate_workflow({"schema_version": "wf-0.9"})


# ── C3 預留：同意狀態推導最小 sanity ──
def test_wf_同意狀態推導_sanity():
    from core.redcf.workflow import derive_consent_state
    doc = _load(WF_EX)
    def evs(sid):
        return [e for e in doc["consent_events"] if e["stakeholder_id"] == sid]
    assert derive_consent_state(evs("W44")) == "agreed_unselected"   # verbal_ok→signed
    assert derive_consent_state(evs("W45")) == "declined"
    assert derive_consent_state(evs("W37")) == "negotiating"         # contacted→visited
    assert derive_consent_state([]) == "untouched"


def test_wf_同意狀態推導_與web版一致():
    """鏡像 tests/web/test_workspace.mjs 的正典序列——鎖住 Python↔JS 狀態機不得分歧。"""
    from core.redcf.workflow import derive_consent_state as ds
    def E(kind, ts): return {"stakeholder_id": "W01", "kind": kind, "ts": ts}
    assert ds([E("contacted", "1")]) == "contacted"
    assert ds([E("briefed", "1"), E("verbal_ok", "2")]) == "agreed_unselected"
    assert ds([E("verbal_ok", "1"), E("selected_unit", "2")]) == "agreed_selected"
    assert ds([E("signed", "1"), E("declined", "2")]) == "declined"          # declined 覆寫
    assert ds([E("selected_unit", "1"), E("withdrawn", "2")]) == "negotiating"  # withdrawn 覆寫
    assert ds([E("verbal_ok", "3"), E("contacted", "1"), E("briefed", "2")]) == "agreed_unselected"  # 亂序依 ts
    assert ds([E("contacted", "1"), E("__bogus__", "2")]) == "contacted"     # 未知 kind 忽略


# ── 凍結守衛：wf-1.0 位元組不可變 ──
def test_wf_凍結hash():
    import tools.check_schema_freeze as f
    p = 根 / "schemas" / "workflow_schema.json"
    實際 = hashlib.sha256(p.read_bytes()).hexdigest()
    assert 實際 == f.FROZEN["schemas/workflow_schema.json"]
