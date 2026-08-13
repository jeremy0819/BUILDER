# M7 SPEC · THE CASE OS（憲法）

> **文件類型**：架構規格（docs/architecture/）
> **里程碑**：M7 · Case OS — 案件的持續工作記憶（Memory 層）
> **狀態**：已核准施工中 —— M7.1 ✅（儲存層＋Activity＋接 UI）、M7.2 ✅（Watchtower＋法定期限庫）；
> M7.3–M7.5 待做
> **前置**：M6 THE STRATEGIST 完成（✅ 引擎 11/11、同業複測通過）
> **最後更新**：2026/08（M7.1 接 UI）

---

## 0. 憲章（一句話）

> **M7 — THE CASE OS**：以 **Local-first** 為原則，在既有 Workflow 層長出**時間維度**——
> 建立案件的持續工作記憶（Memory）、時間脈絡（Timeline，含未來的風險窗）與
> 可解釋決策（Explainability，加總守恆）。
> **M7 只記錄「事實與意圖」，不產生任何推論**——判讀仍由 Decision、建議仍由 Strategy。
> 讓 BUILDER 從「完成一次決策」進化為「每天支援整合人工作」。

### 0.1 「每天打開」≠「每天登入」（產品策略，不可讓步）

```
M7 = Local-first：Project → JSON → Browser → IndexedDB → Export / Import
```

**不做**帳號、雲端同步、多人協作。理由不是技術偏好，是產品策略：一旦做了，BUILDER 就從
Decision OS 變成 SaaS，並附帶完全不同性質的工作——個資法、存取權限、稽核、加密、備份、
外洩通報、刪除權。**真實產權清冊含身分證字號與住址**，那是個資法上的「資料控制者」責任，
不是 M7 要解的問題。要做團隊版，另開 Enterprise Edition，不在此混入。

### 0.2 里程碑正名（防漂移）

| 名稱 | 是什麼 |
|---|---|
| **M5 Case Workspace（P1）** | **一個頁面**：單案容器，唯讀呈現 |
| **M7 THE CASE OS** | **案件成為 OS 的組織單位**：四個持續存在的工作面 ＋ 時間維度 |

兩者不同層級，不得混稱。

---

## 1. 在五層堆疊的位置（重要：Memory 不是第六層）

Decision 與 Strategy 是**推論層**（產生新判斷）；Memory 是**基質**。且 Attribution 需讀
History、Strategy 可能需讀 Timeline——若把 Memory 疊在 Strategy 之上，層級會反轉。

```
Core（事實・SSOT）
   ▼
Workflow ＋【Memory：時間維度】  ← 【M7 在這裡長出，不是往上加一層】
   ▼
Decision Engine（判讀・M4）
   ▼
Strategy Engine（建議・M6）
   ▼
Presentation（呈現・零推論）
```

### 三條鐵律

1. **只記事實與意圖，不記推論**：M7 寫「誰在何時改了什麼、哪個方案作準、這段工作叫什麼」；
   **永不寫** EV／verdict／坪數／IRR／對策——那些一律即時向 Core／Decision／Strategy 索取。
   > ⚠️ 這條取代口語的「全部 Read-only」。M7 當然要寫入（Activity/Session/Scenario 都是寫），
   > 但寫的是**事實**，不是**推論結果**。照「Read-only」字面實作會直接卡死。
2. **不新增第二套計算**：既有 Core／Schema／Workflow 相容；Attribution 是**新的 Core 能力**，
   仍住在 `core/redcf`，不在 UI。
3. **可重現**：任何歷史狀態都能由「完整輸入 ＋ `input_hash`」重算回來。

---

## 2. 儲存層：IndexedDB（M7.1 第一個技術決定）

### 2.1 為什麼不能繼續用 localStorage（實測）

| 組成 | 大小 |
|---|---|
| 單案基礎（名冊＋規劃＋決策） | ~23 KB |
| ＋ Scenario ×3 | ~68 KB |
| ＋ History 快照 ×20 | ~158 KB |
| ＋ Activity 事件 ×2000 | ~352 KB |
| **單一活躍案件** | **≈ 0.6 MB** |

