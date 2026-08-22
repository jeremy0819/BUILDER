# BUILDER 後續計畫（2026-08 提出）

> **範圍**：從「M8.1／M8.2 已出貨、hash 遷移已合併」到「os-v0.7.0 發布」之間的完整排程。
> **本檔性質**：排程與驗收契約，不是規格書。每一站的規格各自在既有 SPEC 檔內，本檔只定
> **順序、前置、完成判準**。與 `ROADMAP.md`（P0–P3 大階段）的關係：本檔是 P1 階段內部的施工序。
> **數字紀律**：下表全部由指令實測，不憑印象。改本檔時一律重跑。

---

## 0. 實測基準（2026-08-18）

| 座標 | 值 | 怎麼查 |
|---|---|---|
| CORE_VERSION | 0.6.0 | `grep CORE_VERSION core/redcf/_version.py` |
| 最新 release tag | os-v0.5.0 | `git tag -l \| tail -1` |
| 凍結 schema | 19 檔全數相符 | `python tools/check_schema_freeze.py` |
| CI Gate | 21 道 | `grep -c 'name: "Gate' .github/workflows/ci.yml` |
| Python 測試 | 234 passed | `python -m pytest -q` |
| 瀏覽器邏輯測試（node headless） | 379 passed（8 檔） | `for f in tests/web/test_*.mjs; do node $f; done` |
| **真正開過瀏覽器的測試** | **0** | 見 N3 |
| M8 DoD | 4 項已勾／3 項未勾 | `grep -n '\- \[' docs/architecture/M8_VIEWFINDER_SPEC.md` |

**已出貨**：M4 決策引擎 → M5 THE WORKFLOW → M5.5 傳動軸 → M6 THE STRATEGIST →
M7 THE CASE OS 全五項 → M8.1 圖表契約 → M8.2 歸因瀑布圖 → core 0.6.0 `input_hash` 數值正規化。

---

## 1. 排程總圖（依賴序，不可任意對調）

```
N1  Decision v0.2 攜帶 core_version ──┐
                                      ├─→  N2  os-v0.6.0 發布（走 CHECKLIST）
     （P1，三個邊界情形已裁決從嚴）   ┘
                                              │
                                              ▼
                                      N3  瀏覽器自動化（Gate 19）
                                              │
                        ┌─────────────────────┼─────────────────────┐
                        ▼                     ▼                     ▼
                   N4  M8.3 互動量體     N5  M8.4 敏感度地圖    N6  M8.5 GIS（方案 B）
                        └─────────────────────┴─────────────────────┘
                                              ▼
                                      N7  os-v0.7.0 發布
```

**為什麼是這個序**（每一條都是硬依賴，不是偏好）：

1. **N1 在 N2 之前**——使用者裁決明文：Decision v0.2 須於 `os-v0.6.0` 發布前完成。
   理由已寫在 `P1-decision_core_version_binding.md`：正規化讓 `input_hash` 變得**更**可靠，
   反而放大了單鍵比對的誤用風險。先發 0.6.0 再補，等於把「靜默錯誤綁定」印在正式版上。
2. **N2 在 N3 之後不行**——0.6.0 改的是**溯源語意**（Core 軸），M8 改的是**呈現**（App 軸）。
   VERSION_POLICY §2：上層可獨立於下層發布。把 Core 語意變更先鎖成一個 tag，M8.3–8.5 才能
   在一個穩定的 Core 上迭代，不必每次回頭確認自己踩在哪版雜湊上。
3. **N3 在 N4／N5 之前**——這是本計畫唯一「插隊」的一站，理由見 §4。

---

## 2. N1 · Decision v0.2 攜帶 `core_version`

**狀態**：規格已成文（`P1-decision_core_version_binding.md`），三個邊界情形使用者已裁決
**一律從嚴**，可直接施工，無待決事項。

| 項 | 內容 |
|---|---|
| 新增 | `schemas/decision.schema.v0.2.json`（新增檔；v0.1 凍結不動），必填 `core_version` |
| 改 | `core/redcf/decision.py` `decide()` 輸出補 `core_version` |
| 改 | `workspace.html` `matchDecision()` 單鍵 → 二元組 `input_hash` × `core_version` |
| 新增 | UI「版本不符」狀態：不綁定、明示要重算——**不提供「僅供參考」的軟綁定** |
| 遷移 | v0.1 舊檔讀入時 `core_version` 標 `"unknown"`，**不臆造** |

**三個從嚴裁決落地為三條斷言**：

| 情形 | 裁決 | 測試 |
|---|---|---|
| `core_version == "unknown"` | 拒絕綁定 | `test_decision.py` |
| 快照與 decision 版本不同 | 視為不相符 | `test_decision.py` ＋ headless |
| 只有 patch 差（0.6.0 vs 0.6.1） | 視為不相符 | `test_decision.py` |

> 第三條是最容易被「優化」掉的一條。公式相容與否**不該由版號字面推定**——
> patch 版也可能改係數。若日後真要放寬，必須是 Core 明文宣告的相容矩陣，不是字串比較。

