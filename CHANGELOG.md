# CHANGELOG — Urban Renewal OS（core/redcf）

> 記錄 CORE_VERSION 的每次變動（VERSION_POLICY：公式、費率、law_db、合約結構變動才 bump）。
> UI 版本（app.py v4.x）與 OS release tag（os-vX.Y.Z）另有軸線，不在此表。

## Unreleased — M8 THE VIEWFINDER

> M8.1／M8.2 僅加厚 Presentation 層；不修改 Core 公式、Project Schema 或 `CORE_VERSION`。

- **M8.1 Chart Contract**：新增並凍結 `chart_contract.schema.v0.1`；圖表必須宣告來源、
  `must_not_read_as`、權威不確定性欄位與唯讀互動。Gate 16 驗證 schema、UI 綁定、
  凍結 hash 與瀏覽器 bundle 同步。
- **M8.2 Attribution Waterfall**：Workspace 將 M7.4 表格升級為可鍵盤選取的瀑布圖與
  證據抽屜；端點、貢獻、殘差、進位對帳逐欄取自 Core `presentation`，瀏覽器只做版面
  幾何。精確 Shapley／OAT 方向性、不可誤讀項目與法源未提供狀態皆明示。Gate 17
  驗證唯讀互動、無障礙、窄版與零領域公式；首次載入 Core 時按鈕會等待 ready，
  不再送出過早請求。

## 0.5.0 — 2026-08-07（M7 THE CASE OS：Memory 層＋歸因引擎）

> **版本裁定**：依 `docs/releases/M7_4_ATTRIBUTION_VISUAL_PLAN.md` §3.5 版本治理，
> M7.4 為**新增 Core 能力**，`CORE_VERSION` 由 0.4.0 → **0.5.0**（minor：純新增，
> 既有黃金公式零變動，容積/坪效/共負/投報/估值期望值不變）。
> 既有凍結範例的 provenance **不回填**（歷史快照，可溯源原則）。
> OS release tag 為獨立軸，`os-v0.5.0` 待走 `docs/releases/CHECKLIST.md` 後另行發布。

- **M7.1 Case OS Foundation**：`apps/web/case-store.js`（IndexedDB）＋合約
  **`activity.schema.v0.1`** 凍結。Activity append-only、Session ＝事件流上的命名區間
  （非第二真源）、localStorage 一次性遷移（舊資料保留為唯讀備援不刪）、Local-first 備份三條。
  `assertNoInference()` 擋下推論欄位寫入（Gate 11／12）。
- **M7.2 Watchtower**：`core/redcf/timeline.py`——`build_today()`＋`build_timeline()`。
  合約 **`milestone.schema.v0.1`** 凍結（`source=statute` 條件式必附 `legal_basis`）。
  法定期限庫每筆附法條出處與 `verification`；「72hr 風險窗」明確標為 heuristic、允許被推翻。
- **M7.3 Scenario**：多方案管理＋合約 **`scenario.schema.v0.1`** 凍結。三條硬規則機器守衛：
  只改 Input 不改 Output、**恰好一個 authoritative**、攜帶**完整 input set 而非 diff**（Gate 13）。
- **M7.4 Attribution**（`core/redcf/attribution.py`，`attribution-0.1`）：
  把決策報告從「結論」變成**可質詢的結論**。Shapley 精確歸因（核可特徵 ≤10，2ⁿ 次重算，
  加總完全等於 delta 且順序無關）／OAT 退路；raw 層恆滿足
  **`Σ contributions[].impact + residual.impact == delta`**（容差 1e-9）。
  · **可歸因特徵**＝`params.*` 與 **`params.財務覆寫.*`** 的純量葉節點，
    以正規路徑（`params.住宅單價`）為 `feature_id`，標籤由 Core 給、UI 不得自創。
  · **結構化拒答**：`floors`／`owners`／`case_type`／`mode`／未知結構路徑一律
    `AttributionUnsupported`（帶 `reason_code`／`paths`），**不併成一根「其他」長條**。
  · **呈現由 Core 產出**（`presentation`）：瀏覽器各自進位會讓可見列加不回可見 delta；
    顯示進位誤差獨立為 `rounding_reconciliation`，**不得偽裝成經濟意義上的交互作用殘差**。
  · **單位誠實**：`return_rate` ＝「**全案投報率**」，顯示單位 **ppt**，**非 IRR**
    （回歸測試斷言輸出全文不得出現 IRR 字樣）。
  · 合約 **`attribution.schema.v0.1`** 凍結；報告離開 Core 前必過 schema 驗證。
  · 驗收矩陣 A–I 共 37 測（`tests/test_attribution.py`），含零公式複製斷言。
- **M7.5 Visualization**：`apps/web/massing-view.js` 量體／逐層視圖，讀既有 `floors[]`
  純呈現、零領域公式、無寫入路徑；合計只從 Core result 取，取不到顯示「—」（Gate 14）。
  **GIS 疊圖延後**：外部圖磚違反零依賴／可離線的靜態純度紅線，需先決定離線圖資方案。

## 0.4.0 — 2026-07-24（M4–M5.5＋B1.5：決策引擎／選配映射／B 系列並版）

