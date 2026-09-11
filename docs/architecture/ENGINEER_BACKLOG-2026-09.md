# 工程師待辦清單（2026-09-10）

> **來源**：以玩家視角實測整個介面後的稽核（真實 Chromium 逐頁走過），加上介面複雜度與
> 技術缺口的量測。**每一條都附「怎麼查」**——數字全部實測，不是估計。
> **範圍**：本檔只列**工程師**要做的事。已由 Claude 修掉並推上
> `claude/m6-kickoff-part-a-xooh6i` 的六項見 §0，不重複列。
> **不含**：需要 PM 先裁決的設計題（視覺語言收斂、後端上雲時程）——那些在 §5。

---

## 0. 已修（不用再做，但 rebase 會碰到）

Claude 已完成並推送，`54a4f8a`：

| 項 | 內容 |
|---|---|
| ③ 人心接上作用中案件 | 新增 `CaseBus.buildSandboxBridge()`／`syncSandboxBridge()`；同意面採誠實邊界 |
| stepValues 綁定檢查 | 綁不上的 decision 一律顯示「—」並說明原因 |
| 陳舊快照標記 | `provenance().stale`；導覽列顯示「數字來自 Core 0.4.0 快照（現行 0.6.0）」 |
| Core 不可用仍可建案 | 輸入是事實，不該與計算綁死；`input_hash` 標 `pending:` 前綴不偽造 |
| 錯誤訊息人話化 | 原始例外收進 `title` |
| ② Core 摘要補內容 | 原本四張 KPI 底下整片空白 |

**rebase 注意**：動到 `case-bus.js`、`stepnav.js`、`index.html`、`os-simulator.html`、
`os-shell.js`、`os-unified.css`，並在 `evaluator/os-simulator/report` 三頁補了 `version.js`。

---

## 1. 🔴 資料會消失，而且使用者不知道

**現況（實測）**：全部案件只存在瀏覽器的 localStorage ＋ IndexedDB。
**零處**警告使用者「清除瀏覽資料＝全部消失」。

```
grep -rl "清除.*瀏覽|不可復原|無法復原" apps/web/ | wc -l     # → 0
```

都更案的生命週期是 5–10 年，瀏覽器儲存不是這種東西該待的地方。這不是功能不足，
是**資料會靜默消失**。

### 要做的

`case-store.js` 已經有 `last_backup_at`（第 182／187 行）與 `markBackedUp()`，**只是沒人用它**。

- [ ] 開頁檢查距上次備份的天數；超過門檻（建議 7 天）顯示常駐提醒，不是一次性 toast
- [ ] 首次建立案件後立即提示一次「這份資料只存在這台電腦，請匯出備份」
- [ ] 匯出成功後呼叫 `markBackedUp()`
- [ ] 設定頁（或工作區）顯示「上次備份：X 天前」

**驗收**：清空 localStorage 後開頁建案 → 出現備份提醒；匯出後提醒消失；
`last_backup_at` 確實被寫入（DevTools → IndexedDB 可驗）。

**不要做**：不要為此加後端。這一條的目的是把「靜默遺失」變成「使用者知情」，
真正的伺服器持久化是 §5 的 PM 裁決題。

---

## 2. 🟠 首次載入依賴外部 CDN，企業內網直接掛掉

**現況（實測）**：`core-runtime.worker.js` 從 `cdn.jsdelivr.net` 載 Pyodide。

```
grep -c "cdn.jsdelivr" apps/web/core-runtime.worker.js      # → 1
```

**這不是假想情境**：本次稽核的環境政策擋掉該網域（CONNECT 403），結果整個產品降級——
四步的數字全部「取不到」，只剩示範案可看。企業內網、政府單位、金融機構常態擋外部 CDN。

### 使用者裁決（2026-09-10）：分兩階段，**本階段只做程式與驗證，不動部署設定**

> 這樣切是安全的：本地優先＋CDN 備援，在本地檔案尚未部署時，行為與今天完全相同
> （找不到本地就回退 CDN），故程式可先合併、不改變線上行為。

