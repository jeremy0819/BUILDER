# -*- coding: utf-8 -*-
"""tests/test_decision.py — M4 Decision Engine（DECISION_ENGINE_SPEC §8＋不變式）。
三個對抗性案例＝去識別化合成參數（案例A/B/C 原型），零真實資料。
通過＝模型「懂」都更破局模式，不只會算術。"""
import json
import pathlib
import pytest
from core.redcf.decision import (decide, validate_decision, calc_完工機率,
                                  load_stage_tree, load_decision_config, ENGINE_VERSION)

根 = pathlib.Path(__file__).resolve().parents[1]
HASH = "sha256:" + "ab" * 32


def _result(V=226089, c=0.66, V0=36000, n=48):
    """合成 Core result（verbatim 消費用；owner_allocations 只放 pre_value 供 V0 彙整）。"""
    per = V0 / n
    return {"total_sales": V, "shared_cost_ratio": c,
            "owner_allocations": [{"owner_id": f"W{i+1:02d}", "pre_value": per} for i in range(n)]}


def _wf(stage="S1", agreed=34, total=48, thr=1.0):
    return {"stage": stage, "input_hash": HASH,
            "consent": {"agreed": agreed, "total": total, "threshold": thr}}


IMPL = {"mgmt_fee": 14700, "advance": 3000, "operating": 1200}      # 全案管理原型（示意）
OUR = {"我方收入": 9000, "我方投入": 2500}


# ── 基礎不變式 ──

def test_輸出符合凍結schema():
    d = decide(_result(), _wf(), {**IMPL, **OUR})
    ok, errs = validate_decision(d)
    assert ok, errs
    assert d["decision_engine_version"] == ENGINE_VERSION
    assert d["input_hash"] == HASH                       # 可溯源鐵律
    assert d["sunk_cost_excluded"] is True


def test_完工機率_越早期越低():
    p1, T1 = calc_完工機率("S1")
    p8, T8 = calc_完工機率("S8")
    p11, _ = calc_完工機率("S11")
    assert 0.25 < p1 < 0.40           # 整合起算 ∏≈0.3（示意預設）
    assert p8 > p1 and p11 > p8 and T8 < T1
    assert calc_完工機率("S1", p_haircut=0.5)[0] == pytest.approx(p1 * 0.5)


def test_缺欄不臆造_insufficient_data():
    d = decide({"shared_cost_ratio": 0.66}, _wf(), {**IMPL, **OUR})   # 缺 total_sales/allocations
    assert d["ev"]["地主"]["status"] == "insufficient_data"
    assert d["ev"]["地主"]["ev"] is None and d["ev"]["地主"]["nominal"] is None
    assert d["verdict"] == "CAUTION"                      # 資訊不足不得妄斷
    assert "total_sales" in d["insufficient_fields"]


def test_沉沒成本防火牆_拒絕sunk_cost():
    with pytest.raises(ValueError):
        decide(_result(), _wf(), {**IMPL, **OUR, "sunk_cost": 5000})


def test_GO案存在_後期低V0():
    d = decide(_result(V0=20000), _wf(stage="S9", agreed=48, total=48), {**IMPL, **OUR})
    assert d["verdict"] == "GO" and d["breakpoint_stakeholder"] is None


def test_urgency_單調於同意缺口():
    d差 = decide(_result(), _wf(agreed=10, total=48), {**IMPL, **OUR})
    d近 = decide(_result(), _wf(agreed=46, total=48), {**IMPL, **OUR})
    assert d差["decision_urgency"] > d近["decision_urgency"]


def test_config標示紅線():
    assert "示意預設" in load_stage_tree()["_note"]
    assert "建模假設" in load_decision_config()["_note"] or "示意預設" in load_decision_config()["_note"]


# ── §8 三個對抗性案例（去識別化合成回歸）──

def test_CaseA_內爆型_蛋黃區EV不對稱():
    """案例A原型：蛋黃區 V0 高＋早期整合＋實施者全案管理（低資本）。
    斷言：地主 EV ≈0/負 AND 實施者 EV 正 → CAUTION，breakpoint=地主。"""
    d = decide(_result(V=226089, c=0.66, V0=60000),        # 蛋黃區：更新前值高
               _wf(stage="S1", agreed=30, total=48, thr=0.8),
               {"mgmt_fee": 14700, "advance": 1500, "operating": 1000, **OUR})
    assert d["ev"]["地主"]["ev"] <= 0                       # status quo 好 → 參與期望值不划算
    assert d["ev"]["實施者"]["ev"] > 0                      # 前期收費＋低資本 → 常為正
    assert d["verdict"] in ("CAUTION", "STOP")
    assert d["breakpoint_stakeholder"] == "地主"            # 破局引爆點＝地主


def test_CaseB_背信型_地價翻倍觸發exit():
    """案例B原型：合建＋前期關係專屬投資高＋地價 T0→T1 翻倍。
    斷言：地價漲後地主 status quo 跳升→引爆點；實施者套牢曝險→exit_signal 正確觸發。"""
    exit_in = {"marginal_investment": 4000,                 # 還要再墊的錢（邊際）
               "exit_recovery_now": 1200,                   # 現在退場可回收（關係專屬投資殘值低）
               "future_recovery": 25000}                    # 履約走完的回收
    共同 = {"mgmt_fee": 0, "profit_impl": 18000, "advance": 8000, "operating": 2000, **OUR}
    T0 = decide(_result(V0=30000), _wf(stage="S6"), {**共同, "exit": exit_in})
    T1 = decide(_result(V0=30000), _wf(stage="S6"),
                {**共同, "V0_scenario": 60000,              # 地價翻倍（情境假設，揭露於 assumptions）
                 "p_haircut": 0.45,                         # 背信風險→完工機率重擊
                 "exit": exit_in})
    assert T0["exit_signal"] is False                       # 地價未漲：繼續划算
    assert T1["exit_signal"] is True                        # 背信情境：止血優於續投
    assert T1["breakpoint_stakeholder"] == "地主"           # 地主背信 EV>履約 EV 的引爆點
    assert T1["assumptions"]["V0_scenario"] == 60000        # 情境假設全數揭露
    assert T1["completion_probability"] < T0["completion_probability"]


def test_CaseC_攔胡型_overpay高名目低期望():
    """案例C原型：對手「1坪換1坪」報價名目更高，但 overpay→財務脆弱→p 下降。
    斷言：對手名目 > 我方名目，但地主期望值反而更低（揭穿高報價煙霧彈）。"""
    我 = decide(_result(V=226089, c=0.66, V0=30000), _wf(stage="S5"), {**IMPL, **OUR})
    競 = decide(_result(V=226089, c=0.55, V0=30000),        # 對手少收共負＝名目分回更高
                _wf(stage="S5"), {**IMPL, **OUR, "p_haircut": 0.5})   # overpay→爛尾風險
    assert 競["ev"]["地主"]["nominal"] > 我["ev"]["地主"]["nominal"]   # 名目更漂亮
    assert 競["ev"]["地主"]["ev"] < 我["ev"]["地主"]["ev"]             # 期望值反而更差
    assert 競["completion_probability"] < 我["completion_probability"]
