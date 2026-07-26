# -*- coding: utf-8 -*-
"""
tools/build_demo_rosters.py — 產生示範案 A/B/C 的**合成產權清冊＋工作區記錄**
================================================================================
背景（領域回饋 2026-07）：建築師與都更顧問指出——**基地與產權從一開始就能由謄本確認並建立
名冊，取得資訊後才談評估與規劃**。因此名冊是「輸入第一件事」，不是後段才長出來的東西。
本工具讓三個示範案在工作區一開始就有名冊可用。

【資料紅線】欄位結構參考真實審議版產權清冊（土地清冊／建物清冊／同意比歸人表），
但**所有數值與名稱一律合成**：地段＝「示範段」、所有權人＝W01… 代號、地號/持分/價值皆程式生成。
零真實案件資料進版控（Gate 0）。真實清冊只留本機 /local_calibration/（gitignored）。

【SSOT】財務數字一律由 core/redcf 實算（recompute）、決策由 decision.decide 產出——
本工具不自算任何公式，只組裝輸入與搬運 Core 輸出。

輸出：apps/web/demo-cases.js（供 dashboard 工作區載入；可重現：固定種子）
用法：python tools/build_demo_rosters.py
"""
import json
import pathlib
import sys

根 = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(根))
OUT = 根 / "apps" / "web" / "demo-cases.js"

from core.redcf import recompute, input_hash                      # noqa: E402
from core.redcf.decision import decide                            # noqa: E402
from core.redcf.workflow import derive_signability                # noqa: E402


# ── 可重現亂數（LCG，與 valuation 的 Python↔JS 一致性作法同源）──
class R:
    def __init__(self, seed): self.s = seed & 0x7FFFFFFF
    def next(self):
        self.s = (self.s * 1103515245 + 12345) & 0x7FFFFFFF
        return self.s / 0x7FFFFFFF
    def pick(self, seq): return seq[int(self.next() * len(seq)) % len(seq)]
    def rng(self, a, b): return a + (b - a) * self.next()


# 謄本清冊欄位（結構取自真實審議版；值全合成）
清冊欄位 = ["土地編號", "使用分區", "地段", "地號", "土地面積_㎡", "公告現值_元每㎡",
            "地上建物建號", "登記次序", "土地所有權人", "權利範圍分子", "權利範圍分母",
            "持分比例", "土地持分面積_㎡", "同意與否", "限制登記", "權利種類"]

# 限制登記 → 產權複雜度（M5.5 事實欄；M6 可簽性軸來源）
限制對映 = {"無": "clean", "繼承未辦": "inherited_unregistered", "公同共有": "joint_ownership",
            "抵押權": "mortgaged", "未保存登記增建": "illegal_structure"}


def 樓層表(地上, 地下, 標準樓板, 店舖樓板):
    fs = []
    for i in range(地下, 0, -1):
        fs.append({"啟用": True, "樓層": f"B{i}F", "樓板": 標準樓板 * 1.6,
                   "計容積": 0, "梯廳": 0, "安全梯": 0, "陽台": 0})
    fs.append({"啟用": True, "樓層": "1F", "樓板": 店舖樓板, "計容積": 0,
               "梯廳": 0, "安全梯": 店舖樓板 * 0.1, "陽台": 0})
    for i in range(2, 地上 + 1):
        fs.append({"啟用": True, "樓層": f"{i}F", "樓板": 標準樓板, "計容積": 0,
                   "梯廳": 標準樓板 * 0.05, "安全梯": 標準樓板 * 0.08, "陽台": 標準樓板 * 0.1})
    return fs


