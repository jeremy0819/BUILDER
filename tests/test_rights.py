# -*- coding: utf-8 -*-
"""
tests/test_rights.py — 權利變換分配／找補 黃金測試（M3 slice 1）
================================================================
用合成 owners（非真實案件）鎖 §56 比例分配與找補的算術不變式：
  · Σ權值比例 = 1；Σreturn_value = 更新後可分配總值（守恆）
  · pre_value 越高分回越多（單調）
  · equalization = 選配 − 分回（正=補入/負=找出）
不含任何校準費率——pre_value 為輸入，係數擴充待使用者核准（見 rights.py 註）。
"""
from core.redcf import calc_權利變換, calc_找補, build_owner_allocations

# 合成三戶（虛構）：權利價值 3:2:1，更新後可分配總值 6000 萬
_OWNERS = [
    {"owner_id": "A", "land_share": 0.5, "pre_value": 3000.0},
    {"owner_id": "B", "land_share": 0.3, "pre_value": 2000.0},
    {"owner_id": "C", "land_share": 0.2, "pre_value": 1000.0},
]
_可分配 = 6000.0


def test_權值比例_合計為一():
    alloc = calc_權利變換(_OWNERS, _可分配)
    assert abs(sum(o["權值比例"] for o in alloc) - 1.0) < 1e-9


def test_分回_守恆且比例正確():
    alloc = calc_權利變換(_OWNERS, _可分配)
    d = {o["owner_id"]: o["return_value"] for o in alloc}
    # 3:2:1 → 3000/2000/1000
    assert d == {"A": 3000.0, "B": 2000.0, "C": 1000.0}
    assert abs(sum(d.values()) - _可分配) < 0.5      # 守恆


def test_分回_隨權利價值單調():
    alloc = {o["owner_id"]: o["return_value"] for o in calc_權利變換(_OWNERS, _可分配)}
    assert alloc["A"] > alloc["B"] > alloc["C"]


def test_找補_正補入負找出():
    alloc = calc_權利變換(_OWNERS, _可分配)
    # A 選配 3500（>分回3000→補入+500）；B 選配 1800（<分回2000→找出−200）；C 未選配
    eq = {o["owner_id"]: o["equalization"]
          for o in calc_找補(alloc, {"A": 3500.0, "B": 1800.0})}
    assert eq["A"] == 500.0
    assert eq["B"] == -200.0
    assert eq["C"] is None            # 未選配 → 待輸入，不臆測


def test_build_owner_allocations_一步到位():
    rows = build_owner_allocations(_OWNERS, _可分配, {"A": 3000.0})
    a = next(o for o in rows if o["owner_id"] == "A")
    assert a["return_value"] == 3000.0 and a["equalization"] == 0.0


def test_零估值不臆測():
    zero = [{"owner_id": "X", "pre_value": 0.0}, {"owner_id": "Y", "pre_value": 0.0}]
    alloc = calc_權利變換(zero, _可分配)
    assert all(o["return_value"] == 0.0 and o["權值比例"] == 0.0 for o in alloc)


# ── v2.1 範例：owner_allocations 可由 engine 回放（黃金判準延伸到逐戶）──
import json
import pathlib

根 = pathlib.Path(__file__).resolve().parents[1]
_V21 = 根 / "schemas" / "examples" / "v2" / "v2_1_案例D_權變示範.json"


def test_v2_1_逐戶分回_可回放():
    """recompute(engine) 的 owner_allocations 應與 v2.1 檔內存檔逐戶相等。"""
    from core.redcf import calculate
    doc = json.load(open(_V21, encoding="utf-8"))
    r = calculate(doc["engine"], doc["result"]["computed_at"])
    assert r["owner_allocations"] == doc["result"]["owner_allocations"]


def test_v2_1_逐戶守恆與找補():
    doc = json.load(open(_V21, encoding="utf-8"))
    al = doc["result"]["owner_allocations"]
    assert len(al) == 48
    assert abs(sum(a["return_value"] for a in al) - doc["result"]["owner_return_value"]) < 0.5
    w01 = next(a for a in al if a["owner_id"] == "W01")
    w02 = next(a for a in al if a["owner_id"] == "W02")
    w05 = next(a for a in al if a["owner_id"] == "W05")
    assert w01["equalization"] > 0 > w02["equalization"]   # 補入／找出
    assert w05.get("equalization") is None                 # 未選配＝待輸入
    # 無 OWNERS_VALUE_MISMATCH（Σpre_value 錨定更新前總值）
    assert "OWNERS_VALUE_MISMATCH" not in [w["code"] for w in doc["result"]["warnings"]]


def test_v2_1_通過_api_validate():
    """api.validate 對 2.1 檔選 v2_1 權威檔；結構＋可重算雙驗證全過。"""
    from core.redcf import validate
    doc = json.load(open(_V21, encoding="utf-8"))
    ok, errs = validate(doc)
    assert ok, errs
