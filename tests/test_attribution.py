# -*- coding: utf-8 -*-
"""tests/test_attribution.py — M7.4 歸因引擎對抗性回歸（M7_CASE_OS_SPEC §11 Case A–C）

守的是「可質詢的結論」這件事本身：
  Case A 加總守恆——列出的原因必須加得回實際變化量（信任的地基）
  Case B 順序無關——同一組變更換順序，Shapley 貢獻度完全相同
  Case C 單一變更即精確——只改一項時，該項 impact ＝ delta 且 residual ＝ 0
＋首版邊界：結構性變更明確拒答（不以「其他」吸收差額）
＋單位誠實：return_rate ＝「全案投報率」／ppt，**不得稱為 IRR**
"""
import copy
import json
import pathlib

import pytest

from core.redcf import attribute, validate_attribution, AttributionUnsupported

根 = pathlib.Path(__file__).resolve().parents[1]
範例 = 根 / "schemas" / "examples" / "v2" / "v2_1_案例D_權變示範.json"
容差 = 1e-9


@pytest.fixture
def 基準():
    return copy.deepcopy(json.loads(範例.read_text(encoding="utf-8"))["engine"])


def _改(engine, **欄位):
    e = copy.deepcopy(engine)
    e["params"].update(欄位)
    return e


# ── Case A · 加總守恆（最重要）──────────────────────────────────

def test_CaseA_三欄位變更_加總守恆(基準):
    後 = _改(基準, 住宅單價=基準["params"]["住宅單價"] * 1.08,
             車位數=基準["params"]["車位數"] - 3,
             營造單價=基準["params"]["營造單價"] * 1.05)
    r = attribute(基準, 後)
    assert len(r["contributions"]) == 3
    assert abs(sum(c["impact"] for c in r["contributions"]) + r["residual"] - r["delta"]) <= 容差
    assert r["conservation_ok"] is True


def test_CaseA_守恆旗標與誤差欄位一致(基準):
    後 = _改(基準, 住宅單價=基準["params"]["住宅單價"] * 1.1, 戶數=基準["params"]["戶數"])
    r = attribute(基準, 後)
    assert r["conservation_ok"] is (r["conservation_error"] <= 容差)


def test_CaseA_加總橋從前值走到後值(基準):
    後 = _改(基準, 住宅單價=基準["params"]["住宅單價"] * 1.06,
             車位單價=基準["params"]["車位單價"] * 0.9)
    r = attribute(基準, 後)
    橋 = r["bridge"]
    assert 橋[0]["step"] == "start" and abs(橋[0]["value"] - r["before_value"]) <= 容差
    assert 橋[-1]["step"] == "end" and abs(橋[-1]["value"] - r["after_value"]) <= 容差
    # 倒數第二段（殘差）的 running 必須落在後值上——這就是「看得見的加總」
    assert abs(橋[-2]["running"] - r["after_value"]) <= 容差
    assert [s["step"] for s in 橋].count("residual") == 1


# ── Case B · 順序無關 ────────────────────────────────────────────

def test_CaseB_shapley與輸入順序無關(基準):
    改動 = {"住宅單價": 基準["params"]["住宅單價"] * 1.07,
            "車位數": 基準["params"]["車位數"] - 2,
            "營造單價": 基準["params"]["營造單價"] * 1.03}

    後1 = copy.deepcopy(基準)
    for k in ["住宅單價", "車位數", "營造單價"]:
        後1["params"][k] = 改動[k]
    後2 = copy.deepcopy(基準)
    for k in ["營造單價", "車位數", "住宅單價"]:          # 反序寫入
        後2["params"][k] = 改動[k]

    r1, r2 = attribute(基準, 後1), attribute(基準, 後2)
    g1 = {c["field"]: c["impact"] for c in r1["contributions"]}
    g2 = {c["field"]: c["impact"] for c in r2["contributions"]}
    assert set(g1) == set(g2)
    for f in g1:
        assert abs(g1[f] - g2[f]) <= 容差, f"{f} 的貢獻隨順序改變＝Shapley 實作有誤"


# ── Case C · 單一變更即精確 ──────────────────────────────────────

