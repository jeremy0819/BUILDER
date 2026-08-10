# -*- coding: utf-8 -*-
"""
core/redcf/attribution.py — M7.4 Explainability / Attribution（歸因引擎）
=========================================================================
憲章＝docs/architecture/M7_CASE_OS_SPEC.md §8
交付契約＝docs/releases/M7_4_ATTRIBUTION_VISUAL_PLAN.md（欄位名為規範）

把決策報告從「結論」變成「**可質詢的結論**」——不只說「什麼變了」（diff），
而是說「**誰造成的**」（反事實重算）。

首版（v0.1）鎖定範圍（使用者核定，勿擅自放寬）：
  問題＝「兩個完整 Scenario 之間，**全案投報率**為何變動」。
  · 只接受**完整 Scenario engine**（params/floors/case_type/mode）。
  · 可歸因特徵＝`params.*` 與 `params.財務覆寫.*` 的**純量葉節點**。
  · `floors`／`owners`／`case_type`／`mode`／陣列形狀／未知結構路徑
    → **結構化拒答**（AttributionUnsupported，帶 reason_code 與 paths），
    **不合併成一根「其他」長條**。說不清楚的因果，不如明確拒絕。

方法：
  · Shapley（核可特徵數 ≤10）：2ⁿ 次重算，**加總完全等於 delta**
    （efficiency 公理）且**與輸入順序無關**。
  · OAT（超過門檻的退路）：n 次重算，residual 承接未解釋的交互作用。

★ 鐵律：
  1. **零公式複製**——只組合既有 `recompute()` 與 `input_hash()`。
  2. **加總守恆**——raw 層恆滿足 `Σ impact + residual == delta`（容差 1e-9）。
  3. **呈現由 Core 產出**——瀏覽器各自四捨五入會讓可見列加不回可見 delta；
     故 `presentation` 由 Core 算好，必要時另出 `rounding_reconciliation` 列，
     **絕不把顯示進位誤差偽裝成經濟意義上的交互作用殘差**。
  4. **單位誠實**——`return_rate` ＝「**全案投報率**」，顯示單位 **ppt（百分點）**；
     **不是 IRR**，不得如此標示或換算。
"""

import math
from itertools import combinations

from core.redcf.recompute import recompute, input_hash
from core.redcf._version import CORE_VERSION

SCHEMA_VERSION = "attribution-0.1"

# 核可特徵數 ≤ 此門檻用精確 Shapley（2¹⁰＝1024 次重算，瀏覽器內可跑）
SHAPLEY_MAX_FEATURES = 10

# raw 層守恆容差（浮點誤差量級）
CONSERVATION_TOLERANCE = 1e-9

# 目標中繼資料。scale＝raw → 顯示單位的線性倍率（線性故守恆恆等式不受影響）。
_TARGETS = {
    "return_rate": {
        "label": "全案投報率",            # ← 不得標為 IRR
        "raw_unit": "ratio",
        "display_unit": "percentage_points",
        "higher_is_better": True,
        "scale": 100.0,
        "precision": 2,
    },
}

# engine 內屬「結構」的鍵——一旦有差異即拒答
_STRUCTURAL_KEYS = ("floors", "owners", "case_type", "mode")

# params 底下核可遞迴的巢狀容器（其純量葉節點可歸因）
_APPROVED_NESTED = ("財務覆寫",)


class AttributionUnsupported(ValueError):
    """首版不支援的歸因請求（結構化錯誤，供 Worker/UI 精確呈現）。

    明確拒答優於虛假歸因：把算不出來的差額塞進「其他」，會讓使用者以為
    系統知道原因——那比不回答更傷。

    屬性
    ----
    reason_code : 機器可讀的原因（structural_change／incomplete_input／…）
    paths       : 造成拒答的具體路徑（供 UI 逐條點名，不含臆測）
    """

    def __init__(self, message, reason_code="unsupported", paths=None):
        super().__init__(message)
        self.reason_code = reason_code
        self.paths = list(paths or [])


# ── 輸入守門 ────────────────────────────────────────────────────────

def _require_complete(engine, name):
    if not isinstance(engine, dict):
        raise AttributionUnsupported(
            f"{name} 需為完整 Scenario engine（dict）",
            "incomplete_input", [name])
    missing = [k for k in ("params", "floors") if k not in engine]
    if missing:
        raise AttributionUnsupported(
            f"{name} 缺 {missing}——首版只接受完整 Scenario input（不接受 diff／部分輸入）",
            "incomplete_input", [f"{name}.{k}" for k in missing])
    if not isinstance(engine["params"], dict):
        raise AttributionUnsupported(
            f"{name}.params 需為 dict", "incomplete_input", [f"{name}.params"])


def _require_no_structural_change(before, after):
    bad = [k for k in _STRUCTURAL_KEYS if before.get(k) != after.get(k)]
    if bad:
        raise AttributionUnsupported(
            "首版不支援結構性變更的歸因（差異：" + "、".join(bad) + "）。"
            "樓層表／產權清冊／案件類型／投報模式改變時，欄位層級的邊際貢獻"
            "沒有一致定義；本版明確拒答，**不以「其他」項吸收差額**。"
            "請改以兩份結構相同的 Scenario 比較。",
            "structural_change", ["engine." + k for k in bad])


