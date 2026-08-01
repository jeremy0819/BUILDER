# -*- coding: utf-8 -*-
"""tests/test_timeline.py — M7.2 Watchtower（M7_CASE_OS_SPEC §6）。

鎖住的紀律：
  1. **statute 必附 legal_basis** —— 禁止把經驗值偽裝成法定期限。
  2. **72hr 風險窗是 heuristic**，輸出必須標示來源、允許被推翻。
  3. Timeline 是**衍生視圖**：不新增第三份資料、不改寫來源。
  4. **不記推論**：輸出只有日期算術（逾期幾天／剩幾天），無 EV/verdict/IRR。
  5. 排序：逾期 → 風險窗 → 快到期 → 未來。
零真實資料：里程碑名稱為通用程序名，無段名/姓名。"""
import datetime as dt
import pytest
from core.redcf import build_today, build_timeline, classify_milestone, validate_milestones

TODAY = "2026-07-31"


def _ms():
    return [
        {"milestone_id": "ms-1", "title": "公聽會通知期限", "due": "2026-07-20",
         "source": "statute", "legal_basis": "都市更新條例 §32", "stage": "S5"},
        {"milestone_id": "ms-2", "title": "審議前補件", "due": "2026-08-02",
         "source": "plan", "risk_window_hr": 72, "stage": "S8"},
        {"milestone_id": "ms-3", "title": "估價師遴選", "due": "2026-08-10", "source": "plan"},
        {"milestone_id": "ms-4", "title": "開工前置", "due": "2026-11-01", "source": "plan"},
        {"milestone_id": "ms-5", "title": "已完成項", "due": "2026-07-01",
         "source": "plan", "status": "done"},
    ]


# ── 1. 規則出處紀律 ──

def test_statute_必附法源否則被擋():
    """★ 禁止把經驗值偽裝成法定期限。"""
    ok, errs = validate_milestones(
        [{"milestone_id": "x", "title": "某期限", "due": "2026-09-01", "source": "statute"}])
    assert not ok and any("legal_basis" in e for e in errs)


def test_statute_附法源即通過():
    ok, errs = validate_milestones(
        [{"milestone_id": "x", "title": "某期限", "due": "2026-09-01",
          "source": "statute", "legal_basis": "都市更新條例 §32"}])
    assert ok, errs


def test_plan與heuristic_不需法源():
    ok, _ = validate_milestones(
        [{"milestone_id": "p", "title": "自訂", "due": "2026-09-01", "source": "plan"},
         {"milestone_id": "h", "title": "經驗", "due": "2026-09-01", "source": "heuristic"}])
    assert ok


def test_source為必填():
    ok, errs = validate_milestones([{"milestone_id": "x", "title": "無出處", "due": "2026-09-01"}])
    assert not ok and any("source" in e for e in errs)


def test_未知source被擋():
    ok, _ = validate_milestones(
        [{"milestone_id": "x", "title": "t", "due": "2026-09-01", "source": "我覺得"}])
    assert not ok


# ── 2. 風險窗＝heuristic，必須標示 ──

def test_風險窗標示為heuristic且可被推翻():
    r = classify_milestone(_ms()[1], today=TODAY)
    assert r["urgency"] == "risk_window" and r["in_risk_window"] is True
    assert r["_risk_window_source"] == "heuristic"
    assert "非法律規定" in r["_risk_window_note"]


def test_無風險窗設定則不進風險窗():
    m = {"milestone_id": "n", "title": "t", "due": "2026-08-02", "source": "plan"}
    assert classify_milestone(m, today=TODAY)["in_risk_window"] is False


# ── 3. 時間分類（純日期算術）──

def test_逾期計算():
    r = classify_milestone(_ms()[0], today=TODAY)
    assert r["urgency"] == "overdue" and r["overdue_days"] == 11


def test_快到期與未來():
    assert classify_milestone(_ms()[2], today=TODAY)["urgency"] == "due_soon"
    assert classify_milestone(_ms()[3], today=TODAY)["urgency"] == "upcoming"


def test_已完成與不辦不進待辦():
    assert classify_milestone(_ms()[4], today=TODAY)["urgency"] == "done"
    w = classify_milestone({"milestone_id": "w", "title": "t", "due": "2026-07-01",
                            "source": "plan", "status": "waived"}, today=TODAY)
    assert w["urgency"] == "waived"


def test_無有效到期日_不臆造():
    r = classify_milestone({"milestone_id": "n", "title": "t", "due": "沒有日期", "source": "plan"},
                           today=TODAY)
    assert r["days_remaining"] is None and "不臆造" in r["_note"]


# ── 4. 今天要做什麼 ──