def test_CaseC_單一欄位_impact等於delta且殘差為零(基準):
    後 = _改(基準, 住宅單價=基準["params"]["住宅單價"] * 1.12)
    r = attribute(基準, 後)
    assert len(r["contributions"]) == 1
    assert abs(r["contributions"][0]["impact"] - r["delta"]) <= 容差
    assert abs(r["residual"]) <= 容差


def test_CaseC_單一變更_oat與shapley一致(基準):
    後 = _改(基準, 車位數=基準["params"]["車位數"] - 5)
    a = attribute(基準, 後, method="shapley")
    b = attribute(基準, 後, method="oat")
    assert abs(a["contributions"][0]["impact"] - b["contributions"][0]["impact"]) <= 容差


# ── OAT 退路：加總可能不等，但殘差必須補回 ──────────────────────

def test_OAT_殘差承接交互作用後仍守恆(基準):
    後 = _改(基準, 住宅單價=基準["params"]["住宅單價"] * 1.15,
             車位數=基準["params"]["車位數"] - 4,
             營造單價=基準["params"]["營造單價"] * 1.08)
    r = attribute(基準, 後, method="oat")
    assert r["method"] == "oat"
    assert abs(sum(c["impact"] for c in r["contributions"]) + r["residual"] - r["delta"]) <= 容差


def test_auto_在欄位少時選shapley(基準):
    後 = _改(基準, 住宅單價=基準["params"]["住宅單價"] * 1.05)
    assert attribute(基準, 後, method="auto")["method"] == "shapley"


def test_auto_在欄位多時退回oat(基準):
    後 = _改(基準, 住宅單價=基準["params"]["住宅單價"] * 1.02,
             車位數=基準["params"]["車位數"] - 1,
             營造單價=基準["params"]["營造單價"] * 1.01)
    r = attribute(基準, 後, method="auto", max_shapley_fields=2)
    assert r["method"] == "oat"


def test_指定shapley但欄位過多_明確報錯(基準):
    後 = _改(基準, 住宅單價=1.0, 車位數=1, 營造單價=1.0)
    with pytest.raises(AttributionUnsupported, match="超過上限"):
        attribute(基準, 後, method="shapley", max_shapley_fields=2)


# ── 首版邊界：結構性變更明確拒答（不做虛假的「其他」歸因）────────

@pytest.mark.parametrize("鍵,候選", [("case_type", ("都更", "危老")),
                                     ("mode", ("全案管理", "合建"))])
def test_結構性變更_純量鍵_拒答(基準, 鍵, 候選):
    後 = copy.deepcopy(基準)
    後[鍵] = next(v for v in 候選 if v != 基準[鍵])      # 必取與原值不同者
    with pytest.raises(AttributionUnsupported, match="結構性變更"):
        attribute(基準, 後)


def test_結構性變更_floors_拒答(基準):
    後 = copy.deepcopy(基準)
    後["floors"] = 後["floors"][:-1]
    with pytest.raises(AttributionUnsupported, match="結構性變更"):
        attribute(基準, 後)


def test_結構性變更_owners_拒答(基準):
    後 = copy.deepcopy(基準)
    後["owners"] = (後.get("owners") or [])[:-1]
    with pytest.raises(AttributionUnsupported, match="結構性變更"):
        attribute(基準, 後)


def test_拒答訊息點名不以其他項吸收差額(基準):
    後 = copy.deepcopy(基準)
    後["case_type"] = "都更" if 基準["case_type"] != "都更" else "危老"
    with pytest.raises(AttributionUnsupported) as ex:
        attribute(基準, 後)
    assert "其他" in str(ex.value)


def test_非純量欄位變更_拒答(基準):
    後 = copy.deepcopy(基準)
    後["params"]["財務覆寫"] = {"管理費率": 0.07}
    with pytest.raises(AttributionUnsupported, match="非純量"):
        attribute(基準, 後)


# ── 首版只吃完整 Scenario ────────────────────────────────────────

def test_不完整scenario_缺floors_拒答(基準):
    後 = _改(基準, 住宅單價=1.0)
    殘缺 = {"params": 基準["params"]}
    with pytest.raises(AttributionUnsupported, match="完整 Scenario"):
        attribute(殘缺, 後)