def _is_scalar(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def _diff_features(before_p, after_p, prefix="params"):
    """遞迴比對 params，回傳有差異的**純量葉節點**正規路徑。

    不支援者一律拋結構化拒答，不靜默略過（略過＝差額憑空消失）。
    """
    if set(before_p.keys()) != set(after_p.keys()):
        diff = sorted(set(before_p.keys()) ^ set(after_p.keys()))
        raise AttributionUnsupported(
            f"兩個 Scenario 的 `{prefix}` 欄位集合不同（差異：{diff}）——首版要求同結構比較",
            "key_set_mismatch", [f"{prefix}.{k}" for k in diff])

    features, unsupported = [], []
    for key in sorted(before_p.keys()):
        b, a = before_p[key], after_p[key]
        path = f"{prefix}.{key}"
        if b == a:
            continue
        if _is_scalar(b) and _is_scalar(a):
            features.append(path)
        elif isinstance(b, dict) and isinstance(a, dict) and key in _APPROVED_NESTED:
            features.extend(_diff_features(b, a, path))
        else:
            unsupported.append(path)
    if unsupported:
        raise AttributionUnsupported(
            "下列路徑的變更不在首版可歸因範圍（非純量或未核可的結構）："
            + "、".join(unsupported) + "。本版明確拒答，不併入「其他」。",
            "unsupported_path", unsupported)
    return features


# ── 路徑存取與變體組裝 ──────────────────────────────────────────────

def _get_path(engine, path):
    node = engine
    for part in path.split("."):
        node = node[part]
    return node


def _variant(before, after, take_after_paths):
    """組出「這些路徑取 after 值、其餘取 before 值」的 engine（不改動輸入）。"""
    e = dict(before)
    e["params"] = _deep_copy_params(before["params"])
    for path in take_after_paths:
        parts = path.split(".")[1:]          # 去掉 "params"
        node, src = e["params"], after["params"]
        for p in parts[:-1]:
            node[p] = dict(node[p])
            node, src = node[p], src[p]
        node[parts[-1]] = src[parts[-1]]
    return e


def _deep_copy_params(params):
    out = {}
    for k, v in params.items():
        out[k] = dict(v) if isinstance(v, dict) else v
    return out


class _Evaluator:
    """frozenset(路徑) → 目標 raw 值 的記憶化求值器；只呼叫 recompute（零公式）。"""

    def __init__(self, before, after, target):
        self._before, self._after, self._target = before, after, target
        self._cache = {}
        self.runs = 0

    def __call__(self, paths):
        key = frozenset(paths)
        if key in self._cache:
            return self._cache[key]
        out = recompute(_variant(self._before, self._after, key))
        if self._target not in out:
            raise AttributionUnsupported(
                f"Core result 不含目標欄位 `{self._target}`",
                "target_unavailable", [f"result.{self._target}"])
        v = float(out[self._target])
        self._cache[key] = v
        self.runs += 1
        return v


# ── 兩種歸因法 ──────────────────────────────────────────────────────

def _shapley(evaluate, features):
    """精確 Shapley：Σφ ＝ v(N)−v(∅)（efficiency），且與輸入順序無關。"""
    n = len(features)
    n_fact = math.factorial(n)
    phi = {f: 0.0 for f in features}
    for f in features:
        others = [x for x in features if x != f]
        for size in range(len(others) + 1):
            w = math.factorial(size) * math.factorial(n - size - 1) / n_fact
            for S in combinations(others, size):
                phi[f] += w * (evaluate(set(S) | {f}) - evaluate(set(S)))
    return phi


def _oat(evaluate, features):
    """One-at-a-time：各特徵單獨變動的邊際效果；交互作用留給 residual。"""
    base = evaluate(set())
    return {f: evaluate({f}) - base for f in features}


# ── 呈現層（由 Core 產出，避免瀏覽器各自進位）────────────────────────

def _build_presentation(meta, before_raw, after_raw, delta_raw, contributions, residual_raw):
    scale, precision = meta["scale"], meta["precision"]
    r = lambda x: round(x * scale, precision)

    disp_contribs = [{"feature_id": c["feature_id"], "impact": r(c["impact"])}
                     for c in contributions]
    disp_delta = r(delta_raw)
    disp_residual = r(residual_raw)
    shown_sum = round(sum(c["impact"] for c in disp_contribs) + disp_residual, precision)
    # 顯示進位誤差獨立成列——不得偽裝成經濟意義上的交互作用
    reconciliation = round(disp_delta - shown_sum, precision)

    return {
        "precision": precision,
        "before": r(before_raw),
        "after": r(after_raw),
        "delta": disp_delta,
        "contributions": disp_contribs,
        "residual": disp_residual,
        "rounding_reconciliation": reconciliation,
        "display_ok": bool(
            abs(round(shown_sum + reconciliation, precision) - disp_delta) < 10 ** (-precision) / 2),
    }


# ── 對外 API ────────────────────────────────────────────────────────

def attribute(before, after, target="return_rate", method="auto",
              max_features=SHAPLEY_MAX_FEATURES):
    """歸因：兩個完整 Scenario 之間，目標指標為何變動。

    參數
    ----
    before, after : 完整 Scenario engine（params/floors/case_type/mode）
    target        : 目標欄位，v0.1 僅支援 "return_rate"
                    （＝**全案投報率**，顯示單位 ppt，**非 IRR**）
    method        : "auto"（預設）｜"shapley"｜"oat"
                    auto ＝ 核可特徵數 ≤ max_features 時 shapley，否則 oat

    回傳
    ----
    dict，合約＝`schemas/attribution.schema.v0.1.json`，離開 Core 前已通過驗證。
    raw 層恆滿足 `Σ contributions[].impact + residual.impact == delta`。

    例外
    ----
    AttributionUnsupported（帶 reason_code／paths）
    """
    if target not in _TARGETS:
        raise AttributionUnsupported(
            f"v0.1 可歸因目標僅限 {sorted(_TARGETS)}；收到 `{target}`",
            "unknown_target", [str(target)])
    if method not in ("auto", "shapley", "oat"):
        raise AttributionUnsupported(f"未知 method：{method}", "unknown_method", [str(method)])

    _require_complete(before, "before")
    _require_complete(after, "after")
    _require_no_structural_change(before, after)
    features = _diff_features(before["params"], after["params"])

    meta = _TARGETS[target]
    evaluate = _Evaluator(before, after, target)

    before_raw = evaluate(set())
    after_raw = evaluate(set(features))
    delta_raw = after_raw - before_raw

    if not features:
        resolved, raw_phi = "none", {}
    else:
        resolved = method if method != "auto" else (
            "shapley" if len(features) <= max_features else "oat")
        if resolved == "shapley" and len(features) > max_features:
            raise AttributionUnsupported(
                f"指定 shapley 但核可特徵數 {len(features)} 超過上限 {max_features}"
                f"（2^{len(features)} 次重算過重）；請用 method='oat' 或提高上限",
                "shapley_too_many_features", features)
        raw_phi = (_shapley if resolved == "shapley" else _oat)(evaluate, features)

    contributions = [{
        "feature_id": p,
        "label": p.split(".")[-1],            # 標籤由 Core 從正規路徑取，UI 不得自創
        "before_value": _get_path(before, p),
        "after_value": _get_path(after, p),
        "impact": raw_phi[p],
    } for p in features]
    # 依影響絕對值排序（僅為易讀；Shapley 與順序無關，UI 須註明此非時序）
    contributions.sort(key=lambda c: -abs(c["impact"]))

    residual_raw = delta_raw - sum(c["impact"] for c in contributions)
    conservation_err = abs(sum(c["impact"] for c in contributions) + residual_raw - delta_raw)

    report = {
        "schema_version": SCHEMA_VERSION,
        "status": "ok",
        "core_version": CORE_VERSION,
        "target": {
            "id": target,
            "label": meta["label"],
            "raw_unit": meta["raw_unit"],
            "display_unit": meta["display_unit"],
            "higher_is_better": meta["higher_is_better"],
        },
        "before": {"input_hash": input_hash(before), "value": before_raw},
        "after": {"input_hash": input_hash(after), "value": after_raw},
        "delta": delta_raw,
        "contributions": contributions,
        "residual": {"impact": residual_raw, "kind": "numeric"},
        "method": {
            "requested": method,
            "resolved": resolved,
            "feature_count": len(features),
            "runs": evaluate.runs,
            "exact": resolved in ("shapley", "none"),
        },
        "conservation": {
            "tolerance": CONSERVATION_TOLERANCE,
            "raw_ok": bool(conservation_err <= CONSERVATION_TOLERANCE),
        },
        "presentation": _build_presentation(
            meta, before_raw, after_raw, delta_raw, contributions, residual_raw),
    }

    validate_attribution(report)          # 離開 Core 前必驗
    return report


def validate_attribution(doc):
    """以 attribution.schema.v0.1 驗證；並複核 raw 守恆與顯示對帳。"""
    import json
    import pathlib

    root = pathlib.Path(__file__).resolve().parents[2]
    schema_path = root / "schemas" / "attribution.schema.v0.1.json"
    try:
        import jsonschema
    except ImportError:                    # Pyodide 等無 jsonschema 的環境
        jsonschema = None
    if jsonschema is not None and schema_path.exists():
        jsonschema.validate(doc, json.loads(schema_path.read_text(encoding="utf-8")))

    err = abs(sum(c["impact"] for c in doc["contributions"])
              + doc["residual"]["impact"] - doc["delta"])
    if err > CONSERVATION_TOLERANCE:
        raise ValueError(f"raw 加總守恆違規：Σ impact + residual ≠ delta（誤差 {err}）")
    if not doc["presentation"]["display_ok"]:
        raise ValueError("顯示層對帳失敗：可見列加不回可見 delta")
    return True