localStorage 上限約 5 MB → **約 8 個活躍案件即滿**；且超限時**寫入拋錯、資料默默存不進去**，
使用者可能整日登打盡失而不自知。故 M7 改用 **IndexedDB**（配額以 GB 計，支援索引，
Timeline/Activity 查詢更快）。

### 2.2 遷移紀律

- 既有 localStorage（`uros.workflow.v1`、`uros.profiles.*`）需**一次性遷移**至 IndexedDB，
  遷移後保留 localStorage 副本一段時間（唯讀備援），確認無誤再清除。
- 遷移器住 Core 端（比照 `migrate_workflow`），**消費端不得各自轉換**。

### 2.3 Local-first 的義務（DoD 必含）

> Local-first 的代價是「使用者自己負責保存」，所以系統有義務讓保存不費力。
> **沒有這三條，Local-first 不是策略，是資料遺失風險。**

1. **自動匯出提醒**：超過 N 天未匯出即於畫面提示（N 存 config）。
2. **File System Access API**：使用者指定真實資料夾，變更自動落檔——這才是真 local-first，
   而非「困在瀏覽器裡」。（不支援的瀏覽器退回手動匯出，並明確告知。）
3. **一鍵完整備份／還原**：單一 JSON 含所有案件、Activity、Scenario、History。

---

## 3. Activity（事件流）— Memory 的原子

**既有地基**：`workflow_schema` 已有 `consent_events`（append-only）與 `decision_records`（ADR 式）。
M7 將其一般化為統一事件流。

```json
{
  "event_id": "ev-000123",
  "ts": "2026-07-26T09:12:00+08:00",
  "kind": "edit | consent | stage | snapshot | scenario | note",
  "target": { "type": "stakeholder|product|site|case", "id": "W12" },
  "field": "住宅單價",
  "before": 92, "after": 96,
  "intent": "地主要求增加坪數",
  "by": "integrator",
  "session_id": "se-004"
}
```

紀律：**append-only**（不修改、不刪除既有事件）；`before/after` 只記**輸入值**，
不記推論結果（不存 IRR/verdict）。

---

## 4. Session（工作區間）— 不是第二真源

**Session ≠ History**：History 是**版本**，Session 是**工作**。

**關鍵設計：Session ＝ Activity 事件流上的一段命名區間**，不是獨立儲存。

```json
{ "session_id": "se-004", "name": "調整產品配比",
  "started_at": "…", "ended_at": "…",
  "first_event": "ev-000118", "last_event": "ev-000131" }
```

- 資料只有一份（Activity），Session 只是**起訖標記**——避免兩份資料不同步。
- **Resume 的陷阱**：「回到上次那頁／捲動位置／展開的面板」是**介面狀態，不是案件事實**，
  **絕不可進 Project JSON**（否則合約被 UI 細節污染，換介面就爛）。
  UI 狀態另存 `uros.ui.session`，與案件資料完全分離。

---

## 5. History（版本鏈）

**既有地基**：`workflow_schema` 的 `snapshots[]` 已含 `input_hash@core_version`，可回放。

M7 補足：
- 每次「作準輸入」變更即產生新 snapshot（含**完整 input set**，非 diff——見 §7）。
- snapshot 之間可跳轉、可比較（比較走 §8 Attribution）。
- 舊 snapshot **永不重寫**：重算＝產新戳記，舊檔保留（既有 VERSION_POLICY 規則）。

---

## 6. Timeline（時間脈絡）＝ 過去 ＋ **未來**

> 一個沒有「未來」的工作空間，是日誌不是作業系統。
> 整合人每天打開最想看的是「今天要做什麼、什麼快到期」。

原 roadmap 的 **M7 WATCHTOWER（milestone → deadline → 72hr 風險窗）併入此處**，不另立里程碑。