**階段一（現在做）— 程式與驗證**

- [ ] `CDN` 常數改為可設定：預設先找同源的 `./pyodide/`，找不到才回退 `cdn.jsdelivr.net`
      （**本地優先、CDN 備援**，不是反過來）
- [ ] `ready` 訊息回報**實際用了哪個來源**（`source: "local" | "cdn"`）。
      ⚠️ 這條不是可有可無：靜默回退等於「本地副本漏掉了也沒人知道」，
      部署階段上線後會以為成功、其實一直在走 CDN。
- [ ] 測試用的本地副本以腳本抓進 **gitignored** 目錄（例：`tools/browser/.pyodide/`），
      **不得 commit 進版控**——repo 現在 `size-pack: 1.33 MiB`，二進位一旦進 git 歷史就拿不掉
- [ ] `tools/browser/verify.mjs` 加兩條斷言：
      ① 封鎖 `cdn.jsdelivr.net` 回 403 → Core 仍 ready 且 `source === "local"`
      ② 移除本地副本 → Core 仍 ready 且 `source === "cdn"`（備援確實有效）

**階段一驗收**：上述兩條瀏覽器斷言綠；`git status` 無二進位新增；線上行為不變
（未部署本地副本時仍走 CDN，`source === "cdn"`）。

**階段二（暫緩，待裁決）— 部署**

- [ ] `pages.yml` 加一步：部署時下載固定版本 Pyodide 至 artifact（**不進版控**）
- [ ] 解掉「離線首次啟動」——`RELEASE_NOTES-os-v0.6.0.md` 已知缺陷第 6 項
- [ ] 注意 Pages 流量：每月 100 GB 軟上限，約 25 MB × 首次訪客

> **不需要動 repo Settings**：`pages.yml` 已走 `actions/deploy-pages`，
> Source 若已是「GitHub Actions」，階段二只是改這個 workflow 檔案。

---

## 3. 🟠 判定建立在未校準的數字上，畫面沒說

**現況**：`core/redcf/stage_tree.json` 的 `_note` 自述：

> duration_yr 之 T4–T7 已由一件在途真實案錨定；**p_survival 仍為【示意預設】，尚未經真實成敗案校準**

而 `p_survival` 正是 `completion_probability` → 三方 EV → **GO/CAUTION/STOP** 的來源
（T1=0.65、T2=0.85、T3=0.80…）。文件標示很誠實，但**畫面上那個紅色 STOP 不會告訴使用者
它建立在示意值上**。

這是信譽風險大於技術風險：有人拿 STOP 去跟地主談判，而 0.65 是猜的。

### 要做的

- [ ] 凡顯示 `verdict`／`completion_probability`／EV 之處，一律附「存活率未校準」標示
      （`report.html` 已有「方向性判斷（存活率未校準）」，但**導覽列與 ④ 四象限圖沒有**）
- [ ] 標示文字取自 `stage_tree.json` 的 `_note`，不要各頁自己寫一份
- [ ] Core 端提供 `calibration_status` 欄位供 UI 讀取，UI 不得自行判斷校準與否

**驗收**：導覽列的 STOP 旁、④ 判讀卡片上都能看到未校準標示；
關掉 `_note` 會讓 `load_stage_tree()` 拋錯（既有行為，勿破壞）。

---

## 4. 🟠 介面複雜度：四步是嫁接的，舊結構沒退場

**量到的**：

| 指標 | 數字 | 怎麼查 |
|---|---|---|
| HTML 頁／JS 模組／前端總行數 | 10／18／**16,035** | `cat apps/web/*.html apps/web/*.js \| wc -l` |
| 可建立或匯入案件的頁 | **5** | `grep -ln "新增案件\|建立案件\|importV21" apps/web/*.html` |
| 會顯示投報率的頁 | **5** | `grep -ln "return_rate" apps/web/*.html` |
| localStorage 鍵 | **15** ＋ IndexedDB | `grep -rhoE '"uros\.[a-zA-Z0-9_.]+"' apps/web/ \| sort -u` |
| 控制項最多的頁 | evaluator 34／workspace 33／dashboard 26 | 見稽核腳本 |

