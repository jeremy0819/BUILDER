# -*- coding: utf-8 -*-
"""
core/redcf/decision.py — M4 Decision Engine（推論層）
======================================================
憲法＝docs/architecture/DECISION_ENGINE_SPEC.md。三條鐵律：

  1. **只消費，不反算**：本引擎讀 Core `result`（verbatim）＋ Workflow `state`，
     絕不重算容積/共負/財務——result 缺欄一律標 `insufficient_data`，不補算。
     （V0＝result.owner_allocations[].pre_value 的**加總**：彙整 Core 已產出的逐戶值，
     非重新推導 Core 公式；此為 §56 權變分母的唯一可溯源來源。）
  2. **產出即權威**：GO/CAUTION/STOP、三方 EV、Exit Signal 由本引擎產出，
     UI 只呈現 decision JSON。
  3. **可溯源**：輸出必帶 input_hash 指回消費的 Core result 版本。

所有存活率/折現率/status_quo 基準＝**可校準建模假設**（stage_tree.json /
decision_config.json，標示不得移除）；真實案件在 /local_calibration/ 本地校準，
數字不進版控。沉沒成本防火牆：已投入成本不得進 exit 決策式（sunk_cost_excluded=true）。
"""
import json
import pathlib

_此處 = pathlib.Path(__file__).resolve().parent
_根 = _此處.parents[1]
STAGE_TREE_PATH = _此處 / "stage_tree.json"
DECISION_CONFIG_PATH = _此處 / "decision_config.json"
DECISION_SCHEMA_PATH = _根 / "schemas" / "decision.schema.v0.1.json"
ENGINE_VERSION = "0.1.0"


def load_stage_tree(path=None) -> dict:
    data = json.loads((pathlib.Path(path) if path else STAGE_TREE_PATH).read_text(encoding="utf-8"))
    if not data.get("_note"):
        raise ValueError("stage_tree.json 缺 _note（示意預設標示不得移除）")
    return data


def load_decision_config(path=None) -> dict:
    data = json.loads((pathlib.Path(path) if path else DECISION_CONFIG_PATH).read_text(encoding="utf-8"))
    if not data.get("_note"):
        raise ValueError("decision_config.json 缺 _note（建模假設標示不得移除）")
    return data


def calc_完工機率(wf_stage: str, tree: dict = None, p_haircut: float = 1.0) -> tuple:
    """由 Workflow 階段起算 (p_complete, T_remaining_yr)。§2。
    p_haircut＝情境調整乘數（如 背信/overpay 情境），1.0＝無調整；記入 assumptions。"""
    t = tree or load_stage_tree()
    起點 = t["wf_stage_map"].get(wf_stage, "T1")
    stages = t["stage_tree"]
    idx = next((i for i, s in enumerate(stages) if s["id"] == 起點), 0)
    p = 1.0
    T = 0.0
    for s in stages[idx:]:
        p *= s["p_survival"]
        T += s["duration_yr"]
    return (max(0.0, min(1.0, p * p_haircut)), T)


def _讀result(result: dict) -> tuple:
    """從 Core result 讀 verbatim；缺欄記入 insufficient（不補算）。"""
    缺 = []
    V = result.get("total_sales")
    c = result.get("shared_cost_ratio")
    allocs = result.get("owner_allocations") or []
    V0 = None
    if allocs and all(a.get("pre_value") is not None for a in allocs):
        V0 = sum(a["pre_value"] for a in allocs)   # 彙整 Core 逐戶值（非重算公式）
    if V is None: 缺.append("total_sales")
    if c is None: 缺.append("shared_cost_ratio")
    if V0 is None: 缺.append("owner_allocations[].pre_value")
    return V, c, V0, 缺