```
過去（已有地基）          現在              未來（Watchtower）
Activity / History  →   今天要做什麼   →   deadline / 法定期限 / 72hr 風險窗
```

```json
{ "milestone_id": "ms-007", "title": "公聽會通知期限",
  "due": "2026-08-15", "stage": "S5",
  "source": "statute | plan | heuristic",
  "risk_window_hr": 72 }
```

- `source` 必填：法定期限（statute）／自訂計畫（plan）／**經驗啟發（heuristic）**。
  「重大節點前後 72hr 為最高風險窗」是 heuristic，**必須標示且允許被案例推翻**
  （沿用 `00_FIRST_PRINCIPLES` 的規則出處紀律）。
- Timeline 為**衍生視圖**：由 Activity＋History＋milestones 排序渲染，**不新增第三份資料**。

---

## 7. Scenario（多方案）

### 兩條硬規則

1. **Scenario 只能改 Input，不能改 Output**——Scenario 是 Input Set，不是 Decision。
   輸出永遠由 Core／Decision 即時算，SSOT 恆成立。
2. **恰好一個方案標記為「作準（authoritative）」**，其餘為「試算中（exploratory）」。
   決策報告與所有對外輸出**只認作準方案**；比較表可並列，但必須標明何者作準。
   （沿用既有 `active_snapshot` 概念。）

### 一條補充規則

3. **Scenario 必須攜帶完整 input set，不得只存 diff。**
   diff 會在基準變動時失效且無法重現當初結果；完整 input set ＋ `input_hash`
   ＝ 永遠可重算、永遠可稽核（沿用 `recompute/input_hash` 紀律）。

```json
{ "scenario_id": "sc-002", "name": "積極拉滿",
  "authoritative": false, "engine": { /* 完整 input set */ },
  "input_hash": "sha256:…", "created_at": "…" }
```

---

## 8. Explainability / Attribution（新 Core 模組）★

**這是 M7 唯一真正的新 Core 能力，也是最有價值的一項**——它把 Decision Report
從「結論」變成「**可質詢的結論**」。

### 8.1 它不是 diff，是歸因

兩個快照相減只能說「什麼變了」，不能說「**誰造成的**」。要說「IRR 下降是因為 X」，
必須做反事實重算。

### 8.2 加總守恆（本節最重要）

改了多個欄位時，各自貢獻度**不會自動等於總變化量**（欄位間有交互作用）。若使用者看到
「IRR 掉 2.0%，但列出的原因只加到 1.4%」，**信任瞬間歸零**——而這個功能存在的目的正是建立信任。

| 方法 | 加總正確 | 成本 | 用在哪 |
|---|---|---|---|
| 一次改一項（OAT） | ❌ | n 次 | n 大時的退路（須附殘差） |
| **Shapley 值** | ✅ 完全等於 | 2ⁿ 次 | **n ≤ 10 預設用此** |
| 依序累加 | ✅ 但依順序 | n 次 | ❌ 不採用（順序不同答案不同） |

Core 快且可在瀏覽器內跑，n≤10 時 Shapley（≤1024 次重算）完全可行。

**不論用哪種方法，輸出必附 `residual`（交互作用／殘差），保證：**

```
Σ contributions + residual = 實際變化量
```

數字永遠對得起來——與既有「守恆到分」紀律一致。

### 8.3 API（`core/redcf/attribution.py`）

```python
attribute(before: dict, after: dict, target: str = "return_rate",
          method: str = "auto") -> dict
```

```json
{
  "target": "return_rate", "delta": -0.021,
  "contributions": [
    { "field": "住宅單價", "impact": -0.018 },
    { "field": "車位數",   "impact": -0.002 }
  ],
  "residual": -0.001,
  "method": "shapley", "runs": 64,
  "before_hash": "sha256:…", "after_hash": "sha256:…"
}
```

- `method="auto"`：n ≤ 閾值（config）→ shapley；否則 → oat（並於輸出標明）。
- 只讀 Core：`attribute` 內部僅呼叫既有 `recompute`，**不得複製任何公式**。

