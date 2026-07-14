# -*- coding: utf-8 -*-
"""
core/redcf/workflow.py — 案件管理層（Workflow OS）合約工具（M3-C・C1）
========================================================================
Workflow 域是**獨立版本軸**（wf-*），與計算合約（project_schema_v2_1）分檔分版。
本模組是 wf 域的**單一驗證/遷移點**（比照 SCHEMA_STRATEGY「遷移器只住 Core」；
因 wf 與計算合約的遷移鏈不同，另立函式而非併入 migrations.migrate）。

**紅線遵循**：
  - 不含任何**財務公式**（SSOT 不變）：本層只做結構驗證與版號遷移。
  - 財務數字不存於 wf 檔——只以 snapshot_ref 的 input_hash@core_version 引用 v2.1 計算檔。
  - 真實 PII 永不進版控：schema 僅收匿名代號（stakeholder_id）。

C1 範圍：schema 驗證 + 遷移骨架。同意狀態機（事件流重放推導）屬 C3，不在此。
"""
import json
import pathlib

_根 = pathlib.Path(__file__).resolve().parents[2]
WF_SCHEMA = _根 / "schemas" / "workflow_schema.json"
WF_LATEST = "wf-1.0"


def validate_workflow(doc: dict) -> tuple:
    """結構驗證 wf 檔。回傳 (ok: bool, errors: list[str])。需 jsonschema。"""
    try:
        import jsonschema
    except ImportError:
        return (False, ["jsonschema 未安裝，無法驗證"])
    schema = json.load(open(WF_SCHEMA, encoding="utf-8"))
    v = jsonschema.Draft7Validator(schema)
    errors = []
    for e in sorted(v.iter_errors(doc), key=lambda e: list(e.path)):
        路徑 = "/".join(str(x) for x in e.path) or "(root)"
        errors.append(f"[wf-schema] {路徑}: {e.message}")
    return (len(errors) == 0, errors)


# wf 遷移鏈（現只有 wf-1.0；未來版本在此擴充，維持單一遷移點）
_WF_CHAIN = {}   # 例：{"wf-1.0": _wf_1_0_to_1_1}


def migrate_workflow(doc: dict) -> dict:
    """把任何舊版 wf 檔鏈式遷移到最新（wf-1.0）。已是最新則原樣回傳。"""
    doc = dict(doc)
    guard = 0
    while doc.get("schema_version") != WF_LATEST:
        ver = doc.get("schema_version")
        step = _WF_CHAIN.get(ver)
        if step is None:
            raise ValueError(f"無法遷移 wf schema_version={ver!r}（未知版本）")
        doc = step(doc)
        guard += 1
        if guard > 5:
            raise RuntimeError("wf 遷移鏈疑似迴圈")
    return doc


def derive_consent_state(events: list) -> str:
    """（C3 預留）由 append-only 事件流推導單一 stakeholder 的目前同意狀態。
    C1 僅放最小骨架供合約引用；完整五態狀態機與不變式測試在 C3 實作。"""
    order = {"untouched": 0, "contacted": 1, "negotiating": 2,
             "agreed_unselected": 3, "agreed_selected": 4, "declined": 1}
    state = "untouched"
    kind2state = {
        "contacted": "contacted", "visited": "negotiating", "briefed": "contacted",
        "verbal_ok": "agreed_unselected", "signed": "agreed_unselected",
        "selected_unit": "agreed_selected", "declined": "declined",
        "withdrawn": "negotiating",
    }
    for ev in sorted(events, key=lambda e: e.get("ts", "")):
        nxt = kind2state.get(ev.get("kind"))
        if nxt is None:
            continue
        # 前進為主；withdrawn/declined 例外覆寫
        if ev["kind"] in ("withdrawn", "declined") or order.get(nxt, 0) >= order.get(state, 0):
            state = nxt
    return state
