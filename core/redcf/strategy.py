# -*- coding: utf-8 -*-
"""
core/redcf/strategy.py — M6 Strategy Engine「THE STRATEGIST」（建議層）
========================================================================
憲法＝docs/architecture/M6_STRATEGIST_SPEC.md。三條鐵律：

  1. **只消費，不反算**：讀 Decision Engine `decision`＋Workflow `state`＋stakeholder_profile，
     絕不重算 EV/verdict/坪數（那是上游的事）；破局引爆點 breakpoint_stakeholder 由 M4 給，本層不自判。
  2. **建議即權威**：「先談誰／怎麼談／什麼絕不能做」由本引擎產出；UI 只逐欄呈現、不得自行推導。
  3. **可解釋**：每條建議帶 reason＋signals_used，能回答「你憑什麼這樣建議」。

雙軸模型（§2）：意願軸 willingness_type × 可簽性軸 signability（正交）。**blocked＝行政工作量**，
分流到 administrative_queue，不計入說服工作量——混算會嚴重誤判整合難度。

分類紀律（§3，同 M5.5 willingness_source）：權威＝整合人 recorded / Sandbox simulated；
引擎只產 suggested，缺訊號→unknown **不猜測**。

方向分工鐵則（護欄 #8）：型別集合＋訊號→型別映射＋對策方向＋禁止動作＋convertibility 排序
＝**領域真理，鎖在本檔＋回歸測試**；權重幅度/話術文案＝strategy_config.json（可校準）。
對策庫源自 3 個實案＋理論，樣本小 → 方向性建議、非投資結論。
"""
import json
import pathlib

_此處 = pathlib.Path(__file__).resolve().parent
_根 = _此處.parents[1]
STRATEGY_CONFIG_PATH = _此處 / "strategy_config.json"
STRATEGY_SCHEMA_PATH = _根 / "schemas" / "strategy.schema.v0.1.json"
PROFILE_SCHEMA_PATH = _根 / "schemas" / "stakeholder_profile.schema.v0.1.json"
STRATEGY_ENGINE_VERSION = "0.1.0"

# ── 領域真理（鎖在程式＋回歸；不進 config）────────────────────────────────
WILLINGNESS_TYPES = ("strategic", "fearful", "opposed", "unknown")

# 訊號 → 型別桶（§4 三型判定訊號表）
_SIGNAL_BUCKET = {
    # 恐懼型：質疑履約/財力、反覆同問、怕拿不到房、加碼後更疑
    "questioned_capital_adequacy": "fearful",
    "repeated_same_question": "fearful",
    "fears_nondelivery": "fearful",
    "more_doubtful_after_sweetener": "fearful",
    # 策略型：關鍵時點發難、要具體條件、比較同業、隨條件軟化
    "raised_at_critical_moment": "strategic",
    "demands_specific_terms": "strategic",
    "comparing_competitors": "strategic",
    "softens_with_terms": "strategic",
    # 反對型：拒談條件、情感因素、無急迫、status quo 好
    "refuses_to_discuss_terms": "opposed",
    "emotional_attachment": "opposed",
    "no_urgency_long_horizon": "opposed",
    "status_quo_favorable": "opposed",
}
# more_doubtful_after_sweetener＝恐懼型最強訊號（§4 ★），加權
_SIGNAL_WEIGHT = {"more_doubtful_after_sweetener": 2}

# 型別 → 對策方向（§5 對策庫；文案在 config）
_ACTION_BY_TYPE = {
    "strategic": "time_limited_offer",
    "fearful": "institutional_guarantee",
    "opposed": "statutory_process",
    "unknown": "clarify_and_record",
}
# 型別 → 禁止動作（§5.2；恐懼型必含 increase_allocation＝加碼反效果）
_FORBIDDEN_BY_TYPE = {
    "fearful": ("increase_allocation", "verbal_guarantee_only", "authority_endorsement_as_substitute"),
    "strategic": ("reveal_urgency",),
    "opposed": ("continue_sweetening",),
    "unknown": (),
}
# 產權原因 → 行政動作（§5.4 產權清理，平行軌）
_ADMIN_ACTION = {
    "inherited_unregistered": "assist_inheritance_registration",
    "joint_ownership": "co_owner_agreement",
    "mortgaged": "mortgage_clearance",
    "illegal_structure": "illegal_structure_rights_assessment",
}
# 可轉化性領域排序（§6）：恐懼型 > 策略型 > 反對型（幅度在 config；此順序為真理）
_CONVERTIBILITY_RANK = ("fearful", "strategic", "opposed")
_CASCADE_SCALAR = {"low": 0.0, "medium": 0.5, "high": 1.0}


def load_strategy_config(path=None) -> dict:
    data = json.loads((pathlib.Path(path) if path else STRATEGY_CONFIG_PATH).read_text(encoding="utf-8"))
    if not data.get("_note"):
        raise ValueError("strategy_config.json 缺 _note（示意/方向性標示不得移除）")
    return data


