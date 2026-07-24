# M6 THE STRATEGIST — Kickoff（新 session 開場包）

> 用法：開新 session 後，把 **Part A** 貼進去當開場；**Part B** 是護欄（連同你的 M6 spec 一起貼，
> 或叫 session 直接讀本檔）。**Part C** 是本檔已含的分型草案（M6 核心輸入）。
> 現況基準：`main` @ CORE_VERSION 0.4.0、ENGINE_VERSION 0.1.0、schema 凍結 9 檔、CI 十道 Gate 全綠。

---

## Part A — 開場指令（貼這段）

```
你接手 Urban Renewal OS（monorepo：jeremy0819/BUILDER）。本 session 的任務＝M6 THE STRATEGIST。
開工前先讀，依序：
1. CLAUDE.md（索引）
2. knowledge/00_FIRST_PRINCIPLES.md（決策脊椎＋新頁面四題關卡）
3. docs/architecture/DECISION_ENGINE_SPEC.md（M4 憲法；M6 是它的上一層）
4. docs/releases/M6_KICKOFF.md（本檔：護欄＋分型草案）
5. docs/releases/HANDOFF-M5.5.md、CHANGELOG.md 的 0.4.0 條目（最新座標）

現況座標：
- 分支＝單線 main；已部署（Pages 從 main 自動部署 apps/web/）。CORE_VERSION 0.4.0、
  Decision Engine ENGINE_VERSION 0.1.0；CI 十道 Gate（0–9）全綠、pytest 95、
  沙盤86/工作區49 headless 全過。
- 已完成：M1–M4、M4.5 試金石、M5 THE WORKFLOW（P0/P1/P2）、
  M5.5 傳動軸駕駛艙（B1 Pyodide／B2 同框／B3 高亮）＋B1.5 零步啟動與介面收斂。
- 五層架構：Knowledge → Core(事實) → Workflow(狀態) → Decision Engine(分析,M4)
  → 【Strategy Engine(建議,M6)＝你要做的】 → Presentation。

里程碑正名（務必遵守）：M5＝THE WORKFLOW、M6＝THE STRATEGIST（逐型對策）。
同框駕駛艙屬 M5.5 B2，不是 M6。

M6 定位（一句話）：讀 Decision Engine 的輸出（verdict／breakpoint_stakeholder／三方 EV／
exit_signal）＋ Workflow 狀態 ＋ 利害關係人分型，產出「逐型對策」＝針對每一型地主/關係人
該先談誰、怎麼談、給什麼條件。M6 只建議，不計算、不反算 Core、不重算 EV。

【重要】M6 完整 spec 我會另外貼給你（或已在 docs/architecture/）。收到 spec 前，先只做
「讀檔＋盤點＋回報你打算怎麼切 slice」，不要動手寫程式。切法要 Schema First（比照 M4：
先定 strategy schema＋validator＋對抗案例回歸，再接 report.html 的 Strategy 空槽）。
```

---

## Part B — M6 護欄（紅線；違反任一＝停下回報）

1. 計算公式只存在 `core/redcf`；前端/Strategy 呈現層一條公式都不准寫。
2. schema 凍結檔位元組不可變（v1.1/v2.0/v2.1/三視圖/wf-1.0/decision.v0.1/
   household_outcome.v0.1，Gate 6 守衛）。M6 要新合約＝**新增** `strategy.schema.v0.1`，
   **不得改動**既有凍結檔。
3. 零真實案件資料進版控（段名/姓名/金額，含檔名與 commit 訊息）；真實校準一律
   `/local_calibration/`（gitignored）。示範案一律合成（沿用 `apps/web/demo-case.js` 的案例D）。
4. 改公式必跑 `pytest`，不綠不 commit/push。
5. `simulator.html` V4 封版，不重寫。
6. UI/Strategy 呈現層**永不自行推論**：M6 的「對策」必須來自 Strategy Engine（`core/redcf` 內、
   有 schema、可回歸測試）；`report.html`／駕駛艙只逐欄呈現，不得由 UI 發明邏輯。
7. M6 只讀 Decision Engine 輸出＋Workflow 狀態，**不反算 Core、不重算 EV/verdict**
   （那是 M4 的權威；引爆點 `breakpoint_stakeholder` 也由 M4 給，M6 不自判）。
