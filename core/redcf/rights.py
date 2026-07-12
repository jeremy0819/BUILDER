# -*- coding: utf-8 -*-
"""
core/redcf/rights.py — 權利變換分配與找補（M3・Rights & Compensation）
======================================================================
把「案件總量」算到「逐戶」。本模組只做**權利變換分配結構**（都更條例 §56：
以更新前各戶權利價值比例分配更新後可分配總值）與**找補（equalization）**——
不含任何秘密校準費率；每戶的更新前權利價值（pre_value）由 owners 輸入提供。

紅線：
  - 公式只在 core/；本模組新增的是**結構性分配公式**（§56 比例分配），
    不改動任何既有黃金測試期望值、不新增校準費率。
  - 更新前價值的「路寬/分區/建物型態係數」屬校準參數——**本模組不臆造**，
    待使用者核准後再於 valuation 擴充（見 ROADMAP M3、REVIEW）。
法源：都市更新條例 §56（權利變換以更新前各宗土地及建物現值為基礎計算比例）。
"""


def calc_權利變換(owners: list, 更新後可分配總值: float) -> list:
    """§56 比例分配：以更新前各戶權利價值（pre_value）比例，分配更新後可分配總值。

    參數：
      owners            — list[dict]，每戶需含 `pre_value`（更新前權利價值，萬元）；
                          建議含 `owner_id`。其餘欄位原樣保留。
      更新後可分配總值   — 地主分回價值總額（萬元）＝ result['owner_return_value']。

    回傳：list[dict]，每戶在原欄位上補：
      `權值比例`（0–1，Σ=1）、`return_value`（逐戶分回價值，萬元）。

    邊界：Σpre_value=0（無估值資料）時，權值比例與 return_value 皆為 0，
          並不臆測（逐戶分回不可算，交還輸入補齊）。
    """
    Σ權值 = sum(o.get("pre_value", 0.0) for o in owners)
    out = []
    for o in owners:
        比例 = (o.get("pre_value", 0.0) / Σ權值) if Σ權值 > 0 else 0.0
        out.append({**o,
                    "權值比例": round(比例, 6),
                    "return_value": round(更新後可分配總值 * 比例, 2)})
    return out


def calc_找補(owner_allocations: list, 選配價值: dict = None) -> list:
    """找補金 equalization ＝ 選配不動產價值 − 分配權利價值(return_value)。

    正值＝**補入**（地主須找補差額給實施者，選配 > 分配）；
    負值＝**找出**（實施者補償地主，選配 < 分配）。

    參數：
      owner_allocations — calc_權利變換 的輸出（含 `return_value`、`owner_id`）。
      選配價值           — {owner_id: 選配不動產價值(萬元)}；未提供該戶者，
                          `equalization` 設 None（＝尚未選配，待輸入）。

    回傳：list[dict]，每戶補 `equalization`（萬元，或 None）。
    """
    選配價值 = 選配價值 or {}
    out = []
    for o in owner_allocations:
        sel = 選配價值.get(o.get("owner_id"))
        eq = round(sel - o.get("return_value", 0.0), 2) if sel is not None else None
        out.append({**o, "equalization": eq})
    return out


def build_owner_allocations(owners: list, 更新後可分配總值: float,
                            選配價值: dict = None) -> list:
    """便利函式：一步算出逐戶 return_value ＋ equalization。

    ＝ calc_找補(calc_權利變換(owners, 更新後可分配總值), 選配價值)。
    供 UI/消費端一次取得逐戶分回表；仍全部走上面兩個 §56 結構公式，零校準費率。
    """
    return calc_找補(calc_權利變換(owners, 更新後可分配總值), 選配價值)