def suggest_willingness_type(signals) -> str:
    """由行為訊號映射 suggested 型別（§4）；缺訊號或平手→unknown（不猜測）。方向為領域真理。"""
    score = {"fearful": 0, "strategic": 0, "opposed": 0}
    for s in (signals or []):
        b = _SIGNAL_BUCKET.get(s)
        if b:
            score[b] += _SIGNAL_WEIGHT.get(s, 1)
    top = max(score.values())
    if top == 0:
        return "unknown"
    winners = [k for k, v in score.items() if v == top]
    return winners[0] if len(winners) == 1 else "unknown"   # 平手＝訊號矛盾，不猜


def _classify(profile: dict) -> tuple:
    """回傳 (willingness_type, classification_source, signals)。
    recorded/simulated＝權威直用；否則引擎只產 suggested（缺訊號→unknown）。"""
    signals = profile.get("signals_observed", []) or []
    src = profile.get("classification_source")
    wt = profile.get("willingness_type")
    if src in ("recorded", "simulated") and wt in WILLINGNESS_TYPES:
        return wt, src, signals
    # 引擎路徑：即使 profile 夾帶 willingness_type，非權威來源一律重推為 suggested（引擎只提示）
    return suggest_willingness_type(signals), "suggested", signals


def _resolve_signability(profile: dict, wf_stakeholder: dict) -> tuple:
    """可簽性軸來源優先序：profile → workflow(wf-1.1) → 由 ownership_complexity 導出。
    回傳 (signability, blocking_reason)。"""
    from core.redcf.workflow import derive_signability
    sign = profile.get("signability")
    reason = profile.get("blocking_reason")
    if sign in ("signable", "blocked"):
        return sign, (reason if sign == "blocked" else None)
    st = wf_stakeholder or {}
    if st.get("signability") in ("signable", "blocked"):
        return st["signability"], (st.get("blocking_reason") if st["signability"] == "blocked" else None)
    s, r = derive_signability(st.get("ownership_complexity"))
    return (s or "signable"), r        # 未知產權→視為 signable（不臆造瑕疵，寧可進說服佇列）


def _threshold_gap(workflow: dict) -> float:
    con = (workflow or {}).get("consent") or {}
    if not con.get("total"):
        return 0.0
    thr = con.get("threshold", 0.75) or 0.75
    return max(0.0, thr - con.get("agreed", 0) / con["total"]) / thr


def _detect_cascade(resolved: list) -> str:
    """反向雪崩偵測（§7）：關鍵戶負向發難（opposed/fearful）且其 influence_targets
    有 ≥2 戶同向/未定（opposed/fearful/unknown）→ high；有負向關鍵戶但未擴散→ medium；否則 low。
    source: heuristic（來自案例A 偏好雪崩；可被真實案例修正）。"""
    by_id = {r["household_id"]: r for r in resolved}
    key_negative = [r for r in resolved
                    if r["is_key_household"] and r["willingness_type"] in ("opposed", "fearful")]
    for kp in key_negative:
        neg = 0
        for tid in kp["influence_targets"]:
            t = by_id.get(tid)
            if t is not None and t["willingness_type"] in ("opposed", "fearful", "unknown"):
                neg += 1
        if neg >= 2:
            return "high"
    return "medium" if key_negative else "low"


def _countermeasures(cascade: str) -> list:
    if cascade == "high":
        return ["do_not_sweeten", "surface_silent_supporters",
                "publish_hard_information", "address_doubts_publicly_for_middle"]
    if cascade == "medium":
        return ["do_not_sweeten", "publish_hard_information"]
    return []


