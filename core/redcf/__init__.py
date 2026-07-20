# -*- coding: utf-8 -*-
"""
core/ — Urban Renewal Core Engine（計算核心，Single Source of Truth）
=====================================================
所有都市更新計算公式的唯一實作來源。UI（streamlit app.py）、未來的
Dashboard / Simulator / AI Copilot 一律消費此 package，不得自行重算。

模組分層：
  capacity   容積查核 + 獎勵驗核（L2–L4）
  efficiency 銷售坪效 + 開發評效（L4.5–L5）
  finance    都更全案投報六大共負（L6）
  valuation  更新前價值估算（L7）
  contract   對外 Project JSON 合約（中文 domain → 英文 key）
  templates  範本案件種子資料（demo / 測試）
  io         Excel/CSV 解析 + Markdown 報告

法規資料：law_db.py（root）。 對外合約 schema：schemas/project_schema.json。
"""

from core.redcf.capacity import (
    平方米換坪, 安全梯免計率, 樓層欄位,
    check_bonus_limit, calc_獎勵率合計, calc_容積查核,
)
from core.redcf.efficiency import calc_坪效, calc_開發評效
from core.redcf.finance import (
    財務率預設, calc_總銷, calc_共同負擔, calc_分回,
    calc_投報全案, calc_投報敏感度,
)
from core.redcf.valuation import (calc_更新前價值,
    load_coefficients, calc_戶價值, build_owner_matrix)
from core.redcf.rights import calc_權利變換, calc_找補, build_owner_allocations
from core.redcf.cashflow import calc_現金流分期
from core.redcf.workflow import validate_workflow, migrate_workflow, derive_consent_state
from core.redcf.decision import (decide, validate_decision, calc_完工機率,
    load_stage_tree, load_decision_config)
from core.redcf.allocation import calc_選配映射, validate_household_outcome
from core.redcf.contract import (
    SCHEMA_VERSION, build_result_json, build_project_json,
)
from core.redcf._version import CORE_VERSION
# M2 Core Interface：對外統一四動詞門面（不含公式，見 api.py）
from core.redcf.api import calculate, validate, serialize, deserialize
from core.redcf.recompute import recompute, verify, input_hash
from core.redcf.migrations import migrate

# ── 延遲匯入：templates / io 依賴 pandas（Excel/DataFrame 範本）。──────────────
# 計算主線（capacity…rights/decision/allocation）為純 stdlib，才能在 Pyodide（瀏覽器內
# Python，M5.5 B 軌）零 pandas 載入。範本/I-O 僅 Streamlit 端用，改 PEP 562 lazy——
# `from core.redcf import 範本參數` 仍可用，但只在真正取用時才拉 pandas。
_LAZY = {
    "範本參數": "templates", "範本案件類型": "templates", "範本獎勵拆解": "templates",
    "範本樓層表": "templates", "範本模式": "templates",
    "解析上傳": "io", "產生報告": "io",
}


def __getattr__(name):   # PEP 562
    mod = _LAZY.get(name)
    if mod is None:
        raise AttributeError(f"module 'core.redcf' has no attribute {name!r}")
    import importlib
    return getattr(importlib.import_module(f"core.redcf.{mod}"), name)

__all__ = [
    # 常數
    "平方米換坪", "安全梯免計率", "樓層欄位",
    # 容積（L2–L4）
    "check_bonus_limit", "calc_獎勵率合計", "calc_容積查核",
    # 坪效（L4.5–L5）
    "calc_坪效", "calc_開發評效",
    # 財務（L6）
    "財務率預設", "calc_總銷", "calc_共同負擔", "calc_分回",
    "calc_投報全案", "calc_投報敏感度",
    # 估值（L7）＋ B 系列更新前價值係數矩陣
    "calc_更新前價值", "load_coefficients", "calc_戶價值", "build_owner_matrix",
    # 權利變換／找補（M3）
    "calc_權利變換", "calc_找補", "build_owner_allocations", "calc_現金流分期",
    # 案件管理層（M3-C Workflow OS）
    "validate_workflow", "migrate_workflow", "derive_consent_state",
    # 決策引擎（M4 推論層）
    "decide", "validate_decision", "calc_完工機率", "load_stage_tree", "load_decision_config",
    # 傳動軸（M5.5 選配映射層）
    "calc_選配映射", "validate_household_outcome",
    # 合約
    "SCHEMA_VERSION", "CORE_VERSION", "build_result_json", "build_project_json",
    # M2 Core Interface（四動詞 + 可重算/遷移）
    "calculate", "validate", "serialize", "deserialize",
    "recompute", "verify", "input_hash", "migrate",
    # 範本 + I/O
    "範本參數", "範本案件類型", "範本獎勵拆解", "範本樓層表", "範本模式",
    "解析上傳", "產生報告",
]