**CORE_VERSION 是否再 bump？建議不 bump，維持 0.6.0。**
理由：0.6.0 尚未打 tag、尚未有任何消費端跑過，把 N1 併進同一個未發布版本，
`os-v0.6.0` 就是一次完整、自洽的「溯源語意升級」——鍵的穩定性與鍵的完整性同時到位。
拆成 0.6.0／0.7.0 會產生一個沒人用過的幽靈版號，違反 VERSION_POLICY「只增不減、不重用」的精神。
（此為判斷，非規則；使用者可推翻。）

**完成判準**：`pytest` 綠；新增 headless 覆蓋三條斷言；`check_schema_freeze.py` 20 檔相符
（19 ＋ decision v0.2）；CHECKLIST §C 與 VERSION_POLICY §1 的凍結清單同步更新（**三處登記**，缺一必掉 Gate 6）。

---

## 3. N2 · os-v0.6.0 發布

走 `docs/releases/CHECKLIST.md`，缺一項不發。本次 release 的實質內容只有兩件事，但都在溯源軸上：

- `input_hash` 數值正規化（跨 Python／JS 邊界穩定）
- Decision 二元組綁定（跨 Core 版本不誤掛）

**發布時必須寫進 release notes 的一句話**（否則使用者不會知道自己手上的舊檔怎麼了）：

> 0.6.0 起 `input_hash` 的定義已變更。0.5.0 以前產生的 Result／Decision JSON **仍可讀、可稽核**，
> 但其 `input_hash` 是當時的歷史戳記，**不等於**以 0.6.0 重算的值；Decision 舊檔的
> `core_version` 標為 `unknown`，將不再自動綁定快照，請重算。

**注意**：既有 `os-v0.5.0` tag 不移動、不重打（使用者裁決）。

---

## 4. N3 · 瀏覽器自動化（新增 Gate 19）——本計畫的插隊項

**這是我在本計畫中唯一主動加的一站，理由必須攤開講。**

現況：613 個自動化測試（234 pytest ＋ 379 node headless），**沒有任何一個真的開過瀏覽器**。
node headless 測的是「模組匯出的函式給定輸入回傳什麼」與「原始碼裡有沒有出現禁用字串」。
這對 M7 的資料層完全夠用，但 M8 從 M8.3 起測的東西變了：

| M8 DoD 要求 | node headless 能證明的 | 只有真瀏覽器能證明的 |
|---|---|---|
| 點選層 ↔ 明細列雙向對照（M8.3） | 對照函式的回傳值正確 | **點下去真的會亮** |
| **無任何拖曳改量體的路徑**（M8.3） | 原始碼沒有 `draggable` 字樣 | 對輸出圖元派送 drag 事件後，**狀態確實沒變** |
| 每格真實重算、宣告網格數 = 實際 recompute 次數（M8.4，對抗案例 G） | 迴圈次數的單元計算 | **真的呼叫了 N×M 次 Core** |

第二列與第三列是 M8 憲章的核心紀律（「可拖曳的只有 Input；Output 永遠唯讀」），
而它們**恰好是字串掃描證明不了的那一類**。一個負面斷言（「拖不動」）只能靠實際去拖。

M8.4 尤其危險：一張漸層敏感度圖會讓人以為每一點都算過。若實際上是插值出來的，
畫面不會報錯，只會很好看——這正是 M7.4 拒絕「虛假的其他歸因」時擋掉的同一種失敗形態，
只是換成了圖形。**沒有真瀏覽器跑過，Case G 就只是一份紙上規格。**

**施工內容**

| 項 | 內容 |
|---|---|
| 工具 | Playwright（**CI-only devDependency**，pin 版本），system Chromium，`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` |
| 新增 | `package.json`（本 repo 第一個 npm 依賴） |
| 新增 | `tests/browser/`：先補既有 M8.1／M8.2 的互動斷言，再供 M8.3–8.5 使用 |
| 新增 | CI `Gate 19 — Browser interaction (playwright)` |

**唯一需要權衡的取捨**：這會讓 repo 首次有 npm 依賴。
替代方案是自己用 CDP over WebSocket 手刻 harness（零依賴），但那等於自己維護一個瀏覽器驅動，
維護成本遠高於一個 pin 住的 devDependency。**建議用 Playwright**，並明確界定：
它是 **CI 與開發工具**，不是執行期依賴——M8「零圖表框架、零新增 CDN、可離線呈現」的紀律不受影響
（該紀律約束的是使用者載入的頁面，不是我們的測試機）。

**完成判準**：Gate 19 綠；至少一條負面斷言（對 Output 派送 drag 後狀態不變）通過；
既有 379 個 node headless 測試**全部保留不刪**（兩者互補，不是替代）。

---

## 5. N4–N6 · M8 剩餘三站

規格見 `M8_VIEWFINDER_SPEC.md` §5–§7，此處只列排程要點與各自的翻車點。

