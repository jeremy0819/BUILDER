# C2 Implementation Plan — workspace.html 骨架 + 案件列表 + 匯入建案

> **批次**：M3-C C2（Workflow OS 最小可用閉環的**起點**）。C1 已交付 wf-1.0 合約。
> **範圍限定（使用者 2026-07-14）**：`workspace.html` skeleton ＋ case list ＋ import-to-create。
> **禁令**：①不新增財務公式 ②不修改 Core ③UI 不自算。**先產出本計畫，經核准再寫程式。**
> 依據：`M3_ARCHITECTURE_PLAN.md`（Domain/Schema/Flow F1/Wireframe W1）、`workflow_schema.json` wf-1.0。

---

## 1. C2 做什麼／不做什麼（範圍鎖定）

**做（F1 開案的最小閉環）：**
- 新頁 `apps/web/workspace.html`（自含 HTML，零依賴，localStorage 本地儲存）。
- 「＋新案件」：匯入 **v2.1 案件 JSON**（`schemas/examples/v2/v2_1_案例D_權變示範.json` 格式）→
  **import-to-create** 轉成 wf-1.0 Project 文件（Project＋Stakeholders＋snapshot-01）。
- **案件列表**（W1 線框）：多案卡片，顯示代號/案型/階段/利害關係人數/快照指紋，重開不丟。
- 刪除案件、切換進單案（單案畫面＝**骨架佔位**，內容留給 C3–C5）。

**不做（留給後續批）：** 同意看板互動與狀態機（C3）／時程任務與決策紀錄（C4）／bundle 匯出入與多快照與主管視角（C5）／沙盤橋接（C6）。

---

## 2. 資料流與儲存

```
v2.1 案件 JSON（含 project/input.owners/result/provenance）
        │  importV21ToWorkflow()  ← 純函式，零財務運算
        ▼
wf-1.0 Project 文件（stakeholders 從 owners 帶入；snapshot-01 只存 input_hash 引用）
        │  saveProject()  ← DOM 層薄包裝
        ▼
localStorage["uros.workflow.v1"] = { projects:{ [project_id]: {wf, snap} }, order:[…] }
```

- `wf`＝wf-1.0 文件（**不含 result 數字**，只有 snapshot 的 input_hash@core_version）。
- `snap`＝匯入快照的**唯讀顯示快取**：`{result 子集, provenance}`——供卡片顯示財務**只讀**，
  不重算（SSOT：顯示的數字逐欄來自匯入 result，UI 不做任何加減）。
- 真實案件資料存於使用者瀏覽器 localStorage＝本地，**不進版控**（與紅線相容）。
  版控只進：`workspace.html`＋測試＋既有合成範例（皆匿名代號）。

---

## 3. 純邏輯區塊 `/*WORKLOGIC-BEGIN*/…/*WORKLOGIC-END*/`（可 headless 測）

比照 SIMCORE：把「不碰 DOM、不碰 localStorage」的轉換邏輯抽成純區塊，node 可測。

| 函式 | 語意 | 紅線 |
|---|---|---|
| `importV21ToWorkflow(v21)` | v2.1 doc → wf-1.0 Project 文件（見 §4） | 只搬欄位；**零財務運算** |
| `stakeholdersFromOwners(owners)` | `input.owners[]` → `stakeholders[]`（owner 角色） | 欄位映射，不新增財務欄 |
| `snapshotRef(v21)` | 由 provenance 組 snapshot-01（input_hash/core_version/computed_at） | 只引用指紋，不複製 result |
| `displaySnapshot(v21)` | 抽 result 唯讀顯示子集（供卡片） | 逐欄複製既有值，無計算 |
| `listView(store)` | store → 卡片渲染所需資料陣列 | 純資料整形 |

DOM/localStorage 層（`saveProject/loadStore/render*`）在區塊外，不進 headless。

---

## 4. import-to-create 轉換規格（`importV21ToWorkflow`）

輸入 v2.1 doc → 輸出 wf-1.0：
```
project.project_id   = "prj-" + provenance.input_hash 前 8 hex（穩定、去識別）
project.code_name    = v21.project.name（禁真實段名——沿用匯入者提供之代號）
project.case_type    = v21.project.case_type
project.mode         = v21.engine.mode → 全案管理/合建/買賣（映射；無則省略）
project.stage        = "S1"（新案件起點；階段推進在 C4）
project.snapshots    = [ snapshotRef(v21) ]   // id:"snap-01", label:"匯入版"
project.active_snapshot = "snap-01"
stakeholders         = stakeholdersFromOwners(v21.input.owners)   // owner_id/role/land_share/pre_value/min_unit_eligible/family_group?/tags?
consent_events=[] tasks=[] decisions=[]
```
- 產出的 wf 文件**必須通過** `workflow_schema.json`（wf-1.0）——測試強制。
- owners 空或無 v2.1 結構 → 明確錯誤訊息，不臆造。