> **版本裁定（使用者核准）**：0.3.0 後 `core/redcf` 新增了計算能力——`decision.py`（三方 EV）、
> `allocation.py`（選配映射）、`valuation.py` B 系列係數函式。依 VERSION_POLICY「新增計算公式即 bump」，
> `CORE_VERSION` 由 0.3.0 → **0.4.0**（minor：純新增、未改既有黃金公式，故容積/坪效/共負/投報/估值
> 既有期望值零變動）。決策引擎另有獨立軸 `ENGINE_VERSION 0.1.0`。
> ⚠️ 既有凍結範例（`schemas/examples/`）的 provenance 仍記 `0.3.0`——那是**當時**算出的歷史快照，
> 依可溯源原則**不回填**；recompute 驗證已排除 `core_version` 比對（`recompute.py`），故不影響黃金測試。

- **M4 Decision Engine v0.1**（`core/redcf/decision.py`，`ENGINE_VERSION 0.1.0`）：
  三方 EV／完工機率（`stage_tree.json`）／verdict（GO/CAUTION/STOP，帶 `breakpoint_stakeholder`）／
  Exit Signal（沉沒成本防火牆）／urgency；引擎只讀 result＋workflow state，不反算 Core。
  合約 **`decision.schema.v0.1`** 凍結（Gate 6）；三對抗案例回歸 `tests/test_decision.py`。
- **M4 選配映射**（`core/redcf/allocation.py`）：§56 分回 → 權狀坪/室內實坪/可配單元/車位序位；
  合約 **`household_outcome.schema.v0.1`** 凍結。
- **B 系列**（`valuation.py`＋`coefficients.json`）：路寬×分區×建物型態×樓層（1F 店面溢價）
  係數矩陣；`_note`「非估價值」為核准紅線不得移除。Python↔JS 逐位元一致（LCG）測試守衛。
- **M4.5 試金石**：財務/係數與真實案比對 ×2 ✅（`/local_calibration/`，gitignored、未進版控）；
  stage_tree 存活率未校準 → verdict＝**方向性判斷、非投資結論**（UI 全程標示）。
- **M5 THE WORKFLOW**（決策流程 IA）：P0 三段動線（Site→Product→People→Decision）／
  P1 Case Workspace（單案容器）／P2 Developer Board。工作流零推論，只呈現引擎輸出。
- **M5.5 傳動軸駕駛艙**：B1 **Pyodide** 在瀏覽器內跑「同一份」`core/redcf`（`core-bundle.js`＝
  被 Gate 9 守衛的衍生產物，非第二真源）／B2 同框即時評估（改產品→即時重算）／B3 依賴高亮。
- **B1.5 零步啟動與介面收斂**：駕駛艙預載合成示範案（`apps/web/demo-case.js`，源自
  synthetic 案例D，`tools/build_demo_case.mjs` 可重現）＝**開頁即可拖滑桿看數字、免匯入**；
  空狀態改為可運作狀態；前門（`index.html`）收斂為「駕駛艙／沙盤／決策報告」三個表面，
  其餘工具收進「延伸資源」；駕駛艙加案件切換 dropdown＋傳動軸漸進揭露（4 主參數＋進階摺疊）。
- 里程碑正名：**M5＝THE WORKFLOW**、**M6＝THE STRATEGIST**（逐型對策，下一站）；
  同框駕駛艙屬 **M5.5 B2**，不屬 M6。

## 0.3.0 — 2026-07-12（M3・Rights & Compensation 第一批）

- **新增** `core/redcf/rights.py`：`calc_權利變換`（都更條例 §56——依更新前權利價值
  比例分配更新後可分配總值 → 逐戶 `return_value`）、`calc_找補`（equalization ＝
  選配 − 分回；正=補入/負=找出；未選配=None）、`build_owner_allocations`。
  結構性分配公式，**零校準費率**；更新前價值之路寬/分區/建物型態係數待使用者核准。
- **合約** schema **v2.1**（minor：純選填新增）：`input.owners[]` 逐戶欄位定義
  （含 `selected_value`）＋ `result.owner_allocations[]`；權威檔
  `schemas/project_schema_v2_1.json`（凍結，Gate 6）；遷移鏈補 `2.0 → 2.1`。
- **recompute**：owners 帶 `pre_value` 時附逐戶分回表（委派 rights.py，本體零公式）。
- **新增** `core/redcf/cashflow.py`：`calc_現金流分期`——共同負擔 A–G 科目 ×
  期別權重的**純算術分配**（逐期出資/累積/峰值，守恆到分）。權重為輸入；
  未提供＝均勻分佈並標記 `structural=True`（結構示意）。**實案 S 曲線與
  IRR/NPV 屬 M4 校準範圍（🔴 使用者核准）**，本版不臆造。
- **資料紀律**：`check_no_real_names.sh` 守衛清單納入關係企業名稱（工作區已全數移除）。
- 既有黃金測試期望值**零變動**；v2.0 檔案位元組不變（凍結維持）。

## 0.2.0 — 2026-07（M1–M2 基準）

- 三庫合併後的計算核心基準：容積查核（§162）/坪效/共同負擔 L6/投報/估值；
  schema v2.0 完整可重算合約（recompute/verify/input_hash）；遷移鏈 1.0→1.1→2.0；
  四動詞門面 `api.py`。詳見 `docs/releases/M2_CLOSE_REPORT.md`。