def test_今天要做什麼_排序為逾期優先():
    t = build_today(_ms(), today=TODAY)
    order = [r["urgency"] for r in t["action_required"]]
    assert order == ["overdue", "risk_window", "due_soon"]
    assert t["counts"]["overdue"] == 1 and t["counts"]["done"] == 1


def test_待辦法定期限被單獨計數():
    """法定期限逾期比自訂計畫逾期嚴重，需可單獨看到。"""
    assert build_today(_ms(), today=TODAY)["statute_pending"] == 1


def test_已完成不進action_required():
    t = build_today(_ms(), today=TODAY)
    assert all(r["urgency"] not in ("done", "waived") for r in t["action_required"])


def test_空里程碑不炸():
    t = build_today([], today=TODAY)
    assert t["action_required"] == [] and t["counts"]["overdue"] == 0


# ── 5. Timeline＝衍生視圖，且不記推論 ──

def test_timeline_過去現在未來三段():
    acts = [{"ts": "2026-07-20T09:00:00", "kind": "edit", "field": "住宅單價",
             "before": 92, "after": 96, "intent": "地主要求增加坪數"}]
    hist = [{"snapshot_id": "sn-1", "ts": "2026-07-20T09:01:00", "label": "調價後",
             "input_hash": "sha256:" + "ab" * 32, "authoritative": True}]
    tl = build_timeline(acts, hist, _ms(), today=TODAY)
    assert len(tl["past"]) == 2                     # activity + snapshot
    assert tl["past"][0]["intent"] == "地主要求增加坪數"
    assert len(tl["today"]) == 3                    # 逾期+風險窗+快到期
    assert any(r["urgency"] == "upcoming" for r in tl["future"])


def test_timeline_不改寫來源():
    """衍生視圖：跑完之後原始 milestones 不得被改動。"""
    import copy
    ms = _ms(); snapshot = copy.deepcopy(ms)
    build_timeline([], [], ms, today=TODAY)
    assert ms == snapshot


def test_輸出不含推論欄位():
    """★ M7 鐵律：只記事實與意圖，不記推論。"""
    import json
    blob = json.dumps(build_timeline([], [], _ms(), today=TODAY), ensure_ascii=False)
    for banned in ("verdict", "\"ev\"", "irr", "return_rate", "shared_cost_ratio",
                   "completion_probability", "persuasion_queue"):
        assert banned not in blob.lower(), f"Timeline 不應輸出推論欄位：{banned}"


def test_today_預設為系統今日():
    t = build_today(_ms())
    assert t["as_of"] == dt.date.today().isoformat()


# ── 6. 法定期限庫（M7.2）──

def test_法定期限庫_每筆必附法源():
    from core.redcf import load_statutory_deadlines
    dl = load_statutory_deadlines()
    assert dl["deadlines"], "期限庫不得為空"
    for d in dl["deadlines"]:
        assert d.get("legal_basis"), f"{d.get('key')} 缺法源"
        assert d.get("quote"), f"{d.get('key')} 缺條文原文"
        assert d.get("verification"), f"{d.get('key')} 缺查核狀態"


def test_法定期限庫_保留法規會修正之標示():
    from core.redcf import load_statutory_deadlines
    dl = load_statutory_deadlines()
    assert "法規會修正" in dl["_source_disclaimer"]
    assert dl.get("_not_included"), "須明列『不收哪些、為什麼』"


def test_缺法源的期限庫被拒載(tmp_path):
    """★ 防止經驗值混入法規：缺 legal_basis 直接拒載。"""
    import json
    from core.redcf.timeline import load_statutory_deadlines
    bad = tmp_path / "bad.json"
    bad.write_text(json.dumps({"_source_disclaimer": "法規會修正",
                               "deadlines": [{"key": "x", "title": "t", "days": 30,
                                              "verification": "pending_review"}]},
                              ensure_ascii=False), encoding="utf-8")
    with pytest.raises(ValueError, match="法源"):
        load_statutory_deadlines(bad)


def test_由法定期限生成里程碑_自動帶法源與到期日():
    from core.redcf import statutory_milestone
    m = statutory_milestone("rv_value_objection", "2026-06-15")
    assert m["source"] == "statute"
    assert "§53" in m["legal_basis"]
    assert m["due"] == "2026-08-14"          # 核定日 + 60 日
    ok, errs = validate_milestones([m])
    assert ok, errs


def test_未複核的法定期限_里程碑須標示待複核():
    """verification != verified 時，note 必須讓使用者看到『待複核』。"""
    from core.redcf import statutory_milestone
    m = statutory_milestone("public_display", "2026-06-01")
    assert "待複核" in m["note"]


def test_未知期限key報錯():
    from core.redcf import statutory_milestone
    with pytest.raises(ValueError, match="無此項"):
        statutory_milestone("不存在的期限", "2026-06-01")