---

## 5. UX Wireframe（W1，復用既有設計語彙）

```
┌ URBAN RENEWAL OS · WORKSPACE ─────────────────── [⌂ OS 主選單] [🎮 沙盤] ┐
│  案件管理層 · 本地儲存（localStorage）· 零計算（數字來自匯入 result）        │
│  ┌─ ＋ 新案件 ─────────────────────────────────────────────────┐        │
│  │  匯入 v2.1 案件 JSON  [ 選擇檔案 ]   或拖放                     │        │
│  └───────────────────────────────────────────────────────────┘        │
│  ┌──────────────────────────┐ ┌──────────────────────────┐            │
│  │ 案例D · 危老・合建         │ │（空狀態：尚無案件——            │            │
│  │ S1 · 50 利害關係人        │ │  匯入一份 v2.1 JSON 開始）      │            │
│  │ snap 737dbda4…@0.3.0     │ └──────────────────────────┘            │
│  │ 共負 66.0% · 投報 51.5%   │  ← 唯讀，來自匯入 result                   │
│  │ [開啟] [匯出] [刪除]      │                                          │
│  └──────────────────────────┘                                          │
└──────────────────────────────────────────────────────────────────────┘
（[開啟]→單案骨架頁：進度脊 S1–S11 佔位＋四分頁標籤，內容 "C3–C5 建置中"）
```
- 主題：沿用**儀表板雙主題**（日用工具，light/dark），非遊戲深色（管理者長時間看）。
- 一個 shell 導覽入口：在 `index.html` 延伸資源加「🗂️ 案件工作區 WORKSPACE」一列（最小改動）。

---

## 6. Test Strategy（新 **Gate 7 — Workspace headless**）

`tests/web/test_workspace.mjs`（抽 WORKLOGIC，node 無 DOM 執行）：
1. `importV21ToWorkflow(合成 v2.1 範例)` → 產出 wf 文件；**通過 wf-1.0 schema**（引入 ajv？→
   否，維持零依賴：改在 pytest 端用 `validate_workflow` 驗證產出，node 端驗結構欄位）。
   - 折衷：node 測結構不變式（project_id 前綴、stakeholders 數＝owners 數、snapshot.input_hash 保留、
     stage="S1"、consent/tasks/decisions 為空）；**pytest 另加**一測：把 node 產出的等價 JSON 餵
     `validate_workflow` 過關（用 Python 複刻同轉換或讀 fixture）。
2. **SSOT 稽核**：WORKLOGIC 區塊原始碼 grep 無四則運算於 result 欄位；`displaySnapshot` 僅複製既有值。
3. 決定性：同輸入→同 project_id（input_hash 派生穩定）。
4. 空/壞輸入→拋錯不臆造。

`tests/web/` 另加 `test_workspace.mjs` 進 **CI Gate 7**（`.github/workflows/ci.yml`）。
資料紀律：測試只用合成範例；Gate 0 / `check_no_real_names.sh` 照跑。

---

## 7. 驗收標準（C2 Done 定義）

- [ ] 匯入 `v2_1_案例D_權變示範.json` → 案件卡出現，代號/階段/50 關係人/快照指紋正確。
- [ ] 卡片財務（共負/投報）逐欄等於匯入 result（**零計算**）。
- [ ] 重整/重開瀏覽器 → 案件仍在（localStorage）。
- [ ] [開啟] → 單案骨架頁（S1–S11 脊＋分頁佔位）。
- [ ] Gate 7 headless 綠；Gate 4 連結綠；Gate 0 資料紀律綠；pytest 綠（含 wf 產出驗證）。
- [ ] Chromium 實開 F1 流程零 console error（截圖存證）。

## 8. 禁令執法對照

| 禁令 | C2 機制 |
|---|---|
| 不新增財務公式 | workspace 無任何 core/redcf 計算；顯示數字＝匯入 result 逐欄複製；Gate 7 grep 稽核 |
| 不修改 Core | C2 只新增 `apps/web/workspace.html`＋`tests/web/test_workspace.mjs`＋CI Gate 7；`core/` 零改動（pytest 黃金值不變） |
| UI 不自算 | `displaySnapshot` 白名單欄位、只讀；同意「數」在 C3（計數非公式）；本批不顯示任何推導財務 |

## 9. 交付檔案清單（C2）

```
apps/web/workspace.html            新增（自含 HTML，含 WORKLOGIC 純區塊）
tests/web/test_workspace.mjs       新增（Gate 7 headless）
.github/workflows/ci.yml           +Gate 7 一行
apps/web/index.html                +1 導覽列（延伸資源→案件工作區）※最小改動
tests/test_workflow.py             +1 測（node 轉換產出過 validate_workflow）※或獨立 fixture
```

---
*C2_IMPLEMENTATION_PLAN v1｜2026-07-14｜待核准後施工。範圍嚴格限定於 skeleton＋列表＋匯入建案。*
