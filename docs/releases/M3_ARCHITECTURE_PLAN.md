# M3 Architecture Plan — Urban Renewal Workflow OS（案件管理層）

> **定位（使用者定案 2026-07-14）**：M3 ＝ 建立**案件管理層**，不是新增計算工具。
> 計算核心（core/redcf）在 M2 已凍結為真源；M3 讓「一個案件從 S1 走到 S11 的人、
> 事、時、決策」全部有家、可追溯、可交接。
> **三禁令（本計畫的憲法）**：①不修改 Core Formula ②UI 不自算 ③不跳過 Schema Version。
> **地基**：本層＝`DOMAIN_MODEL.md §3` 凍結的「OS 模組掛載點」之落實——模組自帶檔案、
> 自帶 schema_version、以 `project_id` 關聯、**真實 PII 永不進版控**。計算合約
> （v1.1/v2.0/v2.1）一個位元組都不動。

## M3 三軌對照（收斂命名，避免混淆）

| 軌 | 內容 | 狀態 |
|---|---|---|
| **M3-A 權變計算基礎** | §56 逐戶分回/找補（rights.py）＋schema v2.1＋現金流結構 v1 | ✅ 已出貨（core 0.3.0） |
| **M3-B 沙盤文理** | 《整合人》B1–B5（參數化街區/三態/選屋券/JSON 開局/結局權變表） | 📋 規格定案，**B3 的三態＝直接消費本計畫的 Consent 模型**——故本計畫先行，B1→B2→B3 隨後 |
| **M3-C Workflow OS** | **本計畫主體**：Project／Stakeholder／Consent／Timeline&Task／Decision | 🎯 設計中（先設計後施工） |

---

## 1. Domain Model（領域模型）

### 1.1 一張圖

