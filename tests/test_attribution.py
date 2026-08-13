# -*- coding: utf-8 -*-
"""tests/test_attribution.py — M7.4 歸因引擎驗收矩陣（A–I）

依 docs/releases/M7_4_ATTRIBUTION_VISUAL_PLAN.md §6：
  A 精確守恆      B Shapley 順序無關   C 單一變更即精確
  D OAT 交互作用  E 端點重播一致       F 不支援差異結構化拒答
  G 目標守門      H 輸入不可變         I schema／顯示層契約
＋單位誠實：return_rate ＝「全案投報率」／ppt，**不得稱為 IRR**
"""
import copy
import json
import pathlib

import pytest

from core.redcf import (attribute, validate_attribution, AttributionUnsupported,
                        recompute, input_hash, CORE_VERSION)

根 = pathlib.Path(__file__).resolve().parents[1]
範例 = 根 / "schemas" / "examples" / "v2" / "v2_1_案例D_權變示範.json"
TOL = 1e-9


@pytest.fixture
def 基準():
    return copy.deepcopy(json.loads(範例.read_text(encoding="utf-8"))["engine"])


def _改(engine, **欄位):
    e = copy.deepcopy(engine)
    e["params"].update(欄位)
    return e


def _守恆(r):
    return abs(sum(c["impact"] for c in r["contributions"])
               + r["residual"]["impact"] - r["delta"])


# ── A · 精確守恆 ────────────────────────────────────────────────

def test_A_三特徵變更_raw加總守恆(基準):
    後 = _改(基準, 住宅單價=基準["params"]["住宅單價"] * 1.08,
             車位數=基準["params"]["車位數"] - 3,
             營造單價=基準["params"]["營造單價"] * 1.05)
    r = attribute(基準, 後)
    assert r["method"]["feature_count"] == 3
    assert _守恆(r) <= TOL
    assert r["conservation"]["raw_ok"] is True
    assert r["conservation"]["tolerance"] == pytest.approx(1e-9)


def test_A_守恆旗標與實際誤差一致(基準):
    後 = _改(基準, 住宅單價=基準["params"]["住宅單價"] * 1.1)
    r = attribute(基準, 後)
    assert r["conservation"]["raw_ok"] is (_守恆(r) <= r["conservation"]["tolerance"])


# ── B · Shapley 順序無關 ────────────────────────────────────────

def test_B_不同鍵序產生相同貢獻(基準):
    改動 = {"住宅單價": 基準["params"]["住宅單價"] * 1.07,
            "車位數": 基準["params"]["車位數"] - 2,
            "營造單價": 基準["params"]["營造單價"] * 1.03}
    後1, 後2 = copy.deepcopy(基準), copy.deepcopy(基準)
    for k in ["住宅單價", "車位數", "營造單價"]:
        後1["params"][k] = 改動[k]
    for k in ["營造單價", "車位數", "住宅單價"]:            # 反序寫入
        後2["params"][k] = 改動[k]
    g1 = {c["feature_id"]: c["impact"] for c in attribute(基準, 後1)["contributions"]}
    g2 = {c["feature_id"]: c["impact"] for c in attribute(基準, 後2)["contributions"]}
    assert set(g1) == set(g2)
    for f in g1:
        assert abs(g1[f] - g2[f]) <= TOL, f"{f} 隨順序改變＝Shapley 實作有誤"


# ── C · 單一變更即精確 ──────────────────────────────────────────

def test_C_單一特徵_impact等於delta且殘差為零(基準):
    後 = _改(基準, 住宅單價=基準["params"]["住宅單價"] * 1.12)
    r = attribute(基準, 後)
    assert len(r["contributions"]) == 1
    assert abs(r["contributions"][0]["impact"] - r["delta"]) <= TOL
    assert abs(r["residual"]["impact"]) <= TOL


