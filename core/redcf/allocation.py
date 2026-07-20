# -*- coding: utf-8 -*-
"""
core/redcf/allocation.py — M5.5 傳動軸・選配映射層（Core 層，非 UI）
====================================================================
憲法＝docs/architecture/DUAL_TRACK_DIRECTIVE.md PART A（A1.2/A1.3）。
把「規劃參數 × §56 逐戶權變」映射成逐戶居住現實（household_outcome[]）：

    分回權狀坪ᵢ   ＝ 分回價值ᵢ ÷ 每坪均價
    分回室內實坪ᵢ ＝ 分回權狀坪ᵢ × (1 − 公設比)      ← 案例C（攔胡原型）那一課
    可配單元ᵢ     ＝ 坪型組合中 單元總價 ≤ 分回價值ᵢ 的單元集合
    車位滿足ᵢ     ＝ 車位供給是否覆蓋（依權值序位）

沙盤意願函數只消費本層輸出，**不得自行推導坪數**（交接契約 C1）。
分回價值一律來自 Core result.owner_allocations（§56 權威），本層只做結構映射，
不重算權變、不重算財務；輸出以 household_outcome.schema.v0.1.json 驗證。
"""
import json
import pathlib

_根 = pathlib.Path(__file__).resolve().parents[2]
HO_SCHEMA_PATH = _根 / "schemas" / "household_outcome.schema.v0.1.json"

_複雜度合法 = {"clean", "inherited_unregistered", "joint_ownership", "mortgaged", "illegal_structure"}


def calc_選配映射(owner_allocations: list, 產品: dict, input_hash: str,
                  before_map: dict = None) -> list:
    """由 §56 權變輸出（verbatim）×產品參數 → household_outcome[]。

    owner_allocations：Core result 的逐戶權變（owner_id/value_share/return_value…）
    產品：{每坪均價(萬/坪), 公設比(0–1), 坪型組合:[{id, area_坪, count}], 車位數(int)}
    before_map：{owner_id: {registered_ping, common_area_ratio, floor, unit_type,
                            ownership_complexity?}}（更新前登記事實；可缺）
    """
    if not input_hash or not str(input_hash).startswith("sha256:"):
        raise ValueError("household_outcome 必須帶 input_hash 溯源（sha256:…）")
    均價 = float(產品["每坪均價"])
    if 均價 <= 0:
        raise ValueError("每坪均價需 > 0")
    公設比 = float(產品["公設比"])
    if not (0 <= 公設比 < 1):
        raise ValueError("公設比需在 [0,1)")
    坪型 = list(產品.get("坪型組合") or [])
    車位數 = int(產品.get("車位數", 0))
    before_map = before_map or {}

    # 車位覆蓋：依分回價值序位分配（價值高者先滿足；供給不足＝後位者 False）
    排序 = sorted(owner_allocations, key=lambda a: -(a.get("return_value") or 0))
    有位 = {a["owner_id"] for a in 排序[:max(0, 車位數)]}

    out = []
    for a in owner_allocations:
        oid = a["owner_id"]
        分回值 = float(a.get("return_value") or 0.0)
        權狀坪 = round(分回值 / 均價, 2)
        室內坪 = round(權狀坪 * (1 - 公設比), 2)
        可配 = [u["id"] for u in 坪型
                if float(u["area_坪"]) * 均價 <= 分回值 + 1e-9]
        b = dict(before_map.get(oid) or {})
        複雜度 = b.pop("ownership_complexity", "clean")
        if 複雜度 not in _複雜度合法:
            raise ValueError(f"未知 ownership_complexity：{複雜度}（schema enum 之外）")
        before = {"registered_ping": b.get("registered_ping"),
                  "common_area_ratio": b.get("common_area_ratio"),
                  "interior_ping": b.get("interior_ping",
                      round(b["registered_ping"] * (1 - b["common_area_ratio"]), 2)
                      if b.get("registered_ping") is not None and b.get("common_area_ratio") is not None
                      else None),
                  "floor": b.get("floor"), "unit_type": b.get("unit_type")}
        變化率 = (round((室內坪 - before["interior_ping"]) / before["interior_ping"], 4)
                  if before["interior_ping"] else None)
        out.append({
            "household_id": oid,
            "before": before,
            "after": {"value_share": float(a.get("value_share") or 0.0),
                      "allocated_value": 分回值,
                      "registered_ping": 權狀坪,
                      "common_area_ratio": 公設比,
                      "interior_ping": 室內坪,
                      "eligible_units": 可配,
                      "parking_satisfied": oid in 有位},
            "delta": {"interior_ping_change_pct": 變化率,
                      "can_be_allocated": len(可配) > 0},
            "ownership_complexity": 複雜度,
            "input_hash": input_hash,
        })
    ok, errs = validate_household_outcome(out)
    if not ok:
        raise ValueError("household_outcome 不符 schema v0.1：" + "; ".join(errs[:3]))
    return out


def validate_household_outcome(doc: list) -> tuple:
    """對 household_outcome.schema.v0.1.json 驗證。回傳 (ok, errors)。"""
    try:
        import jsonschema
    except ImportError:
        return (False, ["jsonschema 未安裝"])
    schema = json.loads(HO_SCHEMA_PATH.read_text(encoding="utf-8"))
    v = jsonschema.Draft7Validator(schema)
    errs = [f"{'/'.join(str(x) for x in e.path) or '(root)'}: {e.message}"
            for e in sorted(v.iter_errors(doc), key=lambda e: list(e.path))]
    return (len(errs) == 0, errs)
