# -*- coding: utf-8 -*-
"""
core/valuation.py — 更新前價值估算（L7 權利變換基準）
=====================================================
Urban Renewal Core Engine ── 更新前土地 + 建物現值，作為權利變換比例分母。
法源：都市更新條例 §56 — 權利變換以「更新前各宗土地及建物現值」為基礎計算比例。

⚠️ vNext 待補（roadmap P1）：路寬、使用分區、建物型態係數尚未納入；
   目前為土地 × 地價 + 建物殘值 的基礎版，待真實估價數據進一步校準。
"""

import json
import pathlib

from core.redcf.capacity import 平方米換坪


def calc_更新前價值(基地面積, 地價_萬坪, 既有建物面積=0.0, 建物單價=0.0,
                   屋齡=0, 折舊率=0.02) -> dict:
    """
    更新前土地 + 建物現值估算。
      土地現值 = 基地坪 × 地價（萬/坪）
      建物現值 = 建物坪 × 建物單價 × 殘值率
      殘值率   = max(0, 1 − 折舊率 × 屋齡)　RC 造法定折舊 2%/年（耐用年限 50 年）
    回傳值作為權利變換「各地主更新前貢獻比例」的分母基準。
    """
    基地坪 = 基地面積 / 平方米換坪
    土地現值 = 基地坪 * 地價_萬坪
    建物殘值率 = max(0.0, 1.0 - 折舊率 * 屋齡)
    建物坪 = 既有建物面積 / 平方米換坪
    建物現值 = 建物坪 * 建物單價 * 建物殘值率
    更新前總值 = 土地現值 + 建物現值
    return {
        "基地坪": 基地坪,
        "土地現值": 土地現值,
        "建物坪": 建物坪,
        "建物現值": 建物現值,
        "建物殘值率": 建物殘值率,
        "更新前總值": 更新前總值,
    }


# ════════════════════════════════════════════════════════════════════
# B 系列：更新前價值係數矩陣（沙盤逐戶權值分母；§56 權值比例）
# ────────────────────────────────────────────────────────────────────
# 單戶更新前價值 ＝ 基準單價 × 路寬 × 分區 × 建物型態 × 樓層 × 面積 → 權值比例。
# 係數**不寫死在程式**：讀 apps/web/coefficients.json（單一可換檔來源；校準真實估價
# 只換該檔、不動本模組）。該檔置於 apps/web＝離線沙盤（Pages 根＝apps/web）須同源
# fetch 同一份係數；本模組只是「讀資料」，非依賴 UI（Gate 2 不受影響）。
# 決定性 PRNG（LCG）與沙盤 JS `_lcg` 位元對齊：同 seed→同矩陣，Python↔JS 可對測。
# ════════════════════════════════════════════════════════════════════

_根 = pathlib.Path(__file__).resolve().parents[2]
COEFF_PATH = _根 / "apps" / "web" / "coefficients.json"
_NOTE_KEY = "_note"


def load_coefficients(path=None) -> dict:
    """讀係數表。強制 `_note` 存在（核准紅線：非估價值標示不得移除，缺則報錯）。"""
    p = pathlib.Path(path) if path else COEFF_PATH
    data = json.loads(p.read_text(encoding="utf-8"))
    if not data.get(_NOTE_KEY):
        raise ValueError("coefficients.json 缺 _note 標示（核准紅線：非估價值標示不得移除）")
    return data


def _表映射(pairs) -> dict:
    """[[label, value], ...] → {label: value}（保留 JSON 順序語意，供查表）。"""
    return {k: v for k, v in pairs}


def calc_戶價值(戶, coeff=None) -> float:
    """單戶更新前價值。戶＝{road, zoning, building, floor, area_坪, base_單價?}。
    ＝ 基準單價 × 路寬 × 分區 × 型態 × 樓層 × 面積（B 系列係數，非估價值）。"""
    c = coeff or load_coefficients()
    road = _表映射(c["road_width"]); zone = _表映射(c["zoning"])
    bldg = _表映射(c["building_type"]); flr = _表映射(c["floor"])
    base = 戶.get("base_單價", c["base_price_萬per坪"]["default"])
    乘積 = road[戶["road"]] * zone[戶["zoning"]] * bldg[戶["building"]] * flr[戶["floor"]]
    return round(base * 乘積 * 戶["area_坪"], 2)


def _lcg(seed: int):
    """決定性 32-bit LCG——與沙盤 JS 版位元對齊。回傳 () -> float in [0,1)。"""
    s = seed & 0xFFFFFFFF
    def nxt():
        nonlocal s
        s = (s * 1664525 + 1013904223) & 0xFFFFFFFF
        return s / 0x100000000
    return nxt


def _選(pairs, r):
    """由 [0,1) 選一個 label；桶寬均分（與 JS 版同序、同索引）。"""
    return pairs[min(len(pairs) - 1, int(r * len(pairs)))][0]


def build_owner_matrix(n: int, seed: int = 0, base_單價=None, coeff=None) -> list:
    """程序生成 n 戶（12–80）更新前價值矩陣。決定性：同 (n, seed, base)→同結果。
    回傳 [{owner_id, road, zoning, building, floor, area_坪, pre_value, weight}]；
    weight＝pre_value / Σpre_value（§56 權值比例）。"""
    if not (12 <= n <= 80):
        raise ValueError("戶數 n 需在 12–80（B1 可變戶數矩陣）")
    c = coeff or load_coefficients()
    base = base_單價 if base_單價 is not None else c["base_price_萬per坪"]["default"]
    rng = _lcg(seed)
    戶列 = []
    for i in range(n):
        戶 = {"owner_id": "W%02d" % (i + 1),
              "road": _選(c["road_width"], rng()), "zoning": _選(c["zoning"], rng()),
              "building": _選(c["building_type"], rng()), "floor": _選(c["floor"], rng()),
              "area_坪": round(15 + rng() * 35, 1), "base_單價": base}
        戶["pre_value"] = calc_戶價值(戶, c)
        戶列.append(戶)
    總值 = sum(x["pre_value"] for x in 戶列) or 1.0
    for x in 戶列:
        x["weight"] = round(x["pre_value"] / 總值, 6)
        x.pop("base_單價", None)
    return 戶列