def test_C_單一變更_oat與shapley一致(基準):
    後 = _改(基準, 車位數=基準["params"]["車位數"] - 5)
    a = attribute(基準, 後, method="shapley")["contributions"][0]["impact"]
    b = attribute(基準, 後, method="oat")["contributions"][0]["impact"]
    assert abs(a - b) <= TOL


# ── D · OAT 交互作用（超過門檻自動退回，殘差不得隱藏）────────────

def test_D_超過門檻自動退回oat(基準):
    改 = {"住宅單價": 基準["params"]["住宅單價"] * 1.05,
          "車位數": 基準["params"]["車位數"] - 1,
          "營造單價": 基準["params"]["營造單價"] * 1.02}
    後 = _改(基準, **改)
    r = attribute(基準, 後, method="auto", max_features=2)
    assert r["method"]["resolved"] == "oat"
    assert r["method"]["requested"] == "auto"
    assert r["method"]["exact"] is False, "OAT 必須標為非精確，UI 才知道要顯著呈現殘差"
    assert _守恆(r) <= TOL


def test_D_oat殘差承接交互作用且非零(基準):
    後 = _改(基準, 住宅單價=基準["params"]["住宅單價"] * 1.25,
             車位數=基準["params"]["車位數"] - 8,
             營造單價=基準["params"]["營造單價"] * 1.15)
    r = attribute(基準, 後, method="oat")
    assert _守恆(r) <= TOL
    assert r["residual"]["kind"] == "numeric"
    # 交互作用存在時，OAT 的殘差不應恰為 0（否則等於宣稱無交互作用）
    assert abs(r["residual"]["impact"]) > 0


def test_D_shapley精確旗標為真(基準):
    後 = _改(基準, 住宅單價=基準["params"]["住宅單價"] * 1.05)
    assert attribute(基準, 後)["method"]["exact"] is True


def test_D_指定shapley但特徵過多_明確報錯(基準):
    後 = _改(基準, 住宅單價=1.0, 車位數=1, 營造單價=1.0)
    with pytest.raises(AttributionUnsupported) as ex:
        attribute(基準, 後, method="shapley", max_features=2)
    assert ex.value.reason_code == "shapley_too_many_features"


# ── E · 端點重播一致 ────────────────────────────────────────────

def test_E_端點值與雜湊等同直接重播(基準):
    後 = _改(基準, 住宅單價=基準["params"]["住宅單價"] * 1.06)
    r = attribute(基準, 後)
    assert r["before"]["value"] == pytest.approx(recompute(基準)["return_rate"])
    assert r["after"]["value"] == pytest.approx(recompute(後)["return_rate"])
    assert r["before"]["input_hash"] == input_hash(基準)
    assert r["after"]["input_hash"] == input_hash(後)
    assert r["before"]["input_hash"] != r["after"]["input_hash"]


def test_E_報告記錄重播所用的Core版本(基準):
    後 = _改(基準, 住宅單價=基準["params"]["住宅單價"] * 1.05)
    assert attribute(基準, 後)["core_version"] == CORE_VERSION


def test_E_runs為2的特徵數次方(基準):
    後 = _改(基準, 住宅單價=基準["params"]["住宅單價"] * 1.05,
             車位數=基準["params"]["車位數"] - 1)
    assert attribute(基準, 後)["method"]["runs"] == 4


# ── F · 不支援差異＝結構化拒答（不得有「其他」長條）──────────────

@pytest.mark.parametrize("鍵,候選", [("case_type", ("都更", "危老")),
                                     ("mode", ("全案管理", "合建"))])
def test_F_結構性純量鍵_拒答(基準, 鍵, 候選):
    後 = copy.deepcopy(基準)
    後[鍵] = next(v for v in 候選 if v != 基準[鍵])
    with pytest.raises(AttributionUnsupported) as ex:
        attribute(基準, 後)
    assert ex.value.reason_code == "structural_change"
    assert "engine." + 鍵 in ex.value.paths


