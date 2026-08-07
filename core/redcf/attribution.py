# -*- coding: utf-8 -*-
"""
core/redcf/attribution.py — M7.4 Explainability / Attribution（歸因引擎）
=========================================================================
憲章＝docs/architecture/M7_CASE_OS_SPEC.md §8。把決策報告從「結論」變成
「**可質詢的結論**」——不只說「什麼變了」（那是 diff），而是說「**誰造成的**」。

首版（v0.1）鎖定範圍（使用者核定，勿擅自放寬）：
  問題＝「兩個完整 Scenario 之間，**全案投報率**為何變動」。
  · 只接受**完整 Scenario input**（engine：params/floors/case_type/mode）。
  · `floors`／`owners`／`case_type`／`mode` 等**結構性變更明確拒答**
    （raise AttributionUnsupported）——不做虛假的「其他」歸因把差額吸收掉。
  · 只對 `params` 內**純量數值**欄位歸因。

方法：
  · Shapley（n ≤ 門檻，預設 10）：2ⁿ 次重算，**加總完全等於實際變化量**
    （Shapley efficiency 公理），且**與輸入順序無關**。
  · OAT（n 超過門檻的退路）：n 次重算，加總不保證等於 delta，
    故 `residual` 承接交互作用，仍守恆。

★ 鐵律：
  1. **零公式複製**——本模組只呼叫既有 `recompute()`，不自行計算任何財務量。
  2. **加總守恆**——輸出恆滿足 `Σ contributions + residual == delta`（容差 1e-9）。
     使用者若看到「投報率掉 2.0 ppt，列出的原因只加到 1.4」，信任瞬間歸零，
     而本功能存在的目的正是建立信任。
  3. **單位誠實**——`return_rate` ＝「**全案投報率**」，差異單位 `ppt`（百分點）；
     **不是 IRR**，不得如此標示或換算。
"""

import math
from itertools import combinations

from core.redcf.recompute import recompute, input_hash
from core.redcf._version import CORE_VERSION

ATTRIBUTION_VERSION = "0.1.0"

# 預設：n ≤ 此門檻用 Shapley（2¹⁰＝1024 次重算，瀏覽器內可跑）
SHAPLEY_MAX_FIELDS = 10

# 守恆容差（浮點誤差量級）
_守恆容差 = 1e-9

# 可歸因目標的呈現中繼資料。
# scale＝把 Core 的原生單位換成呈現單位的倍率（線性，故守恆恆等式不受影響）。
_TARGET_META = {
    "return_rate":        {"label": "全案投報率", "unit": "ppt", "scale": 100.0},
    "shared_cost_ratio":  {"label": "共同負擔比", "unit": "ppt", "scale": 100.0},
    "owner_return_ratio": {"label": "地主分回比", "unit": "ppt", "scale": 100.0},
    "efficiency_ratio":   {"label": "銷坪比（坪效）", "unit": "倍", "scale": 1.0},
}

# engine 內屬於「結構」的鍵——首版一旦有差異即拒答（不假裝能歸因）
_結構鍵 = ("floors", "owners", "case_type", "mode")


class AttributionUnsupported(ValueError):
    """首版不支援的歸因請求（結構性變更／不完整 Scenario／未知目標）。

    明確拒答優於虛假歸因：把算不出來的差額塞進「其他」，會讓使用者以為
    系統知道原因——那比不回答更傷信任。
    """


# ── 輸入守門 ────────────────────────────────────────────────────────

def _檢查完整Scenario(engine: dict, 名稱: str) -> None:
    if not isinstance(engine, dict):
        raise AttributionUnsupported(f"{名稱} 需為完整 Scenario engine（dict）")
    for 必要 in ("params", "floors"):
        if 必要 not in engine:
            raise AttributionUnsupported(
                f"{名稱} 缺 `{必要}`——首版只接受完整 Scenario input（不接受 diff／部分輸入）"
            )
    if not isinstance(engine["params"], dict):
        raise AttributionUnsupported(f"{名稱}.params 需為 dict")


def _檢查無結構變更(before: dict, after: dict) -> None:
    """結構性變更明確拒答（§首版邊界）。"""
    for k in _結構鍵:
        if before.get(k) != after.get(k):
            raise AttributionUnsupported(
                f"首版不支援結構性變更的歸因（`{k}` 有差異）。"
                f"樓層表／產權清冊／案件類型／投報模式改變時，"
                f"欄位層級的邊際貢獻沒有一致定義；本版明確拒答，"
                f"不以「其他」項吸收差額。請改以兩份結構相同的 Scenario 比較。"
            )


