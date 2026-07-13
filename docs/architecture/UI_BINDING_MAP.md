# UI Binding Map — UI ↔ Schema Field ↔ Core Source（M2 產出）

> **用途**：把每個畫面元素綁到 schema v2.0 的 output 欄位，再綁到產生它的 Core 函式。
> M3–M6 新增任何 UI 之前，先在此表登記綁定；**表上找不到來源的數字不准顯示**。
> **SSOT 執法**：UI 欄一律讀 `result.*`（＝schema `$defs/output`），前端零計算、零門檻重判。
>
> 三層鏈：`UI 元素` → `Schema Field（output view）` → `Core Source（core.redcf 函式）`
> 權威定義：`schemas/v2/output.schema.json`（委派 `project_schema_v2.json#/$defs/output`）。

## 0. 讀法與紅線

- **Core Source** 欄指的是「該數字最終由哪個 core 函式算出」，全部經
  `contract.build_result_json` 出關。UI 永遠拿 `result`，不呼叫 core 函式本身。
- 门檻色（正常/帶外、餘量超出、共負合理帶）**不由 UI 判**——讀 `result.warnings[]`
  的 `code`/`level`/`field`。UI 只做「把 level 對到顏色」這種純呈現映射。
- 溯源列（provenance）綁 `$defs/metadata`：`core_version` / `input_hash` /
  `law_db_version` / `computed_at`。跨案比較前必須同 `core_version`（ARCHITECTURE §4）。

## 1. Dashboard（`apps/web/dashboard.html`；OS 入口＝shell `apps/web/index.html`，純導覽零數字）

| UI 元素 | Schema Field（`result.*`） | Core Source |
|---|---|---|
| 「允建容積」KPI 主值 | `allow_floor_area` | `capacity.calc_容積查核` |
| 「允建容積」副註「餘量 N（超出）」 | `remaining_floor_area` + `warnings[VOLUME_EXCEEDED]` | `capacity.calc_容積查核` / `contract._build_warnings` |
| 「銷售坪數」KPI 主值 | `saleable_area` | `efficiency.calc_坪效` |
| 「銷售坪數」副註「銷坪比 N（正常/帶外）」 | `efficiency_ratio` + `warnings[EFFICIENCY_OUT_OF_BAND]` | `efficiency.calc_坪效` / `contract._build_warnings` |
| 「投報率」KPI 主值 | `return_rate` | `finance.calc_投報全案` |
| 「投報率」副註「地主分回比」 | `owner_return_ratio` | `finance.calc_投報全案` |
| 更新前/增值 KPI（有 L7 時） | `pre_renewal_value` / `value_multiple` | `valuation.calc_更新前價值`（倍率＝分回÷更新前，於 `build_result_json`） |
| 容積帳長條「計入 / 允建」 | `used_floor_area` / `allow_floor_area` | `capacity.calc_容積查核` |
| 容積帳「總銷 N 萬」 | `total_sales` | `finance.calc_投報全案` |
| 共同負擔甜甜圈 | `shared_cost_ratio` + `warnings[SHARED_COST_*]` | `finance.calc_投報全案` / `contract._build_warnings`（區間表 `law_db.COMMON_BURDEN_RANGES`） |
| 逐層樓板表（展開） | `input.floors[]`（非 result；輸入回放） | 輸入快照 `engine.floors`；驗算 `recompute.verify` |
| 「Core 權威健檢 warnings[]」清單 | `warnings[]`（code/level/message/field） | `contract._build_warnings` + `_validate_owners` |
| 溯源列 chips（law_db/computed/input_hash） | `provenance.law_db_version` / `.computed_at` / `.input_hash` | `recompute.input_hash`、`gen_examples_v2` |
| 「✓可重算驗證通過」徽章 | 由 `api.validate(doc)` / `recompute.verify` 產出 | `recompute.verify` |
| 跨案比較表每一列 | 上列各 `result.*` 欄位 | 同上（皆為同一 `core_version` 之 result） |

> 註：頁面 JS 內用短別名（`c.allow`←`allow_floor_area`、`c.saleable`←`saleable_area`、
> `c.eff`←`efficiency_ratio`、`c.scr`←`shared_cost_ratio`、`c.owner_ratio`←`owner_return_ratio`、
> `c.vmult`←`value_multiple`、`c.floors_n`←`len(input.floors)`）。別名只是顯示層改名，值不變。

