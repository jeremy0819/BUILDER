# -*- coding: utf-8 -*-
"""tests/test_strategy.py — M6 Strategy Engine（M6_STRATEGIST_SPEC §9＋不變式）。
三個對抗性案例＝去識別化合成參數（案例A/B/C 原型），零真實資料。
通過＝模型「懂」都更談判方向（先談誰／怎麼談／什麼絕不能做），不只會排序。

範圍界定（誠實）：v0.1 的結構化輸出＝型別→對策方向＋禁止動作＋雙佇列＋雪崩。
spec §9 更細的契約戰術（估價基準日鎖定、分配封閉化、corporate substance 證明）屬
narrative/文案層，記 v0.2；本檔斷言 v0.1 引擎實際編碼的『方向真理』。"""
import hashlib
import pathlib
import pytest
from core.redcf.strategy import (strategize, validate_strategy, validate_stakeholder_profiles,
                                  suggest_willingness_type, load_strategy_config,
                                  STRATEGY_ENGINE_VERSION, _ACTION_BY_TYPE)

根 = pathlib.Path(__file__).resolve().parents[1]
HASH = "sha256:" + "ab" * 32
_ACTIONS = set(_ACTION_BY_TYPE.values())


def _dec(breakpoint="地主"):
    return {"input_hash": HASH, "verdict": "CAUTION", "breakpoint_stakeholder": breakpoint}


def _wf(stakeholders, agreed=30, total=48, thr=0.8):
    return {"stakeholders": stakeholders, "input_hash": HASH,
            "consent": {"agreed": agreed, "total": total, "threshold": thr}}


def _pq(strat, hid):
    return next(x for x in strat["persuasion_queue"] if x["household_id"] == hid)


# ── 基礎不變式 ──

def test_輸出符合凍結schema():
    st = [{"stakeholder_id": "H1", "land_share": 0.03}]
    p = [{"household_id": "H1", "classification_source": "suggested",
          "signals_observed": ["demands_specific_terms"]}]
    d = strategize(_dec(), _wf(st), p)
    ok, errs = validate_strategy(d)
    assert ok, errs
    assert d["strategy_engine_version"] == STRATEGY_ENGINE_VERSION
    assert d["input_hash"] == HASH                        # 可溯源：指回 decision→Core
    assert d["provenance_note"] and "非投資結論" in d["provenance_note"]


def test_訊號映射型別_方向真理():
    assert suggest_willingness_type(["questioned_capital_adequacy", "repeated_same_question"]) == "fearful"
    assert suggest_willingness_type(["demands_specific_terms", "comparing_competitors"]) == "strategic"
    assert suggest_willingness_type(["refuses_to_discuss_terms", "emotional_attachment"]) == "opposed"
    assert suggest_willingness_type([]) == "unknown"                 # 缺訊號不猜
    assert suggest_willingness_type(["questioned_capital_adequacy",
                                     "demands_specific_terms"]) == "unknown"   # 平手不猜
    # more_doubtful_after_sweetener＝恐懼型最強訊號（加權）：單一即壓過對面單一
    assert suggest_willingness_type(["more_doubtful_after_sweetener", "demands_specific_terms"]) == "fearful"


def test_recorded_不被引擎覆寫():
    """整合人 recorded 為權威：即使訊號看似策略型，也不得被引擎改判。"""
    st = [{"stakeholder_id": "H1", "land_share": 0.03}]
    p = [{"household_id": "H1", "classification_source": "recorded", "willingness_type": "opposed",
          "signals_observed": ["demands_specific_terms"]}]   # 訊號像策略型，但已 recorded=反對型
    it = _pq(strategize(_dec(), _wf(st), p), "H1")
    assert it["willingness_type"] == "opposed" and it["classification_source"] == "recorded"


def test_缺訊號_unknown_不猜測():
    st = [{"stakeholder_id": "H1", "land_share": 0.03}]
    p = [{"household_id": "H1", "classification_source": "suggested"}]   # 無訊號
    it = _pq(strategize(_dec(), _wf(st), p), "H1")
    assert it["willingness_type"] == "unknown"
    assert it["recommended_action"] == "clarify_and_record"
    assert it["forbidden_actions"] == []