### 8.4 兩項裁決（M7.4 收尾）

**① Shapley 四公理全數納入回歸**（`tests/test_attribution.py`）

公理是**演算法的性質**，不該只靠特定領域資料碰巧成立來證明；故以合成價值函數直接單元測試
`_shapley`，再另以領域案例覆蓋一次：

| 公理 | 斷言 | 為什麼要守 |
|---|---|---|
| 效率性 | `Σφ ＝ v(N) − v(∅)` | 這就是加總守恆；破了就是「列出的原因加不回總變化」 |
| 對稱性 | 可互換因子的 φ 必相等 | 否則同樣的兩件事會被說成不同的原因 |
| **虛擬因子** | 從不改變 v 的因子 φ 必為 **0** | 防止把交互作用誤攤給無關欄位——這是最容易失察的誤導 |
| 線性 | `φ(v₁+v₂) ＝ φ(v₁)+φ(v₂)` | 保證多目標擴充時貢獻可分解 |

> 領域層另驗：改動不進入 `return_rate` 計算鏈的欄位（如 `屋齡`）時，該欄位**仍會被列出**
> 但 impact 為 0——誠實揭露「它被評估過且無影響」，而不是悄悄從清單消失。

**② 計算時戳「不」進報告契約——決定性優先**

交付計畫同時要求「輸出含計算時間」與「重跑同一快照結果一致」，**這兩者互斥**：
牆鐘時戳會讓同一份輸入每次產生不同 JSON，決定性即告破裂。

本規格裁定**決定性優先**：`attribute()` 的輸出是輸入的**純函式**，
可由 `before_hash`／`after_hash`／`core_version` 完整溯源，不含任何牆鐘欄位
（`computed_at`／`timestamp`／`generated_at`／`ts` 皆由回歸測試明文擋下）。
確有稽核需求時，時戳屬**傳輸層或 UI 狀態**（Worker 回應信封、Activity 事件），
不進 Core 契約——Activity 本來就記錄「誰在何時做了什麼」，那才是時間該住的地方。

---

## 9. Visualization（量體視圖）— 定義成「視圖」，不是建模工具

> **實作狀態（M7.5 v0.1）**：量體視圖＋逐層視圖已落地
> （`apps/web/massing-view.js`＋Workspace「量體」分頁，Gate 14 守衛）。
> **GIS 疊圖延後**：地圖底圖需外部圖磚，違反本專案「單一自含 HTML、零依賴、零 CDN、
> 可離線」的靜態純度紅線。要做需先決定離線圖資方案（自帶向量圖磚或政府開放圖資本地化），
> 屬獨立決策，不在 v0.1 內偷渡。

- **只做**：讀 Core 既有 `floors[]`（逐層樓板／計容積／梯廳／陽台）渲染的量體視圖、
  樓層視圖、GIS 疊圖。資料已存在，只是換一種畫法 → 便宜且誠實。
- **絕不做**：在 3D 裡拉量體、回推容積。那會在 Core 之外長出第二套計算，直接違反紅線。
- 本節為**純呈現**：不寫回任何案件資料。

---

## 10. 交付順序（Schema First，比照 M4/M6 成功路徑）

```
M7.1 Case OS Foundation   IndexedDB 遷移＋備份三條 → Activity → Session → History
M7.2 Watchtower           milestone/deadline/risk window → Timeline 未來半邊 →「今天要做什麼」
M7.3 Scenario             多方案＋恰好一個作準＋比較表
M7.4 Explainability       core/redcf/attribution.py（Shapley＋residual）＋對抗回歸
M7.5 Visualization        量體／樓層／GIS 視圖（讀既有 floors[]）
```

**順序理由**：M7.4 需 History 才能比較，不能前置；M7.5 獨立、隨時可插；
**M7.2 是整合人每天真正會用的東西，價值密度最高**，建議與 M7.1 併行。

---

## 11. 對抗性回歸（CI Gate）