### N4 · M8.3 互動量體
- 從 `massing-view.js` 升級，加雙向對照。
- **翻車點**：把「調整量體」當成互動的自然延伸。不是。量體是 Output，
  改量體要回到 Input 改 `floors[]` 再重算，中間沒有捷徑。
- 驗收：Gate 19 的負面斷言（拖不動）＋ 既有 Gate 14。

### N5 · M8.4 敏感度地圖
- **前置：N3 必須先綠。** 這是本計畫中唯一的硬性「不准提前」。
- **翻車點**：平滑化。允許視覺平滑，但必須明示「格線之間是插值，不是計算結果」，
  且宣告網格數與實際 recompute 次數必須相等（對抗案例 G）。
- 驗收：Case G 由真瀏覽器計數 Core 呼叫次數，不接受單元測試的迴圈計數代替。

### N6 · M8.5 GIS 疊圖（方案 B：本機匯入）
- 方案 B 已定案：**本機匯入，不連外部圖磚服務**。
- **翻車點**：地籍圖一進來就是真實案件資料。`local_calibration/` 是唯一落地處，
  匯入流程必須在 UI 層就講清楚「這份圖不會進版控」。Gate 0 的結構式守衛（三條地籍格式樣式：
  地號／建號、段名＋數字、門牌；樣式定義以 `tools/check_real_data_patterns.py` 為唯一來源）
  已能攔截誤入版控的地籍格式，但**守衛是最後一道，不是流程設計**。
- 圖資分層依 `docs/methodology/圖資來源包-縣市模組.md` 的五層（定位→權屬→管制→現況→試算連動）。

---

## 6. 兩條長期阻塞（本計畫解不掉，但必須持續掛帳）

### 6.1 P3 開工 Gate 仍卡住

`ROADMAP.md` 的 P3 開工 Gate 三項，目前**兩項未過**：

| Gate 項 | 狀態 |
|---|---|
| ① P1＋P2 穩定運轉 | 進行中 |
| ② 權變／現金流經真實案驗證 | **未過**——`stage_tree` 存活率目前僅 n=1 錨定，樣本不足以支撐對外宣稱 |
| ③ 真實清冊 PII 隔離方案定案 | **未過**——方案未定 |

②是統計問題（需要更多真實案），③是設計問題（需要一次裁決）。
**③可以現在就推進，不必等②**：它是一份設計決策文件，不是資料蒐集。
建議在 N6（GIS）之前處理，因為 GIS 匯入會第一次讓大量真實地籍資料靠近系統邊界。

### 6.2 PR 合併掉 commit（已發生兩次）

**現象**：GitHub 記錄的 head SHA 在合併時是舊的，之後推上去的 commit 被靜默丟掉。

| PR | 掉的內容 | 處理 |
|---|---|---|
| #16 | M7.4 ＋ V3 文件的後續 commit | 事後 cherry-pick 補回 |
| #23 | `fab32f7`（repo 精修） | 事後 cherry-pick 至 `claude/map-source-pack`（即 PR #24） |

**這不是隨機故障，是流程缺口**：在 PR 開啟後才推的 commit，若合併動作用的是快取的 head，
就會被跳過。**建議規則**：合併前一律先確認 PR 的 head SHA 等於本地分支 HEAD；
合併後一律 `git log origin/main --oneline -5` 確認每個 commit 都在。
本計畫的每一站合併後都應執行這兩個檢查——**兩次都是事後才發現，代價是額外一輪 PR。**

---

## 7. 明確不做（本階段邊界）

- **不做** 拖曳改 Output 的任何形式（M8 憲章）。
- **不做** 真實 PII 進版控——地籍圖、地主清冊一律 `local_calibration/`。
- **不做** 跨 Core 版本的 hash 相容層。舊檔就是舊檔，可讀可稽核，但不宣稱等同。
- **不做** 前端補算 Core 取不到的值（EV／verdict／風險窗／三型分類）——schema 先行。
- **不動** `os-v0.5.0` tag；**不重寫** `simulator.html` V4；**不改** 凍結 schema 位元組。
- **不開** API／不拆 Agent repo——P3 開工 Gate 未過（見 §6.1）。

---

## 8. 一頁摘要

| 站 | 內容 | 前置 | 完成判準 |
|---|---|---|---|
| N1 | Decision v0.2 攜帶 `core_version` | 無（已裁決從嚴） | 三條從嚴斷言綠；凍結清單三處同步 |
| N2 | os-v0.6.0 發布 | N1 | CHECKLIST 全勾；release notes 含舊檔說明 |
| N3 | 瀏覽器自動化 Gate 19 | N2 | 至少一條負面斷言（拖不動）通過 |
| N4 | M8.3 互動量體 | N3 | 雙向對照＋無拖曳路徑（真瀏覽器驗） |
| N5 | M8.4 敏感度地圖 | **N3（硬性）** | Case G：宣告網格數 = 實際 recompute 次數 |
| N6 | M8.5 GIS 方案 B | N4 |（建議先過 P3 Gate ③）匯入不進版控 |
| N7 | os-v0.7.0 發布 | N4–N6 | CHECKLIST 全勾 |