def test_引擎不重算_只需decision的input_hash():
    """§1 只消費不反算：decision 只給 input_hash 也能產策略（不依賴 EV/verdict 內容）。"""
    st = [{"stakeholder_id": "H1", "land_share": 0.03}]
    p = [{"household_id": "H1", "classification_source": "suggested",
          "signals_observed": ["emotional_attachment"]}]
    d = strategize({"input_hash": HASH}, _wf(st), p)
    assert d["input_hash"] == HASH


def test_increase_allocation_永不被建議():
    """結構保證：increase_allocation 只在 forbidden 值域，永不可能成為 recommended_action。"""
    assert "increase_allocation" not in _ACTIONS


# ── 雙軸模型：blocked＝行政工作量，與說服分流（§2）──

def test_blocked_分流至行政佇列_不進說服():
    st = [{"stakeholder_id": "H1", "land_share": 0.03}]
    p = [{"household_id": "H1", "classification_source": "recorded", "willingness_type": "fearful",
          "signability": "blocked", "blocking_reason": "mortgaged"}]
    d = strategize(_dec(), _wf(st), p)
    assert d["persuasion_queue"] == []                       # 就算恐懼型，blocked 也不進說服
    assert len(d["administrative_queue"]) == 1
    aq = d["administrative_queue"][0]
    assert aq["blocking_reason"] == "mortgaged" and aq["action"] == "mortgage_clearance"
    assert d["workload_split"] == {"persuasion_count": 0, "administrative_count": 1}


def test_可簽性由workflow_ownership_complexity導出():
    """wf-1.1 整合：profile 未給 signability，改由 workflow stakeholder 的 ownership_complexity 導出。"""
    st = [{"stakeholder_id": "H1", "land_share": 0.03, "ownership_complexity": "inherited_unregistered"}]
    p = [{"household_id": "H1", "classification_source": "suggested",
          "signals_observed": ["demands_specific_terms"]}]
    d = strategize(_dec(), _wf(st), p)
    assert d["persuasion_queue"] == []
    assert d["administrative_queue"][0]["action"] == "assist_inheritance_registration"


# ── §9 三個對抗性案例 ──

def test_CaseA_內爆型_恐懼戶禁止加碼_且雪崩高風險():
    """案例A原型：蛋黃區、全案管理低資本、關鍵戶質疑資本額（恐懼型）、觀望戶群受影響。
    斷言（★核心）：fearful suggested → institutional_guarantee；forbidden 必含 increase_allocation；
    反向雪崩 high 且輸出 surface_silent_supporters。"""
    st = [{"stakeholder_id": "H-key", "land_share": 0.09},
          {"stakeholder_id": "H-02", "land_share": 0.02},
          {"stakeholder_id": "H-03", "land_share": 0.02}]
    p = [
        {"household_id": "H-key", "classification_source": "suggested",
         "signals_observed": ["questioned_capital_adequacy", "repeated_same_question"],
         "is_key_household": True, "influence_targets": ["H-02", "H-03"]},
        {"household_id": "H-02", "classification_source": "recorded", "willingness_type": "opposed"},
        {"household_id": "H-03", "classification_source": "suggested",
         "signals_observed": ["status_quo_favorable", "no_urgency_long_horizon"]},
    ]
    d = strategize(_dec("地主"), _wf(st), p)
    key = _pq(d, "H-key")
    assert key["willingness_type"] == "fearful" and key["classification_source"] == "suggested"
    assert key["recommended_action"] == "institutional_guarantee"
    assert "increase_allocation" in key["forbidden_actions"]        # ★ 加碼＝禁止動作
    assert "questioned_capital_adequacy" in key["signals_used"]
    assert d["cascade_risk"] == "high"
    assert "surface_silent_supporters" in d["cascade_countermeasures"]
    assert "do_not_sweeten" in d["cascade_countermeasures"]


