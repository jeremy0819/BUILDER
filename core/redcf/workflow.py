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
WF_SCHEMA_V1_0 = _根 / "schemas" / "workflow_schema.json"        # wf-1.0（凍結）
WF_SCHEMA_V1_1 = _根 / "schemas" / "workflow_schema_v1_1.json"   # wf-1.1（凍結；純新增 stakeholder 可簽性欄）
WF_LATEST = "wf-1.1"
# 各版對應權威 schema 檔（比照計算合約 test_schema_v2 依 schema_version 分流；同時支援 1.0/1.1）
_WF_SCHEMA_BY_VERSION = {"wf-1.0": WF_SCHEMA_V1_0, "wf-1.1": WF_SCHEMA_V1_1}
WF_SCHEMA = WF_SCHEMA_V1_1   # 舊名保留＝最新（向後相容匯入者）

# 可簽性軸來源（M6 §2）：非 clean 的四種產權瑕疵＝blocked 的原因值域
_BLOCKING_REASONS = ("inherited_unregistered", "joint_ownership", "mortgaged", "illegal_structure")


def _resolve_wf_schema(doc: dict) -> pathlib.Path:
    """依 doc 自報 schema_version 選權威檔；未知/缺→用最新（讓 const 明確報錯）。"""
    return _WF_SCHEMA_BY_VERSION.get((doc or {}).get("schema_version"), WF_SCHEMA_V1_1)


def validate_workflow(doc: dict) -> tuple:
    """結構驗證 wf 檔（依 doc 版本選對應凍結 schema）。回傳 (ok, errors)。需 jsonschema。"""
    try:
        import jsonschema
    except ImportError:
        return (False, ["jsonschema 未安裝，無法驗證"])
    schema = json.load(open(_resolve_wf_schema(doc), encoding="utf-8"))
    v = jsonschema.Draft7Validator(schema)
    errors = []
    for e in sorted(v.iter_errors(doc), key=lambda e: list(e.path)):
        路徑 = "/".join(str(x) for x in e.path) or "(root)"
        errors.append(f"[wf-schema] {路徑}: {e.message}")
    return (len(errors) == 0, errors)


def derive_signability(ownership_complexity):
    """由產權事實（M5.5 ownership_complexity）導出 M6 §2 可簽性軸，回傳 (signability, blocking_reason)。

    領域真理（**方向鎖於此＋回歸測試**；幅度/文案屬 config，不在此）：
      clean            → ("signable", None)
      其餘四種產權瑕疵  → ("blocked", 該原因)
      None（未知）      → (None, None)   # 不臆造未知，留待整合人 recorded（M6 §4 缺訊號不猜測）

    非財務公式（SSOT 不變）：純結構映射，供 M6 由 recorded 事實填 signability，不得由 UI 自算。"""
    if ownership_complexity is None:
        return (None, None)
    if ownership_complexity == "clean":
        return ("signable", None)
    if ownership_complexity in _BLOCKING_REASONS:
        return ("blocked", ownership_complexity)
    raise ValueError(f"未知 ownership_complexity={ownership_complexity!r}")


def _wf_1_0_to_1_1(doc: dict) -> dict:
    """wf-1.0 → wf-1.1：純新增選填欄位（stakeholder 可簽性軸），僅升版號。
    不回填 ownership_complexity/signability——未知＝不臆造（M6 §4），留待整合人 recorded。"""
    doc = dict(doc)
    doc["schema_version"] = "wf-1.1"
    return doc


# wf 遷移鏈（source_version → 升一版函式；維持單一遷移點）
_WF_CHAIN = {"wf-1.0": _wf_1_0_to_1_1}


def migrate_workflow(doc: dict) -> dict:
    """把任何舊版 wf 檔鏈式遷移到最新（WF_LATEST）。已是最新則原樣回傳。"""
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
    """（C3）由 append-only 事件流「重放」推導單一 stakeholder 的目前同意狀態。
    純狀態推導、非財務公式；web 版 WORKLOGIC.deriveConsentState 為其鏡像，
    以 test_workflow.py 與 tests/web/test_workspace.mjs 的同一組正典序列鎖住兩者一致。"""
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
