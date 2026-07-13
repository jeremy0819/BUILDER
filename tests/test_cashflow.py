# -*- coding: utf-8 -*-
"""
tests/test_cashflow.py — 現金流分期（M3 結構性第一版）黃金測試
==============================================================
鎖算術不變式：守恆（Σ期別＝科目總額＝峰值）、權重正規化、累積單調遞增、
均勻預設標記 structural。科目金額用合成 dict——不依賴校準費率。
"""
import pytest

from core.redcf.cashflow import calc_現金流分期

# 合成投報科目（虛構）：A 9000 / D 500 / F 500 → 總額 10000 萬
_投 = {"A工程費用": 9000.0, "B管維費用": 0.0, "C權變費用": 0.0,
       "D貸款利息": 500.0, "E稅捐": 0.0, "F管理費用": 500.0, "G土地成本": 0.0}


def test_守恆_均勻分佈():
    cf = calc_現金流分期(_投, 期數=8)
    assert cf["structural"] is True
    assert len(cf["期別出資"]) == 8
    assert abs(sum(cf["期別出資"]) - 10000.0) < 0.01       # Σ期別 = 總額
    assert abs(cf["峰值資金"] - 10000.0) < 0.01            # 峰值 = 總額
    assert cf["科目"] == {"A工程費用": 9000.0, "D貸款利息": 500.0, "F管理費用": 500.0}


def test_累積單調遞增():
    cf = calc_現金流分期(_投, 期數=6)
    assert all(b >= a for a, b in zip(cf["累積"], cf["累積"][1:]))
    assert cf["累積"][-1] == cf["峰值資金"]


def test_自訂權重_正規化與守恆():
    cf = calc_現金流分期(_投, 期數=4, 權重=[1, 2, 4, 1])   # 未正規化輸入
    assert cf["structural"] is False
    assert abs(sum(cf["期別出資"]) - 10000.0) < 0.01
    assert cf["期別出資"][2] > cf["期別出資"][0]            # 權重大→出資多
    assert abs(cf["期別出資"][1] - 2500.0) < 0.01           # 2/8 × 10000


def test_參數防呆():
    with pytest.raises(ValueError):
        calc_現金流分期(_投, 期數=0)
    with pytest.raises(ValueError):
        calc_現金流分期(_投, 期數=3, 權重=[1, 1])            # 長度不符
    with pytest.raises(ValueError):
        calc_現金流分期(_投, 期數=2, 權重=[0, 0])            # Σ=0


def test_真實鏈路_案例A():
    """從 v2 範例 engine 走完整鏈：recompute 投報 → 現金流守恆到共同負擔。"""
    import json, pathlib
    根 = pathlib.Path(__file__).resolve().parents[1]
    d = json.load(open(根 / "schemas" / "examples" / "v2" / "v2_案例A_都更全案管理.json",
                       encoding="utf-8"))
    from core.redcf.recompute import _組p
    from core.redcf import calc_容積查核, calc_坪效, calc_投報全案, 平方米換坪
    e = d["engine"]; P = e["params"]
    容 = calc_容積查核(P, e["floors"])
    坪 = calc_坪效(容["允建容積"], 容["陽台免計面積"], P["公設比"])
    投 = calc_投報全案(坪["銷售坪數"], 容["總樓地板面積"] / 平方米換坪, _組p(P), e["mode"])
    cf = calc_現金流分期(投, 期數=8)
    assert abs(cf["峰值資金"] - 投["共同負擔"]) < 1.0        # 峰值 = Core 共同負擔