**根因**：四步動線（①→④）是後來加的骨幹，但「一個工具一頁」的舊結構原封不動留著，
於是**兩套案件管理平行存在**：

| | `dashboard.html`（四步內） | `workspace.html`（四步外） |
|---|---|---|
| 專屬功能 | 產權清冊、逐層樓板、量體生成、現金流、傳動軸 | 同意看板、任務、決策日誌、時間軸、wf 匯出 |

使用者要記住「同意看板在那邊、產權清冊在這邊」。**複雜度來自結構重疊，不是版面。**

### 要做的（功能零損失）

- [ ] **4.1 建案入口 5 → 1**：只有 `index.html` 真正建案，其餘四頁的「新增案件」改為跳轉。
      *成本：機械性，約半天。*
- [ ] **4.2 workspace 併進四步**：同意看板／任務 → **③ 人心**；決策日誌／時間軸 → **④ 決策**；
      多案列表／wf 匯出保留為「案件櫃」，降級為選案與匯出，不再是平行的案件管理頁。
      *成本：搬移不是重寫，約 1–2 天。*
- [ ] **4.3 散鍵收進案件紀錄**
      **⚠️ 更正（2026-09-11）**：本項原列六個鍵，**其中三個是我誤判**。實測結果：

      | 鍵 | 實際 | 怎麼查 |
      |---|---|---|
      | `uros.profiles.<pid>` | **已分案** ✓ | `strategy-workspace.js:66` |
      | `uros.analysis.inputs.<pid>` | **已分案** ✓ | `strategy-workspace.js:67` |
      | `uros.milestones.<pid>` | **已分案** ✓ | `dashboard.html:820` `msKey(pid)` |
      | `uros.step.site` | 全域 ✗ | `dashboard.html:388` |
      | `uros.step.people` | 全域 ✗ | `os-simulator.html:1179` |
      | `uros.intent` | 全域 ✗ | `dashboard.html:563` |

      故本項範圍縮小為**後三個**。前三個已正確分案，不要重複遷移。
      `uros.step.*` 是 UI 狀態（這一步開過沒有），`uros.intent` 是使用者意圖——
      兩者切換案件時都不會跟著換，是潛在的錯資料來源。
      ⚠️ 舊 `uros.intent` **沒有可信的案件歸屬**，不得自動掛給目前案件（那是臆造），
      需使用者明確確認後才採用，原鍵保留。
      *成本：約半天。*
- [ ] **4.4 延伸資源再砍**：`simulator.html`（V4 已封版）、`briefing`／`guide`／`whitepaper`
      是讀物，不該與工具並列於同一展開區。**不重寫 V4（紅線 5），只調整導覽。**

**驗收**：功能清單逐項對照，零項消失；`grep -ln "新增案件" apps/web/*.html` 只剩 1 頁；
切換案件後所有步驟狀態一致（4.3 的回歸測試要新增）。

---

## 5. 🟡 其餘技術缺口（依阻擋程度排序）

**實測：這七項是真的零**（先前 grep 命中的 auth／i18n 為誤報，實際是 `author`、`locale`）：

| 要件 | 現況 | 歸屬 |
|---|---|---|
| REST/GraphQL API | 無 | P3 開工 Gate 未過，**先不做** |
| 伺服器持久化（DB） | 無 | **PM 裁決**（見下） |
| 使用者帳號／多租戶 | 無 | **PM 裁決** |
| 稽核軌跡（不可竄改） | 無 | **PM 裁決** |
| 權限／RBAC | 無 | **PM 裁決** |
| 加密（靜態資料） | 無 | **PM 裁決** |
| 多人協作 | 無 | **PM 裁決** |

> **給 PM 的一句話**：都更本質上是實施者×地主×建築師×估價師×主管機關，
> 但目前**沒有任何機制讓兩個人看到同一個案子**——連唯讀分享都沒有。
> 「同意看板」「地主分型」的價值前提是多方協作，現在只能一個人在自己電腦上維護主觀紀錄。
> 這是產品定位問題，不是工程排序問題，需要先裁決。

