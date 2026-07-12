# -*- coding: utf-8 -*-
"""
tests/test_api.py — Core Interface 四動詞 + v2 視圖 schema 驗收（M2 close）
==========================================================================
確認 calculate/validate/serialize/deserialize 為穩定門面，且三視圖
（input/output/metadata）可各自驗證、跨檔 $ref 解析到單一權威檔。
本層不驗算公式（那在 test_golden / test_schema_v2）——只驗介面契約。
"""
import glob
import json
import pathlib

import pytest

根 = pathlib.Path(__file__).resolve().parents[1]
V2_FILES = sorted(glob.glob(str(根 / "schemas" / "examples" / "v2" / "*.json")))


def _load(p):
    return json.load(open(p, encoding="utf-8"))


def test_四動詞可從套件根匯入():
    from core.redcf import calculate, validate, serialize, deserialize  # noqa: F401


@pytest.mark.parametrize("path", V2_FILES, ids=[pathlib.Path(p).stem for p in V2_FILES])
def test_calculate_等於檔內result(path):
    """calculate(engine) 應完全重現檔內 result（門面不改數字）。"""
    from core.redcf import calculate
    doc = _load(path)
    r = calculate(doc["engine"], doc["result"].get("computed_at"))
    for k, v in doc["result"].items():
        if isinstance(v, (int, float)):
            assert abs(r[k] - v) < 0.5, f"{k}: {r[k]} vs {v}"


@pytest.mark.parametrize("path", V2_FILES, ids=[pathlib.Path(p).stem for p in V2_FILES])
def test_validate_整份與三視圖皆通過(path):
    from core.redcf import validate
    doc = _load(path)
    ok, errs = validate(doc)
    assert ok, f"full 驗證失敗：{errs}"
    for view in ("input", "output", "metadata"):
        ok, errs = validate(doc, view=view)
        assert ok, f"view={view} 驗證失敗：{errs}"


def test_validate_抓出壞output():
    """輸出視圖應擋掉型別錯誤（消費端契約真的在把關）。"""
    from core.redcf import validate
    bad = {"result": {"efficiency_ratio": "not-a-number"}}
    ok, errs = validate(bad, view="output", recompute_check=False)
    assert not ok and any("efficiency_ratio" in e for e in errs)


def test_validate_抓出無法回放的result():
    """竄改 result 數字後，recompute_check 應判定不可回放。"""
    from core.redcf import validate
    doc = _load(V2_FILES[0])
    doc["result"] = dict(doc["result"], allow_floor_area=doc["result"]["allow_floor_area"] + 999)
    ok, errs = validate(doc)
    assert not ok and any("recompute" in e for e in errs)


def test_serialize_deserialize_roundtrip():
    from core.redcf import serialize, deserialize
    doc = _load(V2_FILES[0])
    back = deserialize(serialize(doc))
    assert back["schema_version"] == "2.1"        # deserialize 正規化到最新
    assert back["provenance"]["input_hash"] == doc["provenance"]["input_hash"]


def test_deserialize_自動遷移舊版():
    """給 v1.1 檔，deserialize 預設遷移到最新（2.1）形狀。"""
    from core.redcf import deserialize
    v1 = _load(根 / "schemas" / "examples" / "合成案例C_防災都更_容積超出.json")
    assert v1["schema_version"] == "1.1"
    out = deserialize(v1)
    assert out["schema_version"] == "2.1"
    assert out["input"]["input_complete"] is False


def test_schema_凍結守衛():
    """凍結 schema 的 sha256 必須與基準相符（位元組不可變紅線）。"""
    import tools.check_schema_freeze as f
    import hashlib
    for 相對, 基準 in f.FROZEN.items():
        實際 = hashlib.sha256((根 / 相對).read_bytes()).hexdigest()
        assert 實際 == 基準, f"{相對} 凍結違規：{實際} != {基準}"