def _蒐集變更欄位(before: dict, after: dict) -> list:
    """回傳有差異且可歸因（純量數值）的 params 欄位；非純量差異即拒答。"""
    bp, ap = before["params"], after["params"]
    if set(bp.keys()) != set(ap.keys()):
        缺 = set(bp.keys()) ^ set(ap.keys())
        raise AttributionUnsupported(
            f"兩個 Scenario 的 params 欄位集合不同（差異：{sorted(缺)}）——"
            f"首版要求同結構比較"
        )
    變更 = []
    for k in sorted(bp.keys()):
        if bp[k] == ap[k]:
            continue
        if not (isinstance(bp[k], (int, float)) and isinstance(ap[k], (int, float))) \
           or isinstance(bp[k], bool) or isinstance(ap[k], bool):
            raise AttributionUnsupported(
                f"欄位 `{k}` 為非純量數值變更（{type(bp[k]).__name__} → {type(ap[k]).__name__}），"
                f"首版不歸因此類變更"
            )
        變更.append(k)
    return 變更


# ── 目標取值（唯一與 Core 的接觸面）────────────────────────────────

def _變體(before: dict, after: dict, 取後值欄位) -> dict:
    """組出「這些欄位取 after 值、其餘取 before 值」的 engine。"""
    e = dict(before)
    p = dict(before["params"])
    for f in 取後值欄位:
        p[f] = after["params"][f]
    e["params"] = p
    return e


class _取值器:
    """對 frozenset(欄位) → 目標值 的記憶化求值器；只呼叫 recompute（零公式）。"""

    def __init__(self, before, after, target):
        self._before, self._after, self._target = before, after, target
        self._快取 = {}
        self.次數 = 0

    def __call__(self, 欄位集) -> float:
        key = frozenset(欄位集)
        if key in self._快取:
            return self._快取[key]
        out = recompute(self._變體(key))
        if self._target not in out:
            raise AttributionUnsupported(
                f"Core result 不含目標欄位 `{self._target}`"
            )
        v = float(out[self._target])
        self._快取[key] = v
        self.次數 += 1
        return v

    def _變體(self, 欄位集):
        return _變體(self._before, self._after, 欄位集)


# ── 兩種歸因法 ──────────────────────────────────────────────────────

def _shapley(取值, 欄位: list) -> dict:
    """精確 Shapley 值：加總完全等於 v(N)−v(∅)，且與輸入順序無關。

    φ_i = Σ_{S ⊆ N\\{i}} |S|!(n−|S|−1)!/n! · [v(S∪{i}) − v(S)]
    """
    n = len(欄位)
    n_階乘 = math.factorial(n)
    貢獻 = {f: 0.0 for f in 欄位}
    for i, f in enumerate(欄位):
        其餘 = [x for x in 欄位 if x != f]
        for 大小 in range(len(其餘) + 1):
            權重 = math.factorial(大小) * math.factorial(n - 大小 - 1) / n_階乘
            for S in combinations(其餘, 大小):
                貢獻[f] += 權重 * (取值(set(S) | {f}) - 取值(set(S)))
    return 貢獻


def _oat(取值, 欄位: list) -> dict:
    """One-at-a-time：各欄位單獨變動的邊際效果。加總不保證等於 delta
    （交互作用被漏掉），故 residual 必須承接差額。"""
    基準 = 取值(set())
    return {f: 取值({f}) - 基準 for f in 欄位}


# ── 對外 API ────────────────────────────────────────────────────────