```
                    ┌────────────────────────────────────────────┐
                    │  計算域（已凍結，M3 唯讀）                    │
                    │  project_schema v2.1 ＝ input+engine+result │
                    │  （數字真源：core/redcf，input_hash 溯源）    │
                    └──────────────────┬─────────────────────────┘
                                       │ 唯讀引用（project_id + input_hash）
                                       ▼
 ┌───────────────────────── Workflow 域（M3-C 新建，自帶版本）─────────────────────────┐
 │                                                                                    │
 │  Project（案件）1 ──── n Snapshot（計算快照引用：input_hash@core_version）            │
 │     │ 1                                                                            │
 │     ├──── n Stakeholder（利害關係人：地主/顧問/建築師/銀行…，匿名代號）                │
 │     │        │ 1                                                                   │
 │     │        └──── n ConsentEvent（接觸/承諾/簽署事件，append-only）                  │
 │     ├──── 1 ConsentBoard（同意看板＝由事件推導的目前狀態，非獨立事實）                  │
 │     ├──── n Task（任務，掛在 S1–S11 stage 上）                                       │
 │     └──── n DecisionRecord（決策紀錄 ADR，**釘住當時依據的 input_hash**）              │
 └────────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 實體定義

**E1 Project（案件）** — 管理層的聚合根
- `project_id`（`prj-` + 短 hash，穩定不變）、`code_name`（代號，**禁真實段名**）
- `case_type`（urban_renewal/danger_building）、`mode`（全案管理/合建/買賣）
- `stage`（S1–S11 當前階段）＋ `stage_history[]`（進階時間戳）
- `snapshots[]`：計算快照引用 `{label, schema_version, input_hash, core_version, computed_at, file_ref}`
  ——**只存引用與溯源指紋，不複製數字**；要看數字就打開該 v2.1 檔（SSOT）
- `active_snapshot`：目前作準的那一份（決策、看板顯示皆以此為基準）

**E2 Stakeholder（利害關係人）** — 擴充自 owners[]，但住在 Workflow 域
- `stakeholder_id`（匿名代號 W01…／R01 顧問／B01 銀行）、`role`（owner/consultant/architect/bank/gov）
- owner 型專屬：`land_share`、`pre_value`、`min_unit_eligible`（與計算合約 owners[] 同名同義，
  匯入時從 v2.1 檔帶入；**不新增財務欄位**）
- `family_group`（家族聚落代號，供沙盤與看板連動）、`tags[]`（人格/關注點，自由標籤）
- **PII 規則（紅線）**：版控與匯出檔**只有匿名代號**；真實姓名/門牌對照表存於使用者本地
  （不入 repo、不入匯出 bundle 預設值），介面顯示時由本地對照表 join

**E3 ConsentEvent（同意追蹤，append-only 事件流）**
- `{event_id, stakeholder_id, ts, kind, note?, by?}`
- `kind` 列舉：`contacted`（首次接觸）/`visited`（拜訪）/`briefed`（說明會）/
  `verbal_ok`（口頭同意）/`signed`（簽署同意書）/`selected_unit`（完成選屋）/
  `withdrawn`（撤回）/`declined`（明確拒絕）
- **狀態是推導不是儲存**：目前 consent 狀態由事件流重放推導（最後有效事件決定），
  修正錯誤靠補償事件，不改歷史——可稽核、可回放，與計算域「可重算」哲學同構
- 推導狀態機（與 M3-B 三態對齊）：
  `untouched → contacted → negotiating → agreed_unselected → agreed_selected`
  　　　　　　　　　　　　　└→ `declined`（送件後→補償金）；`withdrawn` 退回 negotiating
- **門檻進度＝計數，不是財務公式**：同意率＝count(agreed*)/N（與沙盤 targetOf 同性質的
  法定規則常數：危老 100%／都更 3/4 等，值引用自 law 文件、標示條號）；任何**金額**
  一律來自 active_snapshot 的 `result`，看板不算錢

**E4 Task（任務）＋ Timeline**
- `{task_id, title, stage(S1–S11), due?, status(todo/doing/done/blocked), owner_role?, links[]}`
- Timeline ＝ S1–S11 階段軸（既有方法論的座標，不發明新流程）＋每階段的任務清單與
  檢核點（檢核點內容引用 `開發流程架構.md`，不複載）
- 階段推進規則：手動宣告＋前置檢核提示（如「S5→S7 建議 consent ≥ 門檻」，**提示不擋**）

**E5 DecisionRecord（決策紀錄，ADR 式）**
- `{decision_id, ts, stage, title, context, options[], chosen, rationale, consequences?, evidence}`
- **`evidence` ＝ 本層的殺手級設計**：`{input_hash, core_version, result_fields_cited[]}`——
  每個決策**釘住做決策當下依據的那份 Core 計算**；日後翻案時可回放「當時看到的數字」
  （計算域可重算 × 決策域可回溯 ＝ 完整稽核鏈）

### 1.3 與計算域的邊界（SSOT 執法）

| 動作 | 允許 | 禁止 |
|---|---|---|
| 顯示財務數字 | 讀 active_snapshot 的 `result.*` | 任何自算/推算/加減 |
| 同意進度 | 計數與比例（人數/持分計數） | 把持分比例拿去算錢 |
| 快照更新 | 由 Streamlit/Core 重新匯出新 v2.1 檔→登記為新 snapshot | 在管理層改 input 重算 |
| 門檻值 | 引用法規常數（標條號） | UI 自訂門檻邏輯 |

---

## 2. Data Schema（資料合約）

### 2.1 新檔：`schemas/workflow_schema.json`（v1.0，**獨立版本軸**）

- 與計算合約**分檔分版**（D4 的單一權威檔原則適用於「每個域各一份」）：
  計算域 `project_schema_v2_1.json`（凍結）；Workflow 域 `workflow_schema.json` **wf-1.0**
- 結構（$defs：project/stakeholder/consent_event/task/decision_record/snapshot_ref）：

```jsonc
{
  "schema_version": "wf-1.0",
  "project": { "project_id": "prj-a1b2c3", "code_name": "案例D", "case_type": "danger_building",
               "mode": "合建", "stage": "S5",
               "stage_history": [{"stage":"S1","ts":"..."}],
               "active_snapshot": "snap-01",
               "snapshots": [{ "id":"snap-01", "label":"送審版",
                 "schema_version":"2.1", "input_hash":"sha256:737d…", "core_version":"0.3.0",
                 "computed_at":"2026-07-01", "file_ref":"local:案例D_v21.json" }] },
  "stakeholders": [ { "stakeholder_id":"W01", "role":"owner", "land_share":0.020833,
                      "pre_value":1276.17, "family_group":"F1", "tags":["店面","二代接手"] } ],
  "consent_events": [ { "event_id":"ev-0001", "stakeholder_id":"W01", "ts":"...",
                        "kind":"visited", "note":"關心分回坪數" } ],
  "tasks": [ { "task_id":"t-001", "title":"三家估價師遴選", "stage":"S7",
               "status":"todo", "due":"2026-08-01" } ],
  "decisions": [ { "decision_id":"d-001", "ts":"...", "stage":"S4",
                   "title":"採合建模式", "context":"…", "options":["全案管理","合建"],
                   "chosen":"合建", "rationale":"…",
                   "evidence": { "input_hash":"sha256:737d…", "core_version":"0.3.0",
                                 "result_fields_cited":["shared_cost_ratio","owner_return_ratio"] } } ]
}
```

### 2.2 版本紀律（回應禁令③「不跳過 Schema Version」）

- `wf-1.0` 發布即**凍結**：hash 進 `tools/check_schema_freeze.py` FROZEN（Gate 6 第 7 檔）
- 變更規則沿用 `SCHEMA_STRATEGY.md`：加選填欄＝minor（wf-1.1）；改名/改型別/必填＝major
  （wf-2.0）＋遷移器 `core/redcf/migrations.py` 增 wf 鏈（遷移器仍只住 Core——單一遷移點）
- 合成範例：`schemas/examples/workflow/wf_案例D_示範.json`（沿用 48 戶匿名代號，零真實資料）

### 2.3 儲存與交換（維持靜態純度）

- **本地優先**：瀏覽器 `localStorage`（workspace 頁）＋「匯出/匯入 案件 bundle」
  （`.json`，= workflow doc；計算檔以 file_ref 併排攜帶）——零後端，離線可用
- Streamlit 同格式讀寫（Python 端驗證 via `api.validate` 擴充 wf schema）
- **PII**：bundle 預設不含真實姓名對照；對照表為使用者本地檔（`.gitignore` 樣式已涵蓋）

---

## 3. User Flow（使用者流程）

### F1 開案（整合人 PM）
```
Streamlit 填案件參數＋owners CSV → 匯出 v2.1 案件 JSON
  → workspace「＋新案件」→ 匯入 JSON
  → 自動建立：Project（S1）＋ Stakeholders（從 owners[]）＋ snapshot-01（input_hash 登記）
  → 看板就緒：48 格全 untouched、門檻線已標（危老 100%）
