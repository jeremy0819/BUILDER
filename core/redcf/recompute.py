# -*- coding: utf-8 -*-
"""
core/redcf/recompute.py — schema v2.0「完整可重算」引擎（M2-A）
================================================================
v1.1 合約的已知缺口：不含逐層樓板表（floors），故「從合約 JSON 重算 result」不可行，
稽核鏈斷（數字無法回放驗證）。v2.0 把重算所需的全部輸入收進 `engine` 快照，
本模組據此**從輸入重算出 result**，並可與檔內既存 result 逐欄位比對（verify）。

設計：
  - recompute(engine) → result：完全複刻 generate_examples._算 的計算鏈，
    再走既有 build_result_json（唯一 result 產生器；不新增任何公式）。
  - input_hash(engine) → sha256：對正規化序列化的輸入取雜湊，寫入 provenance，
    作為「這份 result 對應哪份輸入」的溯源指紋。
  - verify(doc) → (ok, diffs)：重算 doc['engine'] 並與 doc['result'] 比對，
    容差 0.5（面積/金額）、1e-6（比率），供 CI 與儀表板顯示「可重算驗證」。

紅線：本模組不含任何計算公式——只是「照 engine 輸入呼叫既有 core.calc_*」。
"""

import hashlib
import json

from core.redcf.capacity import calc_容積查核, 平方米換坪
from core.redcf.efficiency import calc_坪效
from core.redcf.finance import calc_投報全案, 財務率預設
from core.redcf.valuation import calc_更新前價值
from core.redcf.contract import build_result_json
from core.redcf.rights import calc_權利變換, calc_找補

# verify 逐欄位容差：面積/金額用絕對值 0.5；比率用 1e-6
_容差_絕對 = 0.5
_容差_比率 = 1e-6
_比率欄位 = {"efficiency_ratio", "shared_cost_ratio", "owner_return_ratio",
             "return_rate", "value_multiple"}


def _組p(params: dict) -> dict:
    """從參數 dict 組出財務 p（複刻 generate_examples._算 的 p 組法）。"""
    p = {**財務率預設,
         **{k: params[k] for k in ("住宅單價", "店舖坪數", "店舖單價", "車位數", "車位單價",
                                   "營造單價", "戶數", "權變戶數") if k in params},
         "土地成本": params.get("土融土地成本", 0.0)}
    p.update(params.get("財務覆寫", {}))
    return p


def recompute(engine: dict, computed_at: str = None) -> dict:
    """從 v2 輸入快照 engine 重算出 result（英文 key，對齊 build_result_json）。

    engine 必含：
      params  — L1 參數 dict（中文 key，＝範本參數 同結構，含單價等）
      floors  — 逐層樓板 records（list[dict]，中文 key：啟用/樓層/樓板/計容積/梯廳/安全梯/陽台）
      case_type — "都更" | "危老"
      mode    — 投報模式："全案管理" | "合建" | "買賣"
    """
    P = dict(engine["params"])
    floors = engine["floors"]
    案件類型 = engine.get("case_type", "都更")
    模式 = engine.get("mode", "全案管理")

    容 = calc_容積查核(P, floors)
    坪 = calc_坪效(容["允建容積"], 容["陽台免計面積"], P["公設比"])
    p = _組p(P)
    投 = calc_投報全案(坪["銷售坪數"], 容["總樓地板面積"] / 平方米換坪, p, 模式)
    前 = (calc_更新前價值(P["基地面積"], P["地價"], P.get("既有建物面積", 0.0),
                        P.get("建物單價", 0.0), int(P.get("屋齡", 45)))
          if P.get("地價", 0) > 0 else None)

    result = build_result_json(容, 坪, 投, 前, 案件類型, 模式,
                               engine.get("owners"), computed_at)

    # ── M3（schema v2.1）：逐戶權利變換分配 ──
    # owners 帶更新前權利價值（pre_value）時，附上 §56 比例分配的逐戶分回表；
    # 有 selected_value（選配價值）者一併算找補。全部委派 rights.py，本處零公式。
    owners = engine.get("owners") or []
    if owners and any(o.get("pre_value", 0) > 0 for o in owners) \
            and "owner_return_value" in result:
        分配 = calc_權利變換(owners, result["owner_return_value"])
        選配 = {o.get("owner_id"): o["selected_value"]
                for o in owners if o.get("selected_value") is not None}
        if 選配:
            分配 = calc_找補(分配, 選配)
        result["owner_allocations"] = [
            {"owner_id": o.get("owner_id"),
             "pre_value": o.get("pre_value", 0.0),
             "value_share": o["權值比例"],
             "return_value": o["return_value"],
             **({"equalization": o["equalization"]} if "equalization" in o else {})}
            for o in 分配]

    return result


def input_hash(engine: dict) -> str:
    """對輸入 engine 取 sha256（正規化：sort_keys＋緊湊分隔）。"""
    正規化 = json.dumps(engine, sort_keys=True, ensure_ascii=False,
                        separators=(",", ":"), default=str)
    return "sha256:" + hashlib.sha256(正規化.encode("utf-8")).hexdigest()


def verify(doc: dict, computed_at: str = None) -> tuple:
    """重算 doc['engine'] 並與 doc['result'] 逐欄位比對。

    回傳 (ok: bool, diffs: list[dict])。ok=True 表示可重算且逐欄位相符。
    computed_at/warnings 這類非計算欄位不參與比對（只比數值欄位）。
    """
    重算 = recompute(doc["engine"], computed_at or doc.get("result", {}).get("computed_at"))
    存檔 = doc.get("result", {})
    diffs = []
    數值欄位 = [k for k, v in 存檔.items()
               if isinstance(v, (int, float)) and k not in ("core_version",)]
    for k in 數值欄位:
        新 = 重算.get(k)
        舊 = 存檔.get(k)
        if 新 is None:
            diffs.append({"field": k, "stored": 舊, "recomputed": None, "reason": "missing"})
            continue
        容差 = _容差_比率 if k in _比率欄位 else _容差_絕對
        if abs(float(新) - float(舊)) > 容差:
            diffs.append({"field": k, "stored": 舊, "recomputed": 新,
                          "delta": round(float(新) - float(舊), 6)})
    # warnings code 集合也應一致（健檢可重現）
    舊碼 = sorted(w["code"] for w in 存檔.get("warnings", []))
    新碼 = sorted(w["code"] for w in 重算.get("warnings", []))
    if 舊碼 != 新碼:
        diffs.append({"field": "warnings", "stored": 舊碼, "recomputed": 新碼})
    return (len(diffs) == 0, diffs)