def test_CaseB_背信型_策略戶不給擔保而談判_不加碼():
    """案例B原型：合建、關鍵戶在關鍵時點以具體條件 hold-up（策略型，非恐懼型）。
    斷言：策略型 → time_limited_offer（談判），不得誤判為恐懼型給擔保；forbidden 含 reveal_urgency；
    結構上永不建議加碼換簽約。"""
    st = [{"stakeholder_id": "H-b", "land_share": 0.10}]
    p = [{"household_id": "H-b", "classification_source": "suggested",
          "signals_observed": ["demands_specific_terms", "raised_at_critical_moment"],
          "is_key_household": True}]
    d = strategize(_dec("地主"), _wf(st), p)
    it = _pq(d, "H-b")
    assert it["willingness_type"] == "strategic"
    assert it["recommended_action"] == "time_limited_offer"
    assert it["recommended_action"] != "institutional_guarantee"    # 背信≠恐懼，給擔保沒用
    assert "reveal_urgency" in it["forbidden_actions"]
    assert all(x["recommended_action"] in _ACTIONS for x in d["persuasion_queue"])   # 無加碼類建議


def test_CaseC_攔胡型_對手競標不無條件跟進():
    """案例C原型：簽約前對手競爭報價，地主比較同業、隨條件軟化（策略型）。
    斷言：策略型 → time_limited_offer（限時＋第三方估價方向）；forbidden 含 reveal_urgency；
    不得無條件加碼跟進（continue_sweetening/increase_allocation 皆非建議動作）。"""
    st = [{"stakeholder_id": "H-c", "land_share": 0.06}]
    p = [{"household_id": "H-c", "classification_source": "suggested",
          "signals_observed": ["comparing_competitors", "softens_with_terms"]}]
    d = strategize(_dec("實施者"), _wf(st), p)
    it = _pq(d, "H-c")
    assert it["willingness_type"] == "strategic"
    assert it["recommended_action"] == "time_limited_offer"
    assert "reveal_urgency" in it["forbidden_actions"]
    # 對手 overpay 煙霧彈：引擎不得回敬加碼（結構上 recommended 值域內無加碼）
    assert it["recommended_action"] not in ("increase_allocation", "continue_sweetening")


# ── 先談誰優先序（§6）──

def test_優先序_關鍵高權值恐懼戶_勝過低權值反對戶():
    st = [{"stakeholder_id": "H-hi", "land_share": 0.09},
          {"stakeholder_id": "H-lo", "land_share": 0.01}]
    p = [
        {"household_id": "H-hi", "classification_source": "suggested",
         "signals_observed": ["questioned_capital_adequacy"], "is_key_household": True},
        {"household_id": "H-lo", "classification_source": "recorded", "willingness_type": "opposed"},
    ]
    d = strategize(_dec(), _wf(st), p)
    assert _pq(d, "H-hi")["rank"] == 1
    assert _pq(d, "H-hi")["priority_score"] > _pq(d, "H-lo")["priority_score"]


def test_convertibility_排序為領域真理():
    """幅度歸 config，但排序 fearful > strategic > opposed 為方向真理，回歸鎖住。"""
    cs = load_strategy_config()["convertibility_score"]
    assert cs["fearful"] > cs["strategic"] > cs["opposed"]


def test_config標示紅線():
    assert load_strategy_config()["_note"]


# ── profile 輸入契約驗證 ──

def test_profile_schema_驗證():
    ok, _ = validate_stakeholder_profiles(
        [{"household_id": "H1", "classification_source": "recorded", "willingness_type": "fearful"}])
    assert ok
    bad, errs = validate_stakeholder_profiles(
        [{"household_id": "H1", "classification_source": "recorded", "willingness_type": "詐騙型"}])
    assert not bad and any("willingness_type" in e for e in errs)


def test_profile_壞訊號列舉被擋():
    ok, errs = validate_stakeholder_profiles(
        [{"household_id": "H1", "classification_source": "suggested", "signals_observed": ["賄賂"]}])
    assert not ok


# ── 凍結守衛：strategy / stakeholder_profile schema 位元組不可變 ──

def test_strategy_schema_凍結hash():
    import tools.check_schema_freeze as f
    for rel in ("schemas/strategy.schema.v0.1.json", "schemas/stakeholder_profile.schema.v0.1.json"):
        實際 = hashlib.sha256((根 / rel).read_bytes()).hexdigest()
        assert 實際 == f.FROZEN[rel], f"{rel} 凍結 hash 不符"
