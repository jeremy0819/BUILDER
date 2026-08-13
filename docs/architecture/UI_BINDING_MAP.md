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

### M7.4 歸因比較（Workspace「歸因比較」分頁）· 合約＝`attribution.schema.v0.1`

> 本面板**零計算**：每個可見數字都逐欄取自 Core 回應；`presentation` 由 Core 產出
> （含四捨五入），瀏覽器不得自行換算或進位。

| UI 元素 | Schema Field | Core Source | 狀態 |
|---|---|---|---|
| 指標名稱「全案投報率」 | `target.label`（＋`target.id`/`higher_is_better`） | `attribution._TARGETS`；**不得標為 IRR** | ✅ |
| 基準／對照 端點值（%） | `presentation.before` / `presentation.after` | `attribute()` 端點重播 | ✅ |
| 差異（ppt） | `presentation.delta`（單位＝`target.display_unit`） | 同上 | ✅ |
| 變更欄位列：前 → 後 | `contributions[].before_value` / `after_value` | Core 由正規路徑取原始輸入值 | ✅ |
| 變更欄位名稱 | `contributions[].label`（源自 `feature_id`） | Core 給定，**UI 不得自創** | ✅ |
| 各欄位影響（ppt） | `presentation.contributions[].impact` | Shapley／OAT 邊際貢獻 | ✅ |
| 交互作用（殘差）列 | `presentation.residual`（raw＝`residual.impact`） | `delta − Σ impact` | ✅ |
| 顯示進位對帳列 | `presentation.rounding_reconciliation` | Core 計算；**不得併入殘差** | ✅ |
| 守恆狀態徽章 | `conservation.raw_ok`（＋`tolerance`） | Core 自檢，UI 不自判 | ✅ |
| Shapley 精確／OAT 近似 徽章 | `method.exact` / `method.resolved` | Core 決定方法 | ✅ |
| 「N 項變更 / M 次重算」 | `method.feature_count` / `method.runs` | Core 回報權威次數 | ✅ |
| 「以 Core X 重播」 | `core_version` | 重播所用 Core，非原始日期所見版本 | ✅ |
| 溯源雜湊 | `before.input_hash` / `after.input_hash` | `input_hash()` | ✅ |
| 不支援比較的路徑清單 | `unsupported.paths` / `reason_code` / `message` | `AttributionUnsupported`（Worker 信封） | ✅ |

### M8.1／M8.2 歸因瀑布圖 · 合約＝`chart-contract-0.1`

> 圖表契約只約束 Presentation，不改 Project Schema，也不新增領域計算。瀑布圖的數字逐字取自
> `attribution-0.1`；瀏覽器只做座標與寬度映射。`direction_field` 綁定 Core 的方向欄位，
> 不在圖層硬編碼「正值就是好」。

| 視覺／證據元素 | Chart Contract Field | Attribution Source | 狀態 |
|---|---|---|---|
| 基準、差異、對照端點 | `presentation.before` / `presentation.delta` / `presentation.after` | Core `presentation` verbatim | ✅ M8.2 |
| 各變更影響 | `presentation.contributions[].impact` | Core 進位後貢獻，圖層只做幾何映射 | ✅ M8.2 |
| 交互作用（殘差） | `presentation.residual` | Core 殘差；永遠獨立成列 | ✅ M8.2 |
| 顯示進位對帳 | `presentation.rounding_reconciliation` | Core 對帳；非零時獨立成列 | ✅ M8.2 |
| 單位 | `target.display_unit` | Core 目標定義 | ✅ M8.2 |
| 好壞方向 | `target.higher_is_better` | Core 目標定義；不得硬編碼 | ✅ M8.2 |
| 欄位識別與名稱 | `contributions[].feature_id` / `contributions[].label` | Core 正規路徑與標籤 | ✅ M8.2 |
| 欄位前後原值 | `contributions[].before_value` / `contributions[].after_value` | Core 原始輸入值 | ✅ M8.2 |
| 證據抽屜影響值 | `presentation.contributions[].impact` | Core presentation | ✅ M8.2 |
| 重播 Core 版本 | `core_version` | Core provenance | ✅ M8.2 |
| 方案雜湊 | `before.input_hash` / `after.input_hash` | Core provenance | ✅ M8.2 |
| 歸因方法／重算次數 | `method.resolved` / `method.runs` | Core 回報 | ✅ M8.2 |
| 守恆／顯示對帳狀態 | `conservation.raw_ok` / `presentation.display_ok` | Core 自檢旗標；UI 不重算 | ✅ M8.2 |

> `attribution-0.1` 沒有法源欄位，證據抽屜必須明示「未提供」，不得由 UI 補寫或推論法源。

### M7.5 量體視圖（Workspace「量體」分頁）· 純呈現

| UI 元素 | Schema Field | Core Source | 狀態 |
|---|---|---|---|
| 逐層長條寬度 | `engine.floors[].樓板`（比例縮放＝版面幾何） | 輸入 verbatim，**非容積** | ✅ |
| 逐層明細表 | `engine.floors[]`（樓板/計容積/梯廳/安全梯/陽台/啟用） | 輸入 verbatim，無合計列 | ✅ |
| 總樓地板面積 | `result.total_floor_area_sqm` | Core；取不到顯示「—」，**不由 floors 自行加總** | ✅ |
| 「計容積皆為 0」提示 | 由 `floors[].計容積` 判定並標示來源 | Core 以面積表彙總為準（圖說為真） | ✅ |

> v2.1 升級即依本表流程執行：新 `schema_version`＋遷移器 `2.0→2.1`＋
> `check_schema_freeze.py` 基準 +1——凍結檔（v1.1/v2.0）位元組未動。

## 4. 維護規則

1. 新 UI 數字 → 先確認 output view 有對應欄位；沒有就先在 Core 加公式 + 升 schema，**不要在前端算**。
2. 改本表時同步 `schemas/v2/output.schema.json` 的欄位 `description`（兩者是同一份契約的兩種表述）。
3. 本表是 M3–M6 的驗收清單：每個新畫面 PR 必須能在此登記其 UI→Field→Source 三層鏈。