```

### F2 日常整合迴圈（每週）
```
開 workspace → 同意看板 → 點 W37 → 記事件（visited＋筆記「怕搬遷斷生意」）
  → 看板即時重推導（W37: untouched→contacted…）→ 門檻進度條更新（計數）
  → 本週任務打勾（S5 公聽會通知）→ 若有關鍵取捨 → 記 DecisionRecord（自動釘 active_snapshot）
```

### F3 方案變更（規劃調整）
```
建築師調規模 → Streamlit 重算 → 匯出新 v2.1 檔 → workspace 登記 snapshot-02（送審版）
  → 切 active_snapshot → 財務快照面板整組換新（input_hash 可對照舊版）
  → 記 DecisionRecord「改採 52% 獎勵方案」，evidence 釘 snapshot-02
```

### F4 主管視角（唯讀）
```
開 workspace → 案件列表（多案：stage/同意率/警示數一眼掃）→ 進單案
  → 看板＋Timeline＋最近決策 → 不能改數字（本來就沒有可改的：全部唯讀 result）
```

### F5 沙盤橋接（M3-B B3/B4，同宇宙）
```
workspace 匯出 bundle → 《整合人》PLAN PHASE「匯入案件」
  → street 由 stakeholders 生成（家族/三態初始＝看板現況）→ 推演練兵
  →（單向：沙盤結果不回寫管理層——訓練是訓練，事實是事實）
