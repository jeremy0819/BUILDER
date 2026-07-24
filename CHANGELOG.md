# CHANGELOG — Urban Renewal OS（core/redcf）

> 記錄 CORE_VERSION 的每次變動（VERSION_POLICY：公式、費率、law_db、合約結構變動才 bump）。
> UI 版本（app.py v4.x）與 OS release tag（os-vX.Y.Z）另有軸線，不在此表。

## Unreleased — OS 層里程碑（M4→M5.5＋B1.5；**未 bump CORE_VERSION**）

> 本節記 OS/引擎/前端層的推進。核心容積(§162)/坪效/共負(L6)/投報/估值公式**未變**，
> 故 `CORE_VERSION` 維持 0.3.0；決策引擎另走獨立軸 `ENGINE_VERSION`。
> ⚠️ **待確認的版本政策**：M4 起 `core/redcf` 新增 `decision.py`、`allocation.py`、
> `valuation.py` B 系列係數函式（係數在 `apps/web/coefficients.json` 可換檔）。
> 這些是「新增能力、未改既有黃金公式」，依 VERSION_POLICY 是否值得 bump 至 0.4.0——**待使用者裁定**。

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
