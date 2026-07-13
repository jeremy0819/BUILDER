# -*- coding: utf-8 -*-
"""
core/redcf/cashflow.py — 現金流分期（M3 結構性第一版；M4 才做實案校準）
========================================================================
把共同負擔六大科目（calc_共同負擔 的 A–G 實額）攤到分期時間軸上，輸出
逐期出資、累積曲線與峰值資金需求。

**紅線與誠實界線**：
  - 本模組是**純算術分配**（科目金額 × 期別權重），不含任何新財務公式；
    科目金額一律來自 calc_投報全案／calc_共同負擔（SSOT）。
  - 期別權重（哪個階段花多少）屬**校準參數**——本版**不臆造**行業曲線；
    未提供權重時採「均勻分佈」並在輸出標記 structural=True（結構示意）。
    實案 S 曲線（規劃→基礎→結構→裝修→交屋）待 M4 以在建實案校準、
    使用者核准後才落地（ROADMAP M4、VERSION_POLICY 🔴）。
"""

# calc_投報全案 輸出中的共同負擔科目鍵（A–G；G 土地成本僅合建/買賣模式非零）
科目鍵 = ["A工程費用", "B管維費用", "C權變費用", "D貸款利息",
          "E稅捐", "F管理費用", "G土地成本"]


def calc_現金流分期(投: dict, 期數: int = 8, 權重: list = None) -> dict:
    """共同負擔科目 → 分期出資／累積曲線／峰值資金需求（結構性分配）。

    參數：
      投    — calc_投報全案 的輸出 dict（取其中 A–G 科目與共同負擔總額）。
      期數  — 分期期別數（預設 8 期，純結構切分）。
      權重  — 各期出資比重 list（長度＝期數；會正規化到 Σ=1）。
              None＝均勻分佈（結構示意；實務 S 曲線待 M4 校準）。

    回傳 dict：
      科目        — {科目: 金額}（只收非零科目，萬元）
      期別出資    — list[float]，各期出資（萬元）
      累積        — list[float]，累積出資曲線（萬元）
      峰值資金    — float，＝累積末值＝共同負擔總額（守恆）
      期數/structural — 分期參數與「均勻結構示意」標記
    """
    if 期數 < 1:
        raise ValueError("期數必須 ≥ 1")
    if 權重 is None:
        w = [1.0 / 期數] * 期數
        structural = True
    else:
        if len(權重) != 期數:
            raise ValueError(f"權重長度 {len(權重)} ≠ 期數 {期數}")
        Σ = float(sum(權重))
        if Σ <= 0:
            raise ValueError("權重總和必須 > 0")
        w = [float(x) / Σ for x in 權重]
        structural = False

    科目 = {k: float(投.get(k, 0.0)) for k in 科目鍵 if float(投.get(k, 0.0)) != 0.0}
    總額 = sum(科目.values())

    期別 = [round(總額 * wi, 2) for wi in w]
    # 尾期吸收捨入差，確保 Σ期別 ＝ 總額（守恆到分）
    期別[-1] = round(期別[-1] + (round(總額, 2) - round(sum(期別), 2)), 2)

    累積, run = [], 0.0
    for x in 期別:
        run = round(run + x, 2)
        累積.append(run)

    return {"科目": 科目, "期別出資": 期別, "累積": 累積,
            "峰值資金": 累積[-1] if 累積 else 0.0,
            "期數": 期數, "structural": structural}
