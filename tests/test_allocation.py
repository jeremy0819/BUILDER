# -*- coding: utf-8 -*-
"""tests/test_allocation.py — M5.5 傳動軸・選配映射層（DUAL_TRACK A1）。
鎖住：映射公式、schema 驗證、決定性、input_hash 溯源，
以及 C2 七條方向斷言中屬於 Core 層的坪數面（D2/D3/D4/D6 的機制根、D5 的餅）。"""
import json
import pathlib
import pytest
from core.redcf.allocation import calc_選配映射, validate_household_outcome

根 = pathlib.Path(__file__).resolve().parents[1]
HASH = "sha256:" + "cd" * 32


def _allocs(n=4, base=2000.0):
    return [{"owner_id": f"W{i+1:02d}", "value_share": 1.0 / n,
             "return_value": base * (1 + i * 0.5), "pre_value": 1000.0} for i in range(n)]


產品 = {"每坪均價": 74.0, "公設比": 0.34,
        "坪型組合": [{"id": "A", "area_坪": 25, "count": 10}, {"id": "B", "area_坪": 45, "count": 10}],
        "車位數": 2}


def test_映射公式_權狀與室內坪():
    ho = calc_選配映射(_allocs(), 產品, HASH)
    h = ho[0]                                     # 分回 2000 萬
    assert h["after"]["registered_ping"] == pytest.approx(2000 / 74.0, abs=0.01)
    assert h["after"]["interior_ping"] == pytest.approx(round(2000 / 74.0, 2) * 0.66, abs=0.01)
    assert h["after"]["common_area_ratio"] == 0.34
    assert h["input_hash"] == HASH                # 可溯源鐵律


def test_schema驗證通過且凍結欄位齊全():
    ho = calc_選配映射(_allocs(), 產品, HASH)
    ok, errs = validate_household_outcome(ho)
    assert ok, errs


def test_D2_公設比升_全體室內實坪降():
    低 = calc_選配映射(_allocs(), {**產品, "公設比": 0.33}, HASH)
    高 = calc_選配映射(_allocs(), {**產品, "公設比": 0.38}, HASH)
    for a, b in zip(低, 高):
        assert b["after"]["interior_ping"] < a["after"]["interior_ping"]
        assert b["after"]["registered_ping"] == a["after"]["registered_ping"]   # 權狀不變、實坪縮水（煙霧彈機制）


def test_D3_配不到單元_can_be_allocated_False():
    小分回 = [{"owner_id": "W01", "value_share": 1.0, "return_value": 500.0}]   # 500 萬買不到 25 坪×74
    ho = calc_選配映射(小分回, 產品, HASH)
    assert ho[0]["after"]["eligible_units"] == []
    assert ho[0]["delta"]["can_be_allocated"] is False


def test_D4_車位覆蓋依權值序位():
    ho = calc_選配映射(_allocs(4), {**產品, "車位數": 2}, HASH)
    滿足 = {h["household_id"]: h["after"]["parking_satisfied"] for h in ho}
    # 權值最高的兩戶（W03/W04 分回最高）有位；前兩戶沒位
    assert 滿足["W04"] and 滿足["W03"] and not 滿足["W01"] and not 滿足["W02"]


def test_D5_分回值升_可配單元不減():
    ho = calc_選配映射(_allocs(), 產品, HASH)
    assert len(ho[3]["after"]["eligible_units"]) >= len(ho[0]["after"]["eligible_units"])


def test_D6機制根_分回值降_權狀室內同降():
    高值 = calc_選配映射([{"owner_id": "W01", "value_share": 1.0, "return_value": 3000.0}], 產品, HASH)
    低值 = calc_選配映射([{"owner_id": "W01", "value_share": 1.0, "return_value": 2400.0}], 產品, HASH)
    assert 低值[0]["after"]["registered_ping"] < 高值[0]["after"]["registered_ping"]
    assert 低值[0]["after"]["interior_ping"] < 高值[0]["after"]["interior_ping"]


def test_before與delta_案例C攔胡課():
    before = {"W01": {"registered_ping": 30.0, "common_area_ratio": 0.08, "floor": 1, "unit_type": "店面"}}
    ho = calc_選配映射([{"owner_id": "W01", "value_share": 1.0, "return_value": 2702.12}],
                       產品, HASH, before)
    h = ho[0]
    assert h["before"]["interior_ping"] == pytest.approx(27.6, abs=0.01)      # 舊 8% 公設
    assert h["after"]["interior_ping"] < h["before"]["interior_ping"]          # 名目升、實坪縮
    assert h["delta"]["interior_ping_change_pct"] < 0


def test_產權複雜度_合法enum與預設clean():
    before = {"W01": {"ownership_complexity": "joint_ownership"}}
    ho = calc_選配映射(_allocs(1), 產品, HASH, before)
    assert ho[0]["ownership_complexity"] == "joint_ownership"
    assert calc_選配映射(_allocs(1), 產品, HASH)[0]["ownership_complexity"] == "clean"
    with pytest.raises(ValueError):
        calc_選配映射(_allocs(1), 產品, HASH, {"W01": {"ownership_complexity": "weird"}})


def test_無hash拒產出_決定性():
    with pytest.raises(ValueError):
        calc_選配映射(_allocs(), 產品, "")
    a = calc_選配映射(_allocs(), 產品, HASH)
    b = calc_選配映射(_allocs(), 產品, HASH)
    assert a == b


def test_真實範例D_整條鏈跑通():
    ex = json.loads((根 / "schemas/examples/v2/v2_1_案例D_權變示範.json").read_text(encoding="utf-8"))
    ho = calc_選配映射(ex["result"]["owner_allocations"], 產品, ex["provenance"]["input_hash"])
    assert len(ho) == 48
    ok, errs = validate_household_outcome(ho)
    assert ok, errs
    assert all(h["input_hash"] == ex["provenance"]["input_hash"] for h in ho)
