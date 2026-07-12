# -*- coding: utf-8 -*-
"""
core/redcf/migrations.py — Project JSON 版本遷移器（M2-A）
==========================================================
遷移器只住在 Core（SCHEMA_STRATEGY §3）；消費端不得各自寫轉換邏輯。
鏈式：1.0 → 1.1 → 2.0 → 2.1。給任何舊版 doc，migrate() 回傳最新（2.1）形狀。

關鍵限制：v1.x 合約不含逐層 floors[]，故遷移後 result **保留但不可回放**
（input.input_complete = false）。要取得可重算的 v2 檔，需由 Core 端重新匯出
（帶 floors 的 engine 快照，見 tools/gen_examples_v2.py）。
"""
import hashlib
import json


def _hash_partial(input_block: dict) -> str:
    正規化 = json.dumps(input_block, sort_keys=True, ensure_ascii=False,
                        separators=(",", ":"), default=str)
    return "sha256:" + hashlib.sha256(正規化.encode("utf-8")).hexdigest()


def _1_0_to_1_1(doc: dict) -> dict:
    """1.0 → 1.1：補 result.warnings/computed_at/core_version、owners[] 佔位。
    1.0 檔無這些欄位；此處僅補結構、不重算（無公式）。真正的 warnings 需 Core 重算。
    """
    doc = dict(doc)
    doc["schema_version"] = "1.1"
    r = dict(doc.get("result", {}))
    r.setdefault("warnings", [])
    r.setdefault("computed_at", None)
    r.setdefault("core_version", "pre-1.1")
    doc["result"] = r
    doc.setdefault("owners", [])
    return doc


def _1_1_to_2_0(doc: dict) -> dict:
    """1.1 → 2.0：把扁平 land/building/finance 包進 input；缺 floors → input_complete=false。"""
    land = doc.get("land", {})
    building = doc.get("building", {})
    finance = doc.get("finance", {})
    owners = doc.get("owners", [])
    result = doc.get("result", {})

    inp = {
        "site": {
            "site_area_sqm": land.get("site_area_sqm", 0.0),
            "plaza_area_sqm": land.get("plaza_area_sqm", 0.0),
            "far": land.get("far", 0.0),
            "bonus_ratio": land.get("bonus_ratio", 0.0),
            "tdr_transfer_sqm": land.get("tdr_transfer_sqm", 0.0),
        },
        "building": {
            "public_ratio": building.get("public_ratio", 0.0),
            "stair_hall_exempt_pct": building.get("stair_hall_exempt_pct", 0),
            "balcony_exempt_pct": building.get("balcony_exempt_pct", 0),
            "unit_count": building.get("unit_count", 0),
        },
        "finance": dict(finance),
        "owners": list(owners),
        "scenario": {"name": "baseline",
                     "bonus_breakdown": dict(land.get("bonus_breakdown", {}))},
        "input_complete": False,   # v1.x 無 floors → 不可回放重算
    }
    return {
        "schema_version": "2.0",
        "project": {
            "name": doc.get("project", {}).get("name", ""),
            "case_type": doc.get("project", {}).get("renewal_type", "urban_renewal"),
        },
        "input": inp,
        "result": result,
        "provenance": {
            "core_version": result.get("core_version", "pre-1.1"),
            "computed_at": result.get("computed_at"),
            "input_hash": _hash_partial(inp),
            "law_db_version": "unknown-migrated",
        },
    }


def _2_0_to_2_1(doc: dict) -> dict:
    """2.0 → 2.1：純選填欄位新增（owners 逐戶欄位、result.owner_allocations），
    故遷移＝版號提升，結構不動。逐戶分回表需 Core 重算才會出現（recompute）。"""
    doc = dict(doc)
    doc["schema_version"] = "2.1"
    return doc


_CHAIN = {"1.0": _1_0_to_1_1, "1.1": _1_1_to_2_0, "2.0": _2_0_to_2_1}
_LATEST = "2.1"


def migrate(doc: dict) -> dict:
    """把任何舊版 doc 鏈式遷移到最新 schema（2.1）。已是最新則原樣回傳。"""
    doc = dict(doc)
    guard = 0
    while doc.get("schema_version") != _LATEST:
        ver = doc.get("schema_version", "1.0")
        step = _CHAIN.get(ver)
        if step is None:
            raise ValueError(f"無法遷移 schema_version={ver!r}（未知版本）")
        doc = step(doc)
        guard += 1
        if guard > 5:
            raise RuntimeError("遷移鏈疑似迴圈")
    return doc