### 工程師現在可以做的小項

- [ ] **5.1 可觀測性**：`sentry|telemetry|analytics|reportError` 命中 **0 檔**。
      使用者踩到錯誤永遠不會有人知道。本次稽核發現的「② 預設分頁空白」「③ 顯示錯案子」
      如果有錯誤回報，早就浮出來了。
      *建議：最小可行＝把未處理例外與 Core 失敗寫進 Activity（本機即可，不外傳）。*
- [ ] **5.2 規模上限是無聲的**：`case-bus.js:389` 有 `owners.length <= 80`，
      **超過 80 戶的案子逐戶事實直接丟棄且不告知**。
      *要做：超限時明確告知「本案 N 戶超過沙盤上限 80，逐戶事實未載入」，不要靜默。*
- [ ] **5.3 無障礙**：aria 屬性只有 **5 種**（`grep -ohE 'aria-[a-z]+' apps/web/*.html | sort -u`）。
      *建議：先補四步主要互動元件的 `aria-label`／`aria-live`，不必一次全站。*

---

## 6. 🟡 CI Gate 編號又撞號

```
grep -oE 'name: "Gate [0-9.]+' .github/workflows/ci.yml | sed 's/name: "//' | sort -V | uniq -c
```

現況：Gate 總數 **25**，其中

- `2× Gate 1` — **這個是刻意的**（`ci.yml` 開頭明載：pytest 與 min_example 同屬一道）
- `3× Gate 19` — **這個要修**：
  - `Gate 19 — Strategy / security / site massing boundaries`
  - `Gate 19 — Install browser verification tools`
  - `Gate 19 — Real browser / Pyodide / responsive / stored-XSS regression`

上一輪的 `2× Gate 18` 已由 Claude 改掉（unified-UI 改編 Gate 20），這是新的一組。

- [ ] 重新編號：建議 strategy/security → **21**、install browser tools 併入 real browser 那道
      （安裝步驟不該自己佔一個 Gate 編號）、real browser 維持 **19**
- [ ] 補一條守衛：`tools/check_ci_gates.py` 檢查編號不重複（`Gate 1` 例外需白名單）
      ——**這已經連續兩輪發生，靠人工看不住**

**驗收**：`uniq -c` 除 `Gate 1` 外無重複；新守衛進 CI。

---

## 7. 建議施工序

| 順位 | 項目 | 理由 | 規模 |
|---|---|---|---|
| 1 | §1 備份提醒 | 唯一「會讓使用者失去資料」的項目 | 數小時 |
| 2 | §6 Gate 編號＋守衛 | 連續兩輪發生，先止血 | 數小時 |
| 3 | §2 Pyodide 自帶 | 單點失效，已實際發生 | 1 天 |
| 4 | §3 未校準標示 | 信譽風險 | 半天 |
| 5 | §4.3 散鍵收攏 | 潛在錯資料，越晚改越痛 | 半天＋遷移 |
| 6 | §4.1／4.2／4.4 介面收斂 | 體驗，但不會出事 | 2–3 天 |
| 7 | §5.1／5.2／5.3 | 補強 | 各半天 |

---

## 附：本系統已經是專業水準的部分

列缺口容易讓人以為整體不行，所以也要講公道話。以下**優於多數商用系統**：

- **SSOT 紀律**：唯一計算來源、UI 零推論，且有 CI 守著（不是靠自律）
- **凍結 schema ＋ 位元組守衛**：20 檔，改一個位元組 CI 就紅
- **溯源二元組**：`input_hash × core_version`，三個邊界情形一律從嚴
- **測試深度**：25 道 Gate、257 pytest ＋ 551 node headless ＋ 真瀏覽器回歸
- **誠實邊界**：算不出來就顯示「—」，不用估算值頂替

> **問題不是做得不夠好，是做得很好的部分和完全沒做的部分落差太大。**
> 計算核心與資料紀律是專業級的，但它跑在一個沒有帳號、沒有資料庫、沒有備份的瀏覽器頁面上。