8. willingness 分工鐵則：方向(sign)＝領域真理鎖在程式＋回歸測試；幅度(magnitude)＝config 檔。
9. 分支：依你被指定的分支開發；本 repo 慣例單線 `main`。作法＝commit 到分支後 ff 併入 main
   並 push（Pages 只從 main 部署）。未經使用者許可不得推非指定分支。

**Schema First 交付順序（比照 M4 成功路徑）**：
① `strategy.schema.v0.1`（＋validator）→ ② 利害關係人分型定義（`stakeholder_profile`，
M4 曾標為待續）→ ③ `core/redcf/strategy.py`（decide 的上層：讀 decision JSON→逐型對策）→
④ 三個對抗案例回歸（`tests/test_strategy.py`）→ ⑤ 接 `report.html` 的 Strategy 空槽（純呈現）
→ ⑥ 若有瀏覽器內即時需求，記得同步 core-bundle（Gate 9）。

---

## Part C — 利害關係人分型草案（M6 核心輸入・使用者核准）

> 這是 Strategy Engine 分型的起點；M6 開工時由使用者補完數值與話術細節。
> 「分型」屬領域真理（型別集合＋判別條件鎖在程式＋回歸測試）；「對策幅度/文案」屬 config（可換）。

### C-1 五型（判別依據皆取自既有事實層，不新造計算）

| 型別 | 判別訊號（來自 owners[]／consent 事件／household_outcome） | 談判本質 |
|---|---|---|
| **釘子戶** | `consent=opposed` 且久未鬆動（consent 事件停在 declined/withdrawn）；常為 `breakpoint_stakeholder` | 最大過濾器（對映 stage_tree T1）；價格外的訴求 |
| **觀望戶** | `consent=pending`、有接觸但未表態（contacted/negotiating，未到 verbal_ok） | 從眾/資訊不足；靠進度與同儕帶動 |
| **已同意未選配** | `consent=agreed` 但 `household_outcome` 無 `selected_unit`（agreed_unselected） | 已上車、卡在配置；找補/樓層爭議 |
| **投資客** | 多戶/高 land_share、`pre_building_area` 低而 `pre_value` 高、無自住訊號 | 純財務理性；用 EV/時間成本談 |
| **祖產情感戶** | 單戶、長屋齡、拒絕以價格衡量（情感訴求出現在接觸紀錄） | 非財務動機；需情感/象徵性方案 |

### C-2 對策維度（每型都要給這三軸，作為 strategy.schema 的欄位骨架）

1. **先後順序（sequence）**：先談誰、後談誰。原則＝先鞏固「觀望戶」擴大同意基本盤，
   對「釘子戶」留到有籌碼再攻；`breakpoint_stakeholder` 標記者單獨列高優先。
2. **條件讓步（concession）**：可動用的籌碼與上限（找補彈性、樓層/座向優先、
   搬遷補貼、時程保證…）。**幅度是 config，方向/可用與否是領域真理。**
3. **話術方向（narrative）**：對該型的溝通主軸（投資客談 EV 與時間成本、
   情感戶談象徵與尊重、觀望戶談進度與同儕）。文案存 config，不寫死在程式。

### C-3 M6 產出物（供 report.html Strategy 空槽呈現）

- 逐型「下一步該做什麼」清單（誰、順序、可動用籌碼、話術主軸），
  每條可溯源到 decision 輸出（哪個 verdict/EV/breakpoint 驅動）。
- **非投資結論**同樣掛標（沿用 M4.5 的措辭：方向性判斷、stage_tree 存活率未校準）。
- 全部來自 Strategy Engine schema，UI 零推論。

---

## 附：進 M6 前的擁有者待辦（不強相依，但影響可信度）

1. **部署後親驗 Pyodide 即時運算**（開 Pages 的 dashboard → 傳動軸狀態「就緒 · core 0.4.0」
   → 拖滑桿看數字閃動更新）。
2. **補發 `os-v0.4.0` release**（現行 tag `os-v0.3.0` 停在 M4.5，落後 main 16 個 commit）。
3. **破局案校準 stage_tree 存活率**：蒐集真實「完工/破局」結局（案型、達到最遠階段 T1–T8、
   最終結局、破局原因、各階段耗時），把 `stage_tree.json` 的 `p_survival` 示意值換成實證頻率，
   才能把 verdict 從「方向性判斷」升到可信。真實資料只放 `/local_calibration/`。