```
Case A · 加總守恆
  改三個欄位（單價／車位／公設比）→ attribute()
  斷言：Σ contributions + residual == delta（容差 1e-9）

Case B · 順序無關
  同一組變更，以不同順序輸入 → shapley 貢獻度完全相同

Case C · 單一變更即精確
  只改一個欄位 → 該欄位 impact == delta 且 residual == 0

Case D · Scenario 不污染 SSOT
  建立 3 個 scenario、切換作準 → decision 只反映作準方案；
  非作準方案不得產生 verdict

Case E · Activity append-only
  嘗試修改既有事件 → 拒絕；事件流重放可還原任一時點狀態

Case F · Memory 不寫推論
  掃描 M7 寫入路徑，斷言未寫入 EV／verdict／IRR／坪數等推論欄位
```

---

## 12. Definition of Done

- [x] 儲存遷移至 IndexedDB，含 localStorage 一次性遷移器與唯讀備援期
      —— 遷移器已備妥（`case-store.js` `migrateFromLocalStorage`）。**Activity 已走 IndexedDB；
      案件本體仍在 localStorage**，待 dashboard 改為從 IndexedDB 讀寫後才可執行遷移
      （先跑會造成兩份真源，比不遷移更糟）。
- [x] Local-first 三義務：自動匯出提醒／一鍵備份還原（皆已接上「案件歷程」面板）
      —— File System Access 落檔待做（目前為下載檔案）
- [x] Activity append-only 事件流（含 `intent`），事件重放可還原狀態
      —— 三個接點已接 UI：**改清冊／拉滑桿／建案件自動留下紀錄**（Gate 12）
- [ ] Session ＝ Activity 命名區間（非獨立儲存）；UI 狀態與案件資料分離
      —— store 已具備 `startSession/endSession`，尚未接 UI（目前以「工作意圖」欄位承接意圖）
- [ ] History 版本鏈：完整 input set＋`input_hash`，舊 snapshot 永不重寫
      —— 歷程面板已把 `wf.project.snapshots` 併入同一條時間軸；完整 input set 的版本鏈待 M7.3
- [x] Timeline 含**未來半邊**（deadline／法定期限／72hr 風險窗，`source` 標示 heuristic）
      —— 另含**過去半邊**「案件歷程」面板（`build_timeline` 的 `past`）
- [ ] Scenario：只改 Input、恰好一個作準、攜帶完整 input set
- [ ] `core/redcf/attribution.py`：Shapley＋`residual`，加總守恆，零公式複製
- [ ] 量體視圖讀既有 `floors[]`，純呈現
- [ ] 新 schema 全數凍結並註冊三處（`check_schema_freeze.py`／`VERSION_POLICY`／`CHECKLIST`）
- [ ] 對抗回歸 A–F 全綠；既有 Gate 不退步（現況：13 道全綠，pytest 161）
- [ ] `check_no_real_names.sh` 綠

---

## 13. 明確不做（邊界）

- ❌ **帳號／雲端同步／多人協作**（→ Enterprise Edition，不在 M7）
- ❌ **AI Chat／LLM Agent／自動談判／語音助理**
  理由：護城河是 **Decision Model**，不是 AI。AI 很容易換，模型很難建立。
- ❌ 在 3D 中回推容積（第二套計算）
- ❌ M7 寫入任何推論結果（EV／verdict／IRR／對策）
- ❌ 真實案件資料進版控（僅本機；合成案例才進 tests/）

---

## 附錄 · 為什麼 M7 是「Memory」

- **M4 建立 Decision（判斷）**：這案子行不行。
- **M6 建立 Strategy（建議）**：那我先做什麼。
- **M7 建立 Memory（記憶）**：這個案件**如何一路走到今天**。

一旦有了 Memory，Timeline／Activity／History／Scenario／Watchtower／Explainability
就不再是零散功能，而是**同一個概念的不同面向**。

而 Explainability 是其中最硬的一塊：**別人可以抄一個介面，抄不走「為什麼 IRR 掉了 2%」
這個問題的可稽核答案。**