def test_F_floors變更_拒答並點名路徑(基準):
    後 = copy.deepcopy(基準)
    後["floors"] = 後["floors"][:-1]
    with pytest.raises(AttributionUnsupported) as ex:
        attribute(基準, 後)
    assert "engine.floors" in ex.value.paths


def test_F_owners變更_拒答並點名路徑(基準):
    後 = copy.deepcopy(基準)
    後["owners"] = (後.get("owners") or [])[:-1]
    with pytest.raises(AttributionUnsupported) as ex:
        attribute(基準, 後)
    assert "engine.owners" in ex.value.paths


def test_F_拒答訊息明示不以其他項吸收差額(基準):
    後 = copy.deepcopy(基準)
    後["case_type"] = "都更" if 基準["case_type"] != "都更" else "危老"
    with pytest.raises(AttributionUnsupported) as ex:
        attribute(基準, 後)
    assert "其他" in str(ex.value)


def test_F_params欄位集合不同_拒答(基準):
    後 = copy.deepcopy(基準)
    後["params"].pop("車位數")
    with pytest.raises(AttributionUnsupported) as ex:
        attribute(基準, 後)
    assert ex.value.reason_code == "key_set_mismatch"


def test_F_不完整scenario_拒答(基準):
    後 = _改(基準, 住宅單價=1.0)
    with pytest.raises(AttributionUnsupported) as ex:
        attribute({"params": 基準["params"]}, 後)
    assert ex.value.reason_code == "incomplete_input"


def test_F_不接受diff式輸入(基準):
    with pytest.raises(AttributionUnsupported):
        attribute({"住宅單價": 90}, {"住宅單價": 95})


# ── 核可巢狀：params.財務覆寫.* 純量葉節點可歸因 ────────────────

def test_財務覆寫純量葉節點_可歸因(基準):
    基 = copy.deepcopy(基準)
    基["params"]["財務覆寫"] = dict(基["params"].get("財務覆寫") or {})
    基["params"]["財務覆寫"]["管理費率"] = 0.06
    後 = copy.deepcopy(基)
    後["params"]["財務覆寫"]["管理費率"] = 0.08
    r = attribute(基, 後)
    ids = [c["feature_id"] for c in r["contributions"]]
    assert ids == ["params.財務覆寫.管理費率"], "正規路徑須含巢狀層級"
    assert r["contributions"][0]["label"] == "管理費率"
    assert _守恆(r) <= TOL


def test_財務覆寫與頂層同時變更_皆入歸因(基準):
    基 = copy.deepcopy(基準)
    基["params"]["財務覆寫"] = {"管理費率": 0.06}
    後 = copy.deepcopy(基)
    後["params"]["財務覆寫"] = {"管理費率": 0.08}
    後["params"]["住宅單價"] = 基["params"]["住宅單價"] * 1.05
    r = attribute(基, 後)
    assert set(c["feature_id"] for c in r["contributions"]) == {
        "params.財務覆寫.管理費率", "params.住宅單價"}
    assert _守恆(r) <= TOL


def test_未核可的巢狀dict變更_拒答(基準):
    基 = copy.deepcopy(基準)
    基["params"]["自訂區塊"] = {"a": 1}
    後 = copy.deepcopy(基)
    後["params"]["自訂區塊"] = {"a": 2}
    with pytest.raises(AttributionUnsupported) as ex:
        attribute(基, 後)
    assert ex.value.reason_code == "unsupported_path"
    assert "params.自訂區塊" in ex.value.paths


# ── G · 目標守門 ────────────────────────────────────────────────

def test_G_未知目標_拒答(基準):
    後 = _改(基準, 住宅單價=基準["params"]["住宅單價"] * 1.05)
    with pytest.raises(AttributionUnsupported) as ex:
        attribute(基準, 後, target="irr")
    assert ex.value.reason_code == "unknown_target"