def 建名冊(spec, rnd):
    """產生合成產權清冊（謄本結構）＋ 對應的 owners（計算合約用）。"""
    n = spec["戶數"]
    清冊, owners = [], []
    分母 = 10000
    基準持分 = 分母 // n
    for i in range(n):
        oid = f"W{i+1:02d}"
        # 持分：多數均分，少數大戶（投資型）持分較高——結構性差異，非真實資料
        大戶 = i < spec.get("大戶數", 0)
        分子 = int(基準持分 * (spec.get("大戶倍數", 2.4) if 大戶 else 1))
        持分 = 分子 / 分母
        土地面積 = spec["基地面積"] * 持分
        現值 = spec["公告現值"] * rnd.rng(0.94, 1.06)
        pre_value = round(土地面積 * 現值 / 10000, 2)          # 萬元
        限制 = rnd.pick(spec["限制池"])
        同意 = "同意" if i < spec["已同意"] else "未表態"
        清冊.append(dict(zip(清冊欄位, [
            f"L{i+1:03d}", spec["使用分區"], "示範段", f"{spec['地號基']+i}-{(i % 7) + 1}",
            round(土地面積, 2), round(現值), f"B{i+1:03d}", 1, oid,
            分子, 分母, round(持分, 6), round(土地面積, 2), 同意, 限制,
            "所有權"])))
        owners.append({"owner_id": oid, "land_share": round(持分, 6),
                       "pre_building_area_sqm": round(土地面積 * rnd.rng(0.8, 1.5), 2),
                       "pre_value": pre_value,
                       "consent": "agreed" if 同意 == "同意" else "pending",
                       "min_unit_eligible": pre_value > spec["最小單元門檻"]})
    return 清冊, owners


def 建案(spec):
    rnd = R(spec["seed"])
    清冊, owners = 建名冊(spec, rnd)
    engine = {
        "params": {
            "案件名稱": spec["名稱"], "基地面積": spec["基地面積"], "人行廣場": 0,
            "容積率": spec["容積率"], "獎勵率": spec["獎勵率"], "容積移轉": spec["容積移轉"],
            "公設比": spec["公設比"], "梯廳免計基準": 5, "陽台免計基準": 10,
            "面積表計入容積": spec["基地面積"] * spec["容積率"] * (1 + spec["獎勵率"]),
            "住宅單價": spec["住宅單價"], "店舖坪數": spec["店舖坪數"], "店舖單價": spec["店舖單價"],
            "車位數": spec["車位數"], "車位單價": 230, "營造單價": spec["營造單價"],
            "戶數": spec["戶數"], "權變戶數": 0, "土融土地成本": spec["土地成本"],
            "地價": spec["地價"], "既有建物面積": 0, "建物單價": 0, "屋齡": spec["屋齡"],
        },
        "floors": 樓層表(spec["地上"], spec["地下"], spec["標準樓板"], spec["店舖樓板"]),
        "case_type": spec["case_type"], "mode": spec["mode"], "owners": owners,
    }
    result = recompute(engine)                       # ← 權威計算（SSOT），本工具零公式
    ih = input_hash(engine)
    agreed = spec["已同意"]

    # wf-1.1 文件（含可簽性軸；由限制登記事實導出，方向鎖在 core.workflow）
    stakeholders = []
    for row, o in zip(清冊, owners):
        oc = 限制對映[row["限制登記"]]
        sign, reason = derive_signability(oc)
        st = {"stakeholder_id": o["owner_id"], "role": "owner",
              "land_share": o["land_share"], "pre_value": o["pre_value"],
              "min_unit_eligible": o["min_unit_eligible"],
              "ownership_complexity": oc, "signability": sign}
        if reason:
            st["blocking_reason"] = reason
        stakeholders.append(st)

    wf = {"schema_version": "wf-1.1",
          "project": {"project_id": spec["pid"], "code_name": spec["名稱"],
                      "case_type": spec["case_type_en"], "mode": spec["mode"],
                      "stage": spec["stage"], "active_snapshot": "snap-01",
                      "snapshots": [{"id": "snap-01", "label": "謄本建檔版",
                                     "schema_version": "2.1", "input_hash": ih,
                                     "core_version": result.get("core_version", ""),
                                     "computed_at": result.get("computed_at", "")}]},
          "stakeholders": stakeholders, "consent_events": [], "tasks": [], "decisions": []}

    workflow_state = {"stage": spec["stage"], "input_hash": ih,
                      "consent": {"agreed": agreed, "total": spec["戶數"],
                                  "threshold": spec["門檻"]}}
    decision = decide(result, workflow_state, spec["decision_inputs"])

    snap = {"code_name": spec["名稱"], "case_type": spec["case_type_en"],
            "stakeholders_n": len(stakeholders), "input_hash": ih,
            "core_version": result.get("core_version", ""),
            "computed_at": result.get("computed_at", ""),
            "shared_cost_ratio": result.get("shared_cost_ratio"),
            "return_rate": result.get("return_rate"),
            "warnings_n": len(result.get("warnings", []) or []),
            "agreed": agreed, "total": spec["戶數"], "threshold": spec["門檻"],
            "allocations": (result.get("owner_allocations") or [])[:60],
            "site": {"site_area_sqm": spec["基地面積"], "plaza_area_sqm": 0,
                     "far": spec["容積率"], "bonus_ratio": spec["獎勵率"],
                     "tdr_transfer_sqm": spec["容積移轉"]},
            "public_ratio": spec["公設比"]}

    # 工作區視圖（容積/坪效/財務/現金流）——逐欄 verbatim 自 Core result，UI 零計算。
    view = {k: result.get(k) for k in (
        "baseline_far", "allow_floor_area", "used_floor_area", "remaining_floor_area",
        "saleable_area", "efficiency_ratio", "total_sales", "shared_cost",
        "shared_cost_ratio", "owner_return_value", "owner_return_ratio", "return_rate",
        "pre_renewal_value", "value_multiple")}
    view["warnings"] = [
        (w if isinstance(w, str) else (w.get("message") or w.get("msg") or w.get("code", "")))
        for w in (result.get("warnings") or [])]
    # 現金流：以 Core 的投報科目（A–G）跑結構性分期；失敗即 None（不臆造）
    cash = None
    try:
        from core.redcf import calc_投報全案, 財務率預設
        from core.redcf.cashflow import calc_現金流分期
        p = dict(財務率預設); p.update(engine["params"])      # 補齊費率預設（同 recompute 內部作法）
        投報 = calc_投報全案(result["saleable_area"], result["used_floor_area"] / 3.305785,
                            p, spec["mode"])
        cash = calc_現金流分期(投報)
    except Exception:
        cash = None

    return {"pid": spec["pid"], "wf": wf, "snap": snap, "engine": engine,
            "decision": decision, "roster": 清冊, "view": view,
            "cashflow": cash, "demo": True}