## 2. 整合模擬器《整合人 THE INTEGRATOR》（原代號 URBAN STRAND；`apps/web/os-simulator.html`）

模擬器**遊戲層**（住戶說服、羈絆、AP/週）是自有狀態機，**不是 Core 數字**；但
「PLAN PHASE 沙盤」的財務格是 **Core 重算後烘焙進 `SCEN` 表**的唯讀值（SSOT）。

| UI 元素（PLAN PHASE） | 對應 Core result 欄位 | Core Source |
|---|---|---|
| 情境卡「共負 62.9% / 72%」 | `shared_cost_ratio`（各 mode×scale 情境） | `finance.calc_投報全案` → 烘焙進 `SCEN.<mode>_<scale>` |
| 情境卡「容積餘量」正負 | `remaining_floor_area` | `capacity.calc_容積查核` |
| 情境卡投報/分回 | `return_rate` / `owner_return_ratio` | `finance.calc_投報全案` |
| 送件門檻（危老全體 48 / 都更 80%=39） | 規則常數（非 result）：`targetOf` | 遊戲層（法定門檻，非計算公式） |
| 整合進度旅程軌里程碑 | 遊戲狀態 `agreedCount`（非 result） | 遊戲層 SIMCORE |

> 紅線：`SCEN` 表的財務值只能由 Core 匯出更新，**不得在 JS 內改算式**（headless
> 測試 `test_os_simulator.mjs` 守「遊戲層零財務公式」）。遊戲難度來自 `warnings`／共負帶，
> 屬「診斷即敘事」設計——數字仍是 Core 的。

## 3. M3 owners 輸入與逐戶權變（**已落地**：schema v2.1 ＋ core 0.3.0）

| UI 元素 | Schema Field | Core Source | 狀態 |
|---|---|---|---|
| Streamlit Tab⑤ 地主清冊 CSV 匯入 | `input.owners[]`（`owner_id`/`pre_value`/`selected_value`…，v2.1 定義） | 輸入；一致性檢查 `contract._validate_owners` | ✅ |
| Streamlit 逐戶權變表＋CSV 下載 | `result.owner_allocations[]`（`value_share`/`return_value`/`equalization`） | `rights.calc_權利變換`＋`rights.calc_找補`（§56） | ✅ |
| Dashboard「M3 權利變換」區塊 | `result.owner_allocations[]`（v2.1 範例烘焙，只讀） | 同上（`recompute` 附掛） | ✅ |
| 「持分合計 ≠ 1」提示 | `warnings[OWNERS_SHARE_MISMATCH]` | `contract._validate_owners` | ✅ |
| 「Σ權值 偏離更新前總值」提示 | `warnings[OWNERS_VALUE_MISMATCH]` | `contract._validate_owners` | ✅ |
| Dashboard「現金流結構」區塊 | 非 result 欄（Core 匯出烘焙；contract 欄位待 v2.2/M4） | `finance.calc_投報全案`（A–G 科目實額）＋`cashflow.calc_現金流分期`（結構分期） | ✅ M3 結構版 |
| 遊戲「整合資金流」卡 | 遊戲層支出紀錄（沙盤，非 Core 財務） | SIMCORE `spent`（呈現層記帳） | ✅ |
| 三態地主／選屋順序籌碼（沙盤） | 待定（接 `min_unit_eligible`＋選配） | 遊戲層讀 Core 分配 | ⏳ M3 後段 |

> v2.1 升級即依本表流程執行：新 `schema_version`＋遷移器 `2.0→2.1`＋
> `check_schema_freeze.py` 基準 +1——凍結檔（v1.1/v2.0）位元組未動。

## 4. 維護規則

1. 新 UI 數字 → 先確認 output view 有對應欄位；沒有就先在 Core 加公式 + 升 schema，**不要在前端算**。
2. 改本表時同步 `schemas/v2/output.schema.json` 的欄位 `description`（兩者是同一份契約的兩種表述）。
3. 本表是 M3–M6 的驗收清單：每個新畫面 PR 必須能在此登記其 UI→Field→Source 三層鏈。
