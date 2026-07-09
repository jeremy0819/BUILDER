# -*- coding: utf-8 -*-
"""
tools/gen_examples_v2.py — 產生 schema v2.0「完整可重算」範例（M2-A）
====================================================================
執行：python tools/gen_examples_v2.py
輸出：schemas/examples/v2/*.json

v2.0 相對 v1.1 的關鍵差異：
  - input.floors[]：逐層樓板表（v1.1 最大缺口）——有了它才能「從合約 JSON 重算 result」。
  - engine{}：Core 重算快照（中文 key，消費端忽略）；recompute(engine) 可回放出 result。
  - provenance{input_hash, law_db_version}：溯源指紋（這份 result 對應哪份輸入、哪版法規）。

全部輸入來自 core/templates.py 合成案例（代號＋虛構值），零真實資料。
"""
import json
import os
import sys
import types

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)
for _m in ("streamlit", "plotly", "plotly.graph_objects"):
    sys.modules.setdefault(_m, types.ModuleType(_m))
sys.modules["streamlit"].column_config = types.SimpleNamespace()

from core.redcf import (範本參數, 範本樓層表, 範本案件類型, 範本獎勵拆解, 範本模式,
                        平方米換坪)
from core.redcf.recompute import recompute, input_hash, verify

OUT_DIR = os.path.join(_ROOT, "schemas", "examples", "v2")
COMPUTED_AT = "2026-07-01T00:00:00+00:00"
LAW_DB_VERSION = "builtin-2026-07"  # M5 分縣市後改為版本化法規；此為前置佔位

# 逐層樓板 中文→英文（對外合約 key 英文）
_FLOOR_KEY = {"樓層": "level", "樓板": "floor_area_sqm", "計容積": "counted_far_sqm",
              "梯廳": "stair_hall_sqm", "安全梯": "safety_stair_sqm",
              "陽台": "balcony_sqm", "啟用": "enabled"}


def _floors_en(records):
    return [{_FLOOR_KEY.get(k, k): v for k, v in r.items()} for r in records]


def build_v2(鍵, 案名, owners=None):
    P = dict(範本參數[鍵])
    if 案名:
        P["案件名稱"] = 案名
    floors = 範本樓層表(鍵).to_dict("records")
    案件類型 = 範本案件類型[鍵]
    模式 = 範本模式[鍵]
    engine = {"params": P, "floors": floors, "case_type": 案件類型,
              "mode": 模式, "owners": owners or []}
    result = recompute(engine, COMPUTED_AT)
    doc = {
        "schema_version": "2.0",
        "project": {"id": 鍵.split("（")[0], "name": P["案件名稱"],
                    "case_type": "urban_renewal" if 案件類型 == "都更" else "danger_building"},
        "input": {
            "site": {"site_area_sqm": P.get("基地面積", 0.0), "plaza_area_sqm": P.get("人行廣場", 0.0),
                     "far": P.get("容積率", 0.0), "bonus_ratio": P.get("獎勵率", 0.0),
                     "tdr_transfer_sqm": P.get("容積移轉", 0.0)},
            "building": {"public_ratio": P.get("公設比", 0.0),
                         "stair_hall_exempt_pct": P.get("梯廳免計基準", 0),
                         "balcony_exempt_pct": P.get("陽台免計基準", 0),
                         "unit_count": P.get("戶數", 0)},
            "floors": _floors_en(floors),
            "finance": {"residential_price": P.get("住宅單價", 0.0), "shop_area": P.get("店舖坪數", 0.0),
                        "shop_price": P.get("店舖單價", 0.0), "parking_count": P.get("車位數", 0),
                        "parking_price": P.get("車位單價", 0.0),
                        "construction_price": P.get("營造單價", 0.0)},
            "owners": owners or [],
            "scenario": {"name": "baseline", "bonus_breakdown": dict(範本獎勵拆解[鍵])},
        },
        "engine": engine,
        "result": result,
        "provenance": {"core_version": result["core_version"], "computed_at": COMPUTED_AT,
                       "input_hash": input_hash(engine), "law_db_version": LAW_DB_VERSION},
    }
    ok, diffs = verify(doc, COMPUTED_AT)
    assert ok, f"{鍵} 自我重算驗證失敗：{diffs}"
    return doc


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    cases = [("案例A（都更・全案管理）", "案例A", "v2_案例A_都更全案管理.json", None),
             ("案例C（防災都更）", "案例C", "v2_案例C_防災都更_容積超出.json", None),
             ("案例D（危老・合建）", "案例D", "v2_案例D_危老合建.json", None)]
    # 案例D + owners（48 戶合成清冊）
    鍵D = "案例D（危老・合建）"
    PD = 範本參數[鍵D]
    戶數 = int(PD["戶數"])
    consents = ["agreed"] * 34 + ["pending"] * 10 + ["opposed"] * 4
    ownersD = [{"owner_id": f"W{i+1:02d}", "land_share": round(1.0/戶數, 6),
                "pre_building_area_sqm": 0.0, "pre_value": 0.0,
                "consent": consents[i % len(consents)], "min_unit_eligible": True}
               for i in range(戶數)]

    print("產生 schema v2.0 範例（完整可重算，全部合成資料）...")
    for 鍵, 案名, 檔, _ in cases:
        doc = build_v2(鍵, 案名)
        json.dump(doc, open(os.path.join(OUT_DIR, 檔), "w", encoding="utf-8"),
                  ensure_ascii=False, indent=2)
        print(f"  ✅ {檔}（floors {len(doc['input']['floors'])} 層, 可重算驗證 PASS）")
    docD = build_v2(鍵D, "案例D（owners 示範）", owners=ownersD)
    json.dump(docD, open(os.path.join(OUT_DIR, "v2_案例D_owners示範.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)
    print(f"  ✅ v2_案例D_owners示範.json（owners {len(ownersD)} 戶, 可重算驗證 PASS）")
    print(f"\n完成，共 4 個 v2 範例於 {OUT_DIR}")


if __name__ == "__main__":
    main()