# ── 三個示範案：對應三個破局原型（去識別化合成參數）──
SPECS = [
    {   # 案例A 內爆型：蛋黃區、更新前價值高、全案管理、觀望多
        "pid": "prj-demo-a", "名稱": "案例A（蛋黃區・全案管理）", "seed": 20260725,
        "case_type": "都更", "case_type_en": "urban_renewal", "mode": "全案管理", "stage": "S2",
        "基地面積": 2100, "容積率": 3.0, "獎勵率": 0.30, "容積移轉": 0, "公設比": 0.33,
        "住宅單價": 92, "店舖坪數": 120, "店舖單價": 150, "車位數": 60, "營造單價": 22,
        "戶數": 56, "土地成本": 96000, "地價": 165, "屋齡": 48, "公告現值": 320000,
        "使用分區": "住三", "地號基": 401, "已同意": 22, "門檻": 0.8,
        "地上": 15, "地下": 3, "標準樓板": 470, "店舖樓板": 700,
        "大戶數": 3, "大戶倍數": 2.6, "最小單元門檻": 900,
        "限制池": ["無"]*9 + ["繼承未辦", "公同共有", "抵押權"],   # 約 25% 有負擔
        "decision_inputs": {"mgmt_fee": 16800, "advance": 2200, "operating": 1400,
                            "我方收入": 9800, "我方投入": 3000},
    },
    {   # 案例B 背信型：合建、持分集中、地價高、關係專屬投資高
        "pid": "prj-demo-b", "名稱": "案例B（合建・持分集中）", "seed": 20260726,
        "case_type": "都更", "case_type_en": "urban_renewal", "mode": "合建", "stage": "S6",
        "基地面積": 1250, "容積率": 2.25, "獎勵率": 0.35, "容積移轉": 620, "公設比": 0.32,
        "住宅單價": 78, "店舖坪數": 70, "店舖單價": 120, "車位數": 42, "營造單價": 21,
        "戶數": 24, "土地成本": 30000, "地價": 92, "屋齡": 41, "公告現值": 120000,
        "使用分區": "住三", "地號基": 720, "已同意": 15, "門檻": 0.8,
        "地上": 14, "地下": 2, "標準樓板": 400, "店舖樓板": 560,
        "大戶數": 4, "大戶倍數": 3.0, "最小單元門檻": 1100,
        "限制池": ["無"]*8 + ["抵押權", "公同共有"],               # 約 20% 有負擔
        "decision_inputs": {"mgmt_fee": 0, "profit_impl": 19500, "advance": 7600,
                            "operating": 2100, "我方收入": 12000, "我方投入": 4200,
                            "exit": {"marginal_investment": 4000, "exit_recovery_now": 1300,
                                     "future_recovery": 26000}},
    },
    {   # 案例C 攔胡型：危老、對手競標情境、完工機率折損
        "pid": "prj-demo-c", "名稱": "案例C（危老・外部競標）", "seed": 20260727,
        "case_type": "危老", "case_type_en": "danger_building", "mode": "合建", "stage": "S8",
        "基地面積": 980, "容積率": 2.4, "獎勵率": 0.30, "容積移轉": 0, "公設比": 0.35,
        "住宅單價": 71, "店舖坪數": 55, "店舖單價": 105, "車位數": 30, "營造單價": 20,
        "戶數": 18, "土地成本": 18500, "地價": 74, "屋齡": 39, "公告現值": 96000,
        "使用分區": "住二", "地號基": 155, "已同意": 16, "門檻": 1.0,
        "地上": 12, "地下": 2, "標準樓板": 330, "店舖樓板": 460,
        "大戶數": 2, "大戶倍數": 2.2, "最小單元門檻": 800,
        "限制池": ["無"]*10 + ["抵押權", "未保存登記增建"],        # 約 17% 有負擔
        "decision_inputs": {"mgmt_fee": 9200, "advance": 2600, "operating": 1000,
                            "我方收入": 6400, "我方投入": 2300, "p_haircut": 0.72},
    },
]