def attribute(before: dict, after: dict, target: str = "return_rate",
              method: str = "auto", max_shapley_fields: int = SHAPLEY_MAX_FIELDS) -> dict:
    """歸因：兩個完整 Scenario 之間，目標指標為何變動。

    參數
    ----
    before, after : 完整 Scenario engine（params/floors/case_type/mode）
    target        : 目標欄位，預設 "return_rate"（＝**全案投報率**，單位 ppt，**非 IRR**）
    method        : "auto"（預設）｜"shapley"｜"oat"
                    auto ＝ 變更欄位數 ≤ max_shapley_fields 時用 shapley，否則 oat

    回傳
    ----
    dict（合約＝schemas/attribution.schema.v0.1.json），恆滿足
    `Σ contributions[].impact + residual == delta`（容差 1e-9），
    並附**可見加總橋** `bridge`：從變更前值逐項加到變更後值。

    例外
    ----
    AttributionUnsupported : 結構性變更／不完整 Scenario／未知目標／非純量變更
    """
    if target not in _TARGET_META:
        raise AttributionUnsupported(
            f"首版可歸因目標僅限 {sorted(_TARGET_META)}；收到 `{target}`"
        )
    if method not in ("auto", "shapley", "oat"):
        raise AttributionUnsupported(f"未知 method：{method}")

    _檢查完整Scenario(before, "before")
    _檢查完整Scenario(after, "after")
    _檢查無結構變更(before, after)
    欄位 = _蒐集變更欄位(before, after)

    meta = _TARGET_META[target]
    倍率 = meta["scale"]
    取值 = _取值器(before, after, target)

    前值 = 取值(set()) * 倍率
    後值 = 取值(set(欄位)) * 倍率
    delta = 後值 - 前值

    # 無變更：誠實回報空歸因（delta 應為 0）
    if not 欄位:
        用法 = "none"
        原始貢獻 = {}
    else:
        用法 = method if method != "auto" else (
            "shapley" if len(欄位) <= max_shapley_fields else "oat")
        if 用法 == "shapley" and len(欄位) > max_shapley_fields:
            raise AttributionUnsupported(
                f"指定 shapley 但變更欄位數 {len(欄位)} 超過上限 {max_shapley_fields}"
                f"（2^{len(欄位)} 次重算過重）；請用 method='oat' 或提高上限"
            )
        原始貢獻 = (_shapley if 用法 == "shapley" else _oat)(取值, 欄位)

    貢獻 = []
    for f in 欄位:
        貢獻.append({
            "field": f,
            "before": before["params"][f],
            "after": after["params"][f],
            "impact": 原始貢獻[f] * 倍率,
        })
    # 影響大者在前（絕對值），便於「主因是誰」一眼看出
    貢獻.sort(key=lambda c: -abs(c["impact"]))

    residual = delta - sum(c["impact"] for c in 貢獻)

    # ── 可見加總橋：前值 →（逐項貢獻）→ 殘差 → 後值 ──
    bridge, 累計 = [], 前值
    bridge.append({"step": "start", "label": f"變更前 {meta['label']}", "value": 前值})
    for c in 貢獻:
        累計 += c["impact"]
        bridge.append({"step": "contribution", "label": c["field"],
                       "impact": c["impact"], "running": 累計})
    累計 += residual
    bridge.append({"step": "residual", "label": "交互作用（殘差）",
                   "impact": residual, "running": 累計})
    bridge.append({"step": "end", "label": f"變更後 {meta['label']}", "value": 後值})

    守恆誤差 = abs(sum(c["impact"] for c in 貢獻) + residual - delta)

    return {
        "attribution_version": ATTRIBUTION_VERSION,
        "core_version": CORE_VERSION,
        "target": target,
        "target_label": meta["label"],
        "unit": meta["unit"],
        "before_value": 前值,
        "after_value": 後值,
        "delta": delta,
        "contributions": 貢獻,
        "residual": residual,
        "method": 用法,
        "runs": 取值.次數,
        "bridge": bridge,
        "conservation_ok": bool(守恆誤差 <= _守恆容差),
        "conservation_error": 守恆誤差,
        "before_hash": input_hash(before),
        "after_hash": input_hash(after),
    }


def validate_attribution(doc: dict) -> bool:
    """以 schemas/attribution.schema.v0.1.json 驗證輸出；並複核加總守恆。"""
    import json
    import pathlib

    根 = pathlib.Path(__file__).resolve().parents[2]
    schema = json.loads((根 / "schemas" / "attribution.schema.v0.1.json")
                        .read_text(encoding="utf-8"))
    try:
        import jsonschema
    except ImportError:                     # Pyodide 等無 jsonschema 的環境
        jsonschema = None
    if jsonschema is not None:
        jsonschema.validate(doc, schema)

    誤差 = abs(sum(c["impact"] for c in doc["contributions"])
              + doc["residual"] - doc["delta"])
    if 誤差 > _守恆容差:
        raise ValueError(f"加總守恆違規：Σ contributions + residual ≠ delta（誤差 {誤差}）")
    return True