def decide(result: dict, workflow: dict, inputs: dict = None,
           config: dict = None, tree: dict = None) -> dict:
    """產出 decision JSON（§7，經 schema 驗證）。
    result＝Core 權威輸出（verbatim 消費）；workflow＝{stage, consent{agreed,total,threshold}, input_hash}；
    inputs＝本案可校準輸入（mgmt_fee/profit_impl/advance/operating/我方收入/我方投入/
            V0_scenario/exit{marginal_investment,exit_recovery_now,future_recovery}/
            p_haircut/deadline_proximity/ev_trajectory）——皆為建模假設，全數揭露。"""
    inputs = dict(inputs or {})
    cfg = config or load_decision_config()
    r, g = cfg["r"], cfg["g"]
    帶寬 = cfg.get("landowner_ev_zero_band", 0.02)

    # ── 輸入契約（§1）──
    V, c, V0, 缺 = _讀result(result)
    if inputs.get("V0_scenario") is not None:      # 情境覆寫（如 案例B 地價翻倍）＝建模假設，須揭露
        V0 = inputs["V0_scenario"]
        缺 = [x for x in 缺 if x != "owner_allocations[].pre_value"]
    stage = (workflow or {}).get("stage", "S1")
    p_haircut = float(inputs.get("p_haircut", 1.0))
    p, T = calc_完工機率(stage, tree, p_haircut)
    df = 1.0 / (1.0 + r) ** T

    # ── 三方 EV（§3）——缺欄即 insufficient_data，不臆造 ──
    def entry(nominal, ev):
        return {"nominal": None if nominal is None else round(nominal, 2),
                "ev": None if ev is None else round(ev, 2),
                "status": "ok" if ev is not None else "insufficient_data"}

    # 地主
    if V is not None and c is not None and V0 is not None:
        分回 = V * (1 - c)
        地主名目 = 分回 - V0
        地主EV = p * df * 分回 - V0 * ((1 + g) ** T) * df
        地主 = entry(地主名目, 地主EV)
    else:
        地主 = entry(None, None)

    # 實施者（mgmt_fee/profit_impl/advance/operating＝本案輸入；缺則 insufficient）
    mf, pi_ = inputs.get("mgmt_fee"), inputs.get("profit_impl", 0.0)
    adv, op = inputs.get("advance"), inputs.get("operating", 0.0)
    if mf is not None and adv is not None:
        實名 = (mf + pi_) - adv - op
        實EV = p * df * (mf + pi_) - (1 - p) * adv - df * op
        實施者 = entry(實名, 實EV)
    else:
        實施者 = entry(None, None)
        缺.append("implementer_inputs(mgmt_fee/advance)")

    # 我方（依 role 套同框架）
    收, 投 = inputs.get("我方收入"), inputs.get("我方投入")
    if 收 is not None and 投 is not None:
        我名 = 收 - 投
        我EV = p * df * 收 - (1 - p) * 投
        我方 = entry(我名, 我EV)
    else:
        我方 = entry(None, None)
        缺.append("our_inputs(我方收入/我方投入)")

    # ── 引爆點＋Verdict（§4）──
    def 為負或近零(e, base):
        if e["ev"] is None: return False
        if e["ev"] <= 0: return True
        return base is not None and abs(e["ev"]) < base * 帶寬
    負方 = []
    if 為負或近零(地主, V0): 負方.append("地主")
    if 實施者["ev"] is not None and 實施者["ev"] <= 0: 負方.append("實施者")
    if 我方["ev"] is not None and 我方["ev"] <= 0: 負方.append("我方")
    breakpoint_sh = 負方[0] if 負方 else None

    有缺 = any(e["status"] == "insufficient_data" for e in (地主, 實施者, 我方))
    投入基準 = 投 if (投 not in (None, 0)) else None
    達門檻報酬 = (我方["ev"] is not None and 投入基準 is not None
                  and 我方["ev"] / 投入基準 > cfg["threshold_return"])
    if 有缺:
        verdict = "CAUTION"           # 資訊不足→不得妄斷 GO/STOP
    elif "我方" in 負方 or (地主["ev"] is not None and V0 is not None and 地主["ev"] < -V0 * 0.10):
        verdict = "STOP"              # 我方 EV≤0，或地主 EV 顯著為負（整合幾乎不可能）
    elif 負方:
        verdict = "CAUTION"           # 我方為正但某方≤0＝整合不對稱風險
    else:
        verdict = "GO" if 達門檻報酬 else "CAUTION"

    # ── Exit Signal（§5）＋沉沒成本防火牆 ──
    exit_signal = False
    if "sunk_cost" in inputs:
        raise ValueError("沉沒成本不得進入 exit 決策式（sunk_cost_excluded 防火牆）")
    ex = inputs.get("exit")
    if ex:
        繼續EV = p * df * ex["future_recovery"] - ex["marginal_investment"]
        退場EV = ex["exit_recovery_now"]
        exit_signal = bool(繼續EV < 退場EV)

    # ── Decision Urgency（§6）──
    w = cfg["urgency_weights"]
    sev = {"STOP": 1.0, "CAUTION": 0.5, "GO": 0.0}[verdict]
    con = (workflow or {}).get("consent") or {}
    gap = 0.0
    if con.get("total"):
        thr = con.get("threshold", 0.75)
        gap = max(0.0, thr - con.get("agreed", 0) / con["total"]) / (thr or 1)
    urgency = round(min(1.0, w["w1"] * sev + w["w2"] * float(inputs.get("deadline_proximity", 0))
                        + w["w3"] * gap + w["w4"] * float(inputs.get("ev_trajectory", 0))), 4)

    out = {
        "decision_engine_version": ENGINE_VERSION,
        "input_hash": (workflow or {}).get("input_hash", ""),
        "verdict": verdict,
        "breakpoint_stakeholder": breakpoint_sh,
        "completion_probability": round(p, 4),
        "T_remaining_yr": round(T, 2),
        "ev": {"地主": 地主, "實施者": 實施者, "我方": 我方},
        "exit_signal": exit_signal,
        "sunk_cost_excluded": True,
        "decision_urgency": urgency,
        "assumptions": {"r": r, "g": g, "status_quo_baseline": cfg["status_quo_baseline"],
                        **({"p_haircut": p_haircut} if p_haircut != 1.0 else {}),
                        **({"V0_scenario": inputs["V0_scenario"]} if inputs.get("V0_scenario") is not None else {})},
        "modeling_assumption": "status_quo_baseline",
        "insufficient_fields": sorted(set(缺)),
    }
    ok, errs = validate_decision(out)
    if not ok:
        raise ValueError("decision 輸出不符 schema v0.1：" + "; ".join(errs))
    return out


def validate_decision(doc: dict) -> tuple:
    """對 decision.schema.v0.1.json 驗證。回傳 (ok, errors)。"""
    try:
        import jsonschema
    except ImportError:
        return (False, ["jsonschema 未安裝"])
    schema = json.loads(DECISION_SCHEMA_PATH.read_text(encoding="utf-8"))
    v = jsonschema.Draft7Validator(schema)
    errs = [f"{'/'.join(str(x) for x in e.path) or '(root)'}: {e.message}"
            for e in sorted(v.iter_errors(doc), key=lambda e: list(e.path))]
    return (len(errs) == 0, errs)