def 補既有案視圖() -> dict:
    """為既有示範案（demo-case.js 的案例D）補算工作區視圖／現金流，讓四案面板一致。
    只讀它的 engine 再交給 Core 實算；不改動 demo-case.js 本身。"""
    js = (根 / "apps" / "web" / "demo-case.js").read_text(encoding="utf-8")
    i = js.find("self.DEMO_CASE")
    j = js.find("=", i)
    doc = json.loads(js[j + 1:].strip().rstrip(";").strip())
    eng = doc.get("engine")
    if not eng:
        return {}
    r = recompute(eng)
    view = {k: r.get(k) for k in (
        "baseline_far", "allow_floor_area", "used_floor_area", "remaining_floor_area",
        "saleable_area", "efficiency_ratio", "total_sales", "shared_cost",
        "shared_cost_ratio", "owner_return_value", "owner_return_ratio", "return_rate",
        "pre_renewal_value", "value_multiple")}
    view["warnings"] = [(w if isinstance(w, str) else (w.get("message") or w.get("msg") or w.get("code", "")))
                        for w in (r.get("warnings") or [])]
    cash = None
    try:
        from core.redcf import calc_投報全案, 財務率預設
        from core.redcf.cashflow import calc_現金流分期
        p = dict(財務率預設); p.update(eng["params"])
        cash = calc_現金流分期(calc_投報全案(r["saleable_area"], r["used_floor_area"] / 3.305785,
                                            p, eng.get("mode", "合建")))
    except Exception:
        cash = None
    return {doc["pid"]: {"view": view, "cashflow": cash}}


def main() -> int:
    cases = [建案(s) for s in SPECS]
    body = json.dumps(cases, ensure_ascii=False, indent=1, sort_keys=True)
    extra = json.dumps(補既有案視圖(), ensure_ascii=False, indent=1, sort_keys=True)
    OUT.write_text(
        "/* AUTO-GENERATED by tools/build_demo_rosters.py — 勿手改。\n"
        "   示範案 A/B/C：合成產權清冊（謄本欄位結構）＋ wf-1.1 工作區記錄。\n"
        "   DEMO_VIEWS：既有示範案（案例D）的工作區視圖／現金流補算，讓四案面板一致。\n"
        "   財務/決策由 core/redcf 實算（SSOT）；所有名稱與數值皆為合成，零真實案件資料。 */\n"
        f"self.DEMO_CASES = {body};\n"
        f"self.DEMO_VIEWS = {extra};\n", encoding="utf-8")
    for c in cases:
        d = c["decision"]
        print(f"✅ {c['snap']['code_name']}｜{c['snap']['stakeholders_n']} 戶｜"
              f"共負比 {c['snap']['shared_cost_ratio']:.1%}｜{d['verdict']}"
              f"（引爆點 {d['breakpoint_stakeholder']}）｜清冊 {len(c['roster'])} 列")
    print(f"→ {OUT.relative_to(根)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