```

---

## 4. UX Wireframe（線框，實作於 `apps/web/workspace.html`——新頁，不動現有頁）

### W1 案件列表（多案總覽）
```
┌ URBAN RENEWAL OS · WORKSPACE ────────────────────────────── [⌂ OS 主選單] ┐
│ ＋ 新案件（匯入 v2.1 JSON）                                                │
│ ┌──────────────────────────┐ ┌──────────────────────────┐                │
│ │ 案例D（危老・合建）        │ │ 案例A（都更・全管）        │                │
│ │ S5 整合中 ● 34/48 (70.8%) │ │ S3 規劃 ● 未開始整合       │                │
│ │ ⚠ 3 warnings · 決策 4 筆  │ │ ⚠ 2 warnings · 決策 1 筆  │                │
│ └──────────────────────────┘ └──────────────────────────┘                │
└──────────────────────────────────────────────────────────────────────────┘
```

### W2 單案主畫面（沿用統一設計語彙：進度脊＋分頁）
```
┌ 案例D · 危老合建 · prj-a1b2c3 ── snapshot: 送審版 (737dbda4…@0.3.0) [切換] ┐
│ S1✓ S2✓ S3✓ S4✓ ◉S5 整合 › S6 › S7 › … › S11        同意 34/48 · 門檻 100% │
│ ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░ 70.8%                                                  │
├──[同意看板]──[時程任務]──[決策紀錄]──[財務快照(唯讀)]────────────────────────┤
│                                                                          │
│ 同意看板：48 格矩陣（沿用《整合人》視覺）＋ 每格狀態色（五態）                  │
│  點格 → 右側抽屜：事件時間軸（append-only）＋「＋記事件」                     │
│  家族聚落框線（F1/F2/F3）· 篩選：狀態/家族/標籤                              │
├──────────────────────────────────────────────────────────────────────────┤
│ 時程任務：S1–S11 直欄，當前階段展開任務卡（todo/doing/done）＋檢核點連結      │
│ 決策紀錄：ADR 卡片流——標題/階段/依據快照(input_hash)/引用欄位 chips          │
│ 財務快照：M2 儀表板的 KPI/健檢面板整組復用（**只讀 result**，含 provenance）  │
└──────────────────────────────────────────────────────────────────────────┘
```

### W3 記事件抽屜（互動最小單位）
```
┌ W37 · 夜市麵店老闆 · negotiating ────────────┐
│ 08/02 visited  「怕搬遷斷生意」               │
│ 07/28 briefed  （第2次說明會）                │
│ 07/12 contacted                              │
│ ─────────────────────────────               │
│ ＋ 記事件： [visited ▾] [備註…] [儲存]        │
└──────────────────────────────────────────────┘
```

設計原則：復用既有 tokens（.card/.lbl/進度脊/矩陣格）——**不再發明第三套視覺**；
workspace 為深色 strand 語彙或儀表板雙主題語彙擇一（傾向後者：管理工具日用，雙主題）。

---

## 5. Test Strategy（測試策略）

| 層 | 工具 | 鎖什麼 |
|---|---|---|
| **T1 Schema** | pytest + jsonschema | wf-1.0 範例通過；壞值被擋（缺 project_id、未知 kind）；凍結 hash（Gate 6 +1）；`api.validate` 支援 wf 檔 |
| **T2 狀態機** | node headless（`tests/web/test_workspace.mjs`，比照 SIMCORE 抽純邏輯區塊） | 事件流重放推導的**決定性**（同事件流→同狀態）；append-only（無刪改 API）；五態轉移合法性；門檻計數守恆 Σ狀態=N；withdrawn 回退正確 |
| **T3 SSOT 稽核** | node headless + grep gate | workspace 純邏輯區塊**零財務運算**（比照遊戲層紅線）；顯示金額只能來自 snapshot.result 欄位名單（UI_BINDING_MAP 登記制） |
| **T4 資料紀律** | Gate 0 擴充 | wf 範例/測試 fixture 只允許匿名代號；bundle 匯出樣本掃 PII 樣式 |
| **T5 遷移** | pytest | wf-1.0→未來版鏈式遷移 fixture（開工即建骨架，migrations 單點） |
| **T6 實開驗收** | Chromium driver（沿用截圖流程） | F1–F4 各流程零 console error；localStorage 斷電重開資料不丟 |

CI：T1/T5 進 Gate 1（pytest）；T2/T3 進新 **Gate 7 — Workspace headless**；T4 併 Gate 0。

---

## 6. 施工批次（設計核准後才動工；每批不綠不進下一批）

| 批 | 內容 | 驗收 |
|---|---|---|
| C1 | `workflow_schema.json` wf-1.0＋合成範例＋T1/T5＋Gate 6 凍結 | pytest 綠；凍結 7 檔 |
| C2 | workspace.html 骨架＋案件列表＋匯入 v2.1 建案（F1） | T6 流程 F1；Gate 4 連結 |
| C3 | 同意看板＋事件抽屜＋狀態機純邏輯區塊（F2） | Gate 7 上線（T2/T3 綠） |
| C4 | 時程任務＋決策紀錄（釘 input_hash）（F2/F3） | ADR evidence 可回放對應快照 |
| C5 | 匯出/匯入 bundle＋多快照切換＋主管唯讀視角（F3/F4） | T6 全流程；資料紀律 T4 |
| C6 | 沙盤橋接（=M3-B B4 對接）（F5） | 匯入 bundle 開局，街區=看板現況 |

**與 M3-B 的次序**：本計畫 C1（Consent/Stakeholder 合約定案）→ M3-B B1/B2 可並行 →
**B3（三態/選屋券）直接實作 C1 定案的五態模型**——一套模型，管理層與沙盤共用。

## 7. 禁令執法對照（怎麼保證做不歪）

| 禁令 | 機制 |
|---|---|
| 不修改 Core Formula | M3-C 全程不碰 `core/redcf/` 計算模組；唯一 Core 變更＝migrations 加 wf 鏈（結構搬運，非公式）；pytest 黃金值零變動為驗收條件 |
| UI 不自算 | T3 headless 掃 workspace 邏輯區塊；金額欄位白名單＝UI_BINDING_MAP 登記制；同意「率」限計數 |
| 不跳 Schema Version | wf-1.0 起即凍結進 Gate 6；任何欄位變更走 SCHEMA_STRATEGY 分級＋遷移器；計算合約 v1.1/v2.0/v2.1 位元組不動 |

## 8. 風險與開放問題（待你裁決後 C1 動工）

1. **workspace 主題**：沿用儀表板雙主題（建議，日用工具）或 strand 深色單主題？
2. **多使用者**：本期單機（localStorage＋bundle 交換）；真正多人協作＝後端＝P3/M8 前置，不在 M3。
3. **stage 推進要不要硬檢核**（如同意未達門檻禁止標 S7）：建議「提示不擋」（現實中有例外流程）。
4. **wf 範例的家族/事件量**：擬 48 戶＋~40 事件＋6 任務＋3 決策——夠測不虛胖。

---
*M3_ARCHITECTURE_PLAN v1｜2026-07-14｜設計文件——未含任何程式；核准後依 §6 批次施工。*