def test_不接受diff式輸入(基準):
    with pytest.raises(AttributionUnsupported):
        attribute({"住宅單價": 90}, {"住宅單價": 95})


def test_params欄位集合不同_拒答(基準):
    後 = copy.deepcopy(基準)
    後["params"].pop("車位數")
    with pytest.raises(AttributionUnsupported, match="欄位集合不同"):
        attribute(基準, 後)


def test_未知目標_拒答(基準):
    後 = _改(基準, 住宅單價=基準["params"]["住宅單價"] * 1.05)
    with pytest.raises(AttributionUnsupported):
        attribute(基準, 後, target="irr")


# ── 單位誠實：全案投報率／ppt，不是 IRR ─────────────────────────

def test_return_rate_標為全案投報率且單位ppt(基準):
    後 = _改(基準, 住宅單價=基準["params"]["住宅單價"] * 1.05)
    r = attribute(基準, 後)
    assert r["target_label"] == "全案投報率"
    assert r["unit"] == "ppt"


def test_輸出全文不得出現IRR字樣(基準):
    後 = _改(基準, 住宅單價=基準["params"]["住宅單價"] * 1.05)
    文 = json.dumps(attribute(基準, 後), ensure_ascii=False).upper()
    assert "IRR" not in 文, "全案投報率不得標示或換算為 IRR"


def test_ppt換算_delta為百分點而非小數(基準):
    後 = _改(基準, 住宅單價=基準["params"]["住宅單價"] * 1.05)
    r = attribute(基準, 後)
    from core.redcf import recompute
    前 = recompute(基準)["return_rate"]
    assert abs(r["before_value"] - 前 * 100.0) <= 容差


# ── 溯源與合約 ──────────────────────────────────────────────────

def test_輸出通過schema並複核守恆(基準):
    後 = _改(基準, 住宅單價=基準["params"]["住宅單價"] * 1.06,
             車位數=基準["params"]["車位數"] - 2)
    assert validate_attribution(attribute(基準, 後)) is True


def test_帶前後input_hash可溯源(基準):
    後 = _改(基準, 住宅單價=基準["params"]["住宅單價"] * 1.05)
    r = attribute(基準, 後)
    from core.redcf import input_hash
    assert r["before_hash"] == input_hash(基準)
    assert r["after_hash"] == input_hash(後)
    assert r["before_hash"] != r["after_hash"]


def test_無變更時_delta為零且不臆造原因(基準):
    r = attribute(基準, copy.deepcopy(基準))
    assert r["contributions"] == [] and r["method"] == "none"
    assert abs(r["delta"]) <= 容差 and abs(r["residual"]) <= 容差


def test_runs記錄實際重算次數_shapley為2的n次方(基準):
    後 = _改(基準, 住宅單價=基準["params"]["住宅單價"] * 1.05,
             車位數=基準["params"]["車位數"] - 1)
    assert attribute(基準, 後)["runs"] == 4


def test_貢獻依影響絕對值排序(基準):
    後 = _改(基準, 住宅單價=基準["params"]["住宅單價"] * 1.1,
             車位數=基準["params"]["車位數"] - 1)
    影響 = [abs(c["impact"]) for c in attribute(基準, 後)["contributions"]]
    assert 影響 == sorted(影響, reverse=True)


# ── 紅線：零公式複製（只准呼叫 recompute）────────────────────────

def test_歸因模組不得直接引用計算模組():
    源 = (根 / "core" / "redcf" / "attribution.py").read_text(encoding="utf-8")
    for 禁 in ("from core.redcf.finance", "from core.redcf.capacity",
               "from core.redcf.efficiency", "from core.redcf.valuation",
               "from core.redcf.contract"):
        assert 禁 not in 源, f"歸因層不得複製公式來源（發現 {禁}）——只准呼叫 recompute"
    assert "from core.redcf.recompute import" in 源


def test_歸因不改動輸入(基準):
    前快照 = json.dumps(基準, sort_keys=True, ensure_ascii=False, default=str)
    後 = _改(基準, 住宅單價=基準["params"]["住宅單價"] * 1.05)
    attribute(基準, 後)
    assert json.dumps(基準, sort_keys=True, ensure_ascii=False, default=str) == 前快照