def test_G_未知method_拒答(基準):
    後 = _改(基準, 住宅單價=基準["params"]["住宅單價"] * 1.05)
    with pytest.raises(AttributionUnsupported) as ex:
        attribute(基準, 後, method="magic")
    assert ex.value.reason_code == "unknown_method"


# ── H · 輸入不可變 ──────────────────────────────────────────────

def test_H_歸因不改動任一輸入(基準):
    後 = _改(基準, 住宅單價=基準["params"]["住宅單價"] * 1.05,
             車位數=基準["params"]["車位數"] - 2)
    快照 = (json.dumps(基準, sort_keys=True, default=str),
            json.dumps(後, sort_keys=True, default=str))
    attribute(基準, 後)
    assert (json.dumps(基準, sort_keys=True, default=str),
            json.dumps(後, sort_keys=True, default=str)) == 快照


def test_H_巢狀覆寫也不被改動(基準):
    基 = copy.deepcopy(基準)
    基["params"]["財務覆寫"] = {"管理費率": 0.06}
    後 = copy.deepcopy(基)
    後["params"]["財務覆寫"] = {"管理費率": 0.08}
    before_snap = json.dumps(基, sort_keys=True, default=str)
    attribute(基, 後)
    assert json.dumps(基, sort_keys=True, default=str) == before_snap


# ── I · schema／顯示層契約 ──────────────────────────────────────

def test_I_成功報告通過schema(基準):
    後 = _改(基準, 住宅單價=基準["params"]["住宅單價"] * 1.06,
             車位數=基準["params"]["車位數"] - 2)
    assert validate_attribution(attribute(基準, 後)) is True


def test_I_顯示層由Core產出且對得起來(基準):
    後 = _改(基準, 住宅單價=基準["params"]["住宅單價"] * 1.08,
             車位數=基準["params"]["車位數"] - 3)
    p = attribute(基準, 後)["presentation"]
    可見和 = round(sum(c["impact"] for c in p["contributions"])
                  + p["residual"] + p["rounding_reconciliation"], p["precision"])
    assert 可見和 == pytest.approx(p["delta"], abs=10 ** (-p["precision"]) / 2)
    assert p["display_ok"] is True


def test_I_顯示值為ppt而非小數(基準):
    後 = _改(基準, 住宅單價=基準["params"]["住宅單價"] * 1.05)
    r = attribute(基準, 後)
    assert r["presentation"]["before"] == pytest.approx(r["before"]["value"] * 100, abs=0.005)
    assert r["target"]["display_unit"] == "percentage_points"
    assert r["target"]["raw_unit"] == "ratio"


def test_I_進位對帳不得混入殘差(基準):
    後 = _改(基準, 住宅單價=基準["params"]["住宅單價"] * 1.077,
             車位數=基準["params"]["車位數"] - 7)
    r = attribute(基準, 後)
    p = r["presentation"]
    assert "rounding_reconciliation" in p
    # 顯示殘差必須是 raw 殘差的四捨五入，未被塞入進位誤差
    assert p["residual"] == pytest.approx(
        round(r["residual"]["impact"] * 100, p["precision"]), abs=1e-9)


def test_I_守恆為假時不得回傳報告(基準, monkeypatch):
    後 = _改(基準, 住宅單價=基準["params"]["住宅單價"] * 1.05)
    r = attribute(基準, 後)
    r["residual"]["impact"] += 1.0                     # 人為破壞守恆
    with pytest.raises(ValueError, match="守恆違規"):
        validate_attribution(r)


def test_I_排序為影響絕對值遞減(基準):
    後 = _改(基準, 住宅單價=基準["params"]["住宅單價"] * 1.1,
             車位數=基準["params"]["車位數"] - 1)
    影響 = [abs(c["impact"]) for c in attribute(基準, 後)["contributions"]]
    assert 影響 == sorted(影響, reverse=True)