def strategize(decision: dict, workflow: dict, profiles: list = None,
               config: dict = None, case_id: str = None) -> dict:
    """產出 strategy JSON（§8，經 schema 驗證）。

    decision＝M4 decision 輸出（verbatim；讀 input_hash/breakpoint，不重算）；
    workflow＝{stakeholders[], consent{agreed,total,threshold}, input_hash}；
    profiles＝list[stakeholder_profile]（整合人 recorded / Sandbox simulated / 引擎 suggested）。
    """
    cfg = config or load_strategy_config()
    w = cfg["priority_weights"]
    conv = cfg["convertibility_score"]
    profiles = profiles or []
    st_by_id = {s.get("stakeholder_id"): s for s in (workflow or {}).get("stakeholders", [])}
    gap = _threshold_gap(workflow)

    # ── 逐戶解析：意願軸 + 可簽性軸（正交）──
    resolved = []
    for p in profiles:
        hid = p["household_id"]
        wt, src, signals = _classify(p)
        sign, reason = _resolve_signability(p, st_by_id.get(hid))
        leverage = float((st_by_id.get(hid) or {}).get("land_share") or 0.0)
        resolved.append({
            "household_id": hid, "willingness_type": wt, "classification_source": src,
            "signals": signals, "signability": sign, "blocking_reason": reason,
            "is_key_household": bool(p.get("is_key_household")),
            "influence_targets": p.get("influence_targets", []) or [],
            "leverage": leverage,
        })

    cascade = _detect_cascade(resolved)
    cascade_scalar = _CASCADE_SCALAR[cascade]

    # ── 雙佇列分流（§2 關鍵推論：blocked 不進說服工作量）──
    administrative_queue, persuasion = [], []
    for r in resolved:
        if r["signability"] == "blocked":
            reason = r["blocking_reason"]
            if reason not in _ADMIN_ACTION:      # blocked 卻無有效原因＝資料不足，仍列行政佇列待補
                reason = "joint_ownership" if reason is None else reason
            if reason in _ADMIN_ACTION:
                administrative_queue.append({
                    "household_id": r["household_id"], "signability": "blocked",
                    "blocking_reason": reason, "action": _ADMIN_ACTION[reason]})
            continue
        persuasion.append(r)

    # ── 先談誰優先序（§6）：priority_score 由 config 幅度 × 領域因子 ──
    for r in persuasion:
        r["priority_score"] = round(
            w["w1_leverage"] * r["leverage"]
            + w["w2_key_household"] * (1.0 if r["is_key_household"] else 0.0)
            + w["w3_convertibility"] * float(conv.get(r["willingness_type"], conv.get("unknown", 0.0)))
            + w["w4_threshold_gap"] * gap
            + w["w5_cascade_risk"] * cascade_scalar, 6)
    persuasion.sort(key=lambda r: (-r["priority_score"], r["household_id"]))

    persuasion_queue = []
    for i, r in enumerate(persuasion, start=1):
        wt = r["willingness_type"]
        structural = (["key_household"] if r["is_key_household"] else []) \
            + (["high_leverage"] if r["leverage"] >= 0.05 else [])
        persuasion_queue.append({
            "household_id": r["household_id"], "rank": i, "queue": "persuasion",
            "willingness_type": wt, "classification_source": r["classification_source"],
            "recommended_action": _ACTION_BY_TYPE[wt],
            "forbidden_actions": list(_FORBIDDEN_BY_TYPE[wt]),
            "reason": _reason(wt, r["classification_source"], r["is_key_household"],
                              r["leverage"], cascade, cfg),
            "signals_used": list(r["signals"]) + structural,
            "priority_score": r["priority_score"],
        })

    input_hash = (decision or {}).get("input_hash") or (workflow or {}).get("input_hash") or ""
    out = {
        "strategy_engine_version": STRATEGY_ENGINE_VERSION,
        "input_hash": input_hash,
        "persuasion_queue": persuasion_queue,
        "administrative_queue": administrative_queue,
        "cascade_risk": cascade,
        "cascade_countermeasures": _countermeasures(cascade),
        "workload_split": {"persuasion_count": len(persuasion_queue),
                           "administrative_count": len(administrative_queue)},
        "assumptions": {"weights": {k: v for k, v in w.items() if not k.startswith("_")},
                        "convertibility_score": {k: v for k, v in conv.items() if not k.startswith("_")}},
        "provenance_note": ("對策庫源自 3 個實案＋賽局/行為經濟理論，樣本有限＝方向性建議、非投資結論；"
                            "willingness suggested 僅訊號推測，權威＝整合人 recorded；本引擎不預測結果，只建議下一步。"),
    }
    if case_id:
        out["case_id"] = case_id
    ok, errs = validate_strategy(out)
    if not ok:
        raise ValueError("strategy 輸出不符 schema v0.1：" + "; ".join(errs))
    return out


def _reason(wt: str, src: str, is_key: bool, leverage: float, cascade: str, cfg: dict) -> str:
    src_zh = {"recorded": "已記錄", "suggested": "訊號推測", "simulated": "劇本"}.get(src, src)
    type_zh = {"strategic": "策略型", "fearful": "恐懼型", "opposed": "反對型", "unknown": "未分類"}[wt]
    bits = [f"{type_zh}（{src_zh}）"]
    if is_key:
        bits.append("關鍵戶")
    if leverage >= 0.05:
        bits.append("高權值")
    if cascade == "high":
        bits.append("反向雪崩高風險")
    narrative = cfg.get("narratives", {}).get(wt, "")
    return "＋".join(bits) + ("；" + narrative if narrative else "")


def _validate(doc, schema_path) -> tuple:
    try:
        import jsonschema
    except ImportError:
        return (False, ["jsonschema 未安裝"])
    schema = json.loads(pathlib.Path(schema_path).read_text(encoding="utf-8"))
    v = jsonschema.Draft7Validator(schema)
    errs = [f"{'/'.join(str(x) for x in e.path) or '(root)'}: {e.message}"
            for e in sorted(v.iter_errors(doc), key=lambda e: list(e.path))]
    return (len(errs) == 0, errs)


def validate_strategy(doc: dict) -> tuple:
    """對 strategy.schema.v0.1.json 驗證。回傳 (ok, errors)。"""
    return _validate(doc, STRATEGY_SCHEMA_PATH)


def validate_stakeholder_profiles(docs: list) -> tuple:
    """對 stakeholder_profile.schema.v0.1.json 驗證（陣列）。回傳 (ok, errors)。"""
    return _validate(docs, PROFILE_SCHEMA_PATH)