def test_I_無變更時_誠實回報且不臆造原因(基準):
    r = attribute(基準, copy.deepcopy(基準))
    assert r["contributions"] == []
    assert r["method"]["resolved"] == "none"
    assert r["method"]["feature_count"] == 0
    assert abs(r["delta"]) <= TOL and abs(r["residual"]["impact"]) <= TOL


# ── 單位誠實：全案投報率，不是 IRR ──────────────────────────────

def test_目標標示為全案投報率(基準):
    後 = _改(基準, 住宅單價=基準["params"]["住宅單價"] * 1.05)
    t = attribute(基準, 後)["target"]
    assert t["label"] == "全案投報率" and t["id"] == "return_rate"
    assert t["higher_is_better"] is True


def test_輸出全文不得出現IRR字樣(基準):
    後 = _改(基準, 住宅單價=基準["params"]["住宅單價"] * 1.05)
    文 = json.dumps(attribute(基準, 後), ensure_ascii=False).upper()
    assert "IRR" not in 文, "全案投報率不得標示或換算為 IRR"


# ── 紅線：零公式複製 ────────────────────────────────────────────

def test_歸因模組不得引用計算模組():
    源 = (根 / "core" / "redcf" / "attribution.py").read_text(encoding="utf-8")
    for 禁 in ("from core.redcf.finance", "from core.redcf.capacity",
               "from core.redcf.efficiency", "from core.redcf.valuation",
               "from core.redcf.contract"):
        assert 禁 not in 源, f"歸因層不得複製公式來源（發現 {禁}）——只准呼叫 recompute"
    assert "from core.redcf.recompute import" in 源


# ── Shapley 公理（演算法層單元測試）──────────────────────────────
# 論文附錄 I 承諾之「對稱性、虛擬因子」測試；效率性與排列不變性已於 A/B 覆蓋。
# 這裡直接對 _shapley 餵合成價值函數——公理是**演算法的性質**，
# 不該只靠特定領域資料碰巧成立來證明。

from core.redcf.attribution import _shapley


def _ev(fn):
    """把 frozenset→值 的純函式包成 _shapley 需要的 evaluate。"""
    return lambda paths: fn(frozenset(paths))


def test_公理_效率性_加總等於全集減空集():
    f = ["params.a", "params.b", "params.c"]
    v = lambda S: len(S) ** 2 + 3 * len(S)
    phi = _shapley(_ev(v), f)
    assert sum(phi.values()) == pytest.approx(v(frozenset(f)) - v(frozenset()), abs=TOL)


def test_公理_對稱性_可互換因子貢獻相等():
    """v 僅依賴集合大小 → 所有因子皆可互換 → 貢獻必須完全相等。"""
    f = ["params.a", "params.b", "params.c", "params.d"]
    v = lambda S: len(S) ** 3                      # 高度非線性，但完全對稱
    phi = _shapley(_ev(v), f)
    vals = list(phi.values())
    for x in vals:
        assert abs(x - vals[0]) <= TOL, "可互換因子的 Shapley 貢獻必須相等（對稱性公理）"


def test_公理_對稱性_成對可互換():
    """a 與 b 可互換、c 獨立：φ(a) 必須等於 φ(b)，且不必等於 φ(c)。"""
    f = ["params.a", "params.b", "params.c"]
    def v(S):
        ab = len(S & {"params.a", "params.b"})
        return 5 * ab + 11 * (1 if "params.c" in S else 0) + 2 * ab * (1 if "params.c" in S else 0)
    phi = _shapley(_ev(v), f)
    assert abs(phi["params.a"] - phi["params.b"]) <= TOL
    assert abs(phi["params.a"] - phi["params.c"]) > TOL


def test_公理_虛擬因子_零貢獻():
    """加入 d 從不改變 v → φ(d) 必須恰為 0，不得把交互作用誤攤給它。"""
    f = ["params.a", "params.b", "params.d"]
    v = lambda S: 7 * len(S & {"params.a", "params.b"}) ** 2
    phi = _shapley(_ev(v), f)
    assert abs(phi["params.d"]) <= TOL, "虛擬因子的貢獻必須為零（dummy player 公理）"


def test_公理_線性_可加性():
    """φ(v₁+v₂) ＝ φ(v₁)＋φ(v₂)。"""
    f = ["params.a", "params.b", "params.c"]
    v1 = lambda S: len(S) ** 2
    v2 = lambda S: 4 * len(S & {"params.a"}) - len(S & {"params.c"})
    p1 = _shapley(_ev(v1), f)
    p2 = _shapley(_ev(v2), f)
    ps = _shapley(_ev(lambda S: v1(S) + v2(S)), f)
    for k in f:
        assert abs(ps[k] - (p1[k] + p2[k])) <= TOL


def test_公理_排列不變性_打亂特徵順序結果相同():
    f = ["params.a", "params.b", "params.c"]
    v = lambda S: len(S) ** 2 + 2 * len(S & {"params.b"})
    a = _shapley(_ev(v), f)
    b = _shapley(_ev(v), list(reversed(f)))
    for k in f:
        assert abs(a[k] - b[k]) <= TOL


# ── 虛擬因子（領域層）──────────────────────────────────────────

def test_虛擬因子_領域層_不影響目標者貢獻為零(基準):
    """屋齡不進入 return_rate 的計算鏈 → 其貢獻必須為 0，
    且不得被當成「無法解釋」而灌進殘差。"""
    後 = _改(基準, 屋齡=基準["params"]["屋齡"] * 2,
             住宅單價=基準["params"]["住宅單價"] * 1.06)
    r = attribute(基準, 後)
    by = {c["feature_id"]: c["impact"] for c in r["contributions"]}
    assert "params.屋齡" in by, "有變動的欄位仍須列出（誠實揭露它被評估過）"
    assert abs(by["params.屋齡"]) <= TOL, "不影響目標的因子貢獻須為零"
    assert abs(by["params.住宅單價"] - r["delta"]) <= TOL
    assert abs(r["residual"]["impact"]) <= TOL


def test_虛擬因子_全為虛擬時_delta與各貢獻皆為零(基準):
    後 = _改(基準, 屋齡=基準["params"]["屋齡"] + 5, 地價=基準["params"]["地價"] * 1.3)
    r = attribute(基準, 後)
    assert abs(r["delta"]) <= TOL
    assert all(abs(c["impact"]) <= TOL for c in r["contributions"])
    assert r["conservation"]["raw_ok"] is True


# ── 決定性：同一輸入必得同一份報告（時戳為何不進契約）──────────

def test_決定性_重跑同一輸入得到逐位元相同的報告(基準):
    """計畫 §6 要求「重跑同一快照結果一致」。這條性質與「輸出含計算時間」
    互斥——牆鐘時戳會讓同一輸入產生不同 JSON。本實作選擇**決定性**：
    報告是輸入的純函式，時戳屬傳輸／UI 層，不進 Core 契約。"""
    後 = _改(基準, 住宅單價=基準["params"]["住宅單價"] * 1.07,
             車位數=基準["params"]["車位數"] - 2)
    a = json.dumps(attribute(基準, 後), sort_keys=True, ensure_ascii=False)
    b = json.dumps(attribute(基準, 後), sort_keys=True, ensure_ascii=False)
    assert a == b, "同一輸入必須產生逐位元相同的報告（決定性）"


def test_決定性_報告不含任何牆鐘時間欄位(基準):
    後 = _改(基準, 住宅單價=基準["params"]["住宅單價"] * 1.05)
    r = attribute(基準, 後)
    for k in ("computed_at", "timestamp", "generated_at", "ts"):
        assert k not in r, f"報告不得含牆鐘時間欄位 {k}——那會破壞決定性"
