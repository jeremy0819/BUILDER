# 玩家回饋改善與驗收報告

日期：2026-09-11  
分支：`codex/player-feedback-hardening`  
基底：`origin/main` 的 `03d8aa6`，包含 PR #27 介面修正及 PR #28 backlog 更正。  
交付狀態：本機程式與驗證完成；本分支供遠端複驗，未合併 main、未部署、未建立 release tag。  
使用者裁決：2026-09-11 授權推送分支；**Pages 部署設定暫不改**。

## 主管摘要

本輪優先降低三種風險：瀏覽器資料遺失而不自知、企業網路阻擋 CDN 導致無法計算、未校準的判定被當成投資結論。
另修正沙盤的案件名稱注入風險、硬編示範案簡報及案件意圖跨案共用問題。

本機驗收：**260 pytest + 577 web headless + 50 真瀏覽器檢查**通過。
Core 仍為 **0.6.0**；20 個凍結 schema、Core bundle、公式、費率與黃金範例均未修改。

重要界線：這仍是 Local-first 決策輔助系統，**不是**具帳號、雲端保存、不可竄改稽核、多人同步或靜態加密的企業案件平台。
備份提醒不能代替實際備份；未經校準的存活率也不因畫面改善而變得可靠。

## 交付範圍

| 回饋項目 | 本輪處置 | 狀態 |
|---|---|---|
| 資料遺失提醒 | 六個主要入口常駐本機資料警告、從未備份與逾 7 天提示 | 完成 |
| 完整備份 | localStorage 的 `uros.*` + IndexedDB cases/activity/meta，包含草稿、方案、Session | 完成 |
| 備份時間 | File System Access 寫入關閉成功後記錄；下載 fallback 必須另按確認 | 完成 |
| 備份還原 | 新版備份可還原至空白瀏覽器；保留事件 ID 與 meta 參照；不覆蓋已有案件 | 完成 |
| 本機 Pyodide | 同源優先、固定版本與 digest、包含驗證器依賴 | 程式與本機驗證完成，正式部署未啟用 |
| 校準標示 | 同源產生的校準資料、導覽列與決策圖標示、全頁模型限制說明 | 完成 |
| 手動建案 | 移除儀表板第二份建案表單，導向首頁；舊 JSON 匯入仍保留 | 完成此階段 |
| 四步功能收斂 | ③ 直達同意看板/任務；④ 直達決策紀錄/時間軸/歸因，沿用同一作用中案件 | 導覽完成，面板本體尚未搬移 |
| 分案草稿 | 意圖與步驟旗標改為版本化、以案件 ID 隔離 | 完成 |
| 舊全域意圖 | 不擅自歸案；使用者明確採用後才指定到本案，原鍵保留 | 完成 |
| 首頁資源 | 工具、閱讀資料、經典版本分組；V4 不重寫 | 完成 |
| 沙盤進場 | 共用淺/深主題、關閉黑色進場閃屏、未開局不顯示背景棋盤 | 完成 |
| 沙盤事實 | 簡報讀作用中案件；超出容量的示意盤面有持續提示 | 完成 |
| 本機診斷 | 50 筆上限，只記錯誤類別與時間，可單獨匯出 | 完成 |
| Gate 撞號 | 安裝不占 Gate；策略/資安為 21；瀏覽器保留 19；新增 22 與編號守衛 | 完成 |

## 工程細節

### 1. 備份不是「點下載就算成功」

新增 `apps/web/browser-backup.js`，備份封套為 `uros-browser-backup`、version 1。
它包住原 `uros-backup` v1 的 IndexedDB 快照，另保存本機 `uros.*` 字串值；沒有改既有 frozen schema。

- IndexedDB 三個 store 以**同一 readonly transaction**匯出。
- 匯出期間若 localStorage 變更，拒絕產出，要求停止編輯後重試。
- 讀寫及下載失敗不更新 `uros.last_backup_at`；不把下載開始宣稱為檔案已保存。
- JSON 經容量、深度、節點數與危險物件鍵檢查；備份封套上限 32 MB。
- 還原拒絕非本產品鍵、未知版本、重複鍵、不完整案件索引及已有案件的目標。
- 新版完整還原保留 activity.key 與 Session/Scenario meta；不是逐筆重新編號的合併匯入。
- localStorage 配額不足時，中止 IndexedDB transaction 並回復已寫入的 localStorage。
- 備份含案件與可能的個人資料，介面明示須妥善保存。沒有任何自動上傳。

同時修正 `case-store.js` 的查無資料行為：原本不存在的值可能回傳 IDBRequest；現在 meta 回 null，getCase 回 undefined。各有回歸。

**限制**：本輪不提供多個瀏覽器的增量合併、不支援以新版還原器直接讀舊的不完整備份封套，也不宣稱跨分頁多儲存系統具完整 ACID。
其他頁面仍保留原 v2.1/wf 匯入功能；未以「入口變少」為理由移除它們。

### 2. 執行環境與部署分離

`tools/prepare_pyodide.py` 依 `tools/pyodide-assets.lock.json` 打包 Pyodide 0.26.4。
13 個資源合計 **15,050,565 bytes**，包括 Python stdlib、jsonschema、attrs、pyrsistent、referencing、jsonschema-specifications、rpds-py、six 與授權檔。
每份資源驗證 SHA-256；相依輪檔沿用官方 Pyodide lock 的 digest。

Worker 預設讀 `runtime/pyodide-0.26.4/`；只有入口檔回 404 才回退至固定版本 CDN。
本機資源回其他錯誤、缺少驗證器或初始化失敗時不偷偷換來源，直接保留失敗狀態。
WebAssembly 的 MIME 為 `application/wasm`。

`ready` 訊息包含實際載入來源 `runtime_source`，經 `core-runtime.js` 原樣交給 `onReady`：
`same-origin` 代表同源 runtime；`cdn-fallback` 代表固定版 CDN 備援，不是依設定推測。
正式部署驗收應斷言此欄為 `same-origin`，不能只檢查 Core ready。

測試環境攔截整個 CDN 網域回 403，仍完成 recompute/decide/strategize/allocate；主要測試流程**零外部請求**。
另有獨立測試確認本機分發缺席時，固定版 CDN fallback 可以就緒。

**正式站未變更**：`.github/workflows/pages.yml` 沒有修改。日後授權部署時，仍須把通過 digest 檢查的 runtime 目錄放入 Pages artifact。
CI 增加的打包步驟僅服務測試，不等於已把 runtime 發布到網站。

**離線說明**：本機已有網站及 runtime、由 loopback HTTP 服務時，可不接外網計算；從未下載過的遠端網站不可能在完全斷網時首次造訪。
本輪不加 service worker，不宣稱一般 Pages 使用者已有完整離線快取。

官方依據：[Pyodide 0.26.4 分發文件](https://pyodide.org/en/0.26.4/usage/downloading-and-deploying.html)、[indexURL API](https://pyodide.org/en/0.26.4/usage/api/js-api.html)。

### 3. 校準資訊不混入凍結結果

`tools/build_calibration_notice.py` 從 `core/redcf/stage_tree.json` 產生 `calibration-data.js`：
包含原 `_note`、原 calibration 物件（`calibration_status`）、來源路徑及獨立的 presentation version。
前端不自行解析數值來猜是否校準；若 Core 原始狀態改變，產生器要求重新審查呈現契約。
Gate 22 驗證產物與來源相符。

這是**Core 校準事實的附屬呈現資料**，不是新增 `decide()` 輸出欄位；既有 Decision schema 不動。
現行模型與歷史匯入快照的校準範圍分開說明，不將現行狀態追認到舊結果。
同時修掉 unified CSS 把舊版快照警示隱藏的問題；導覽明標「快照判定」，區別第四步未寫回的本次分析。

### 4. 不能把所有散鍵都當成全域資料

實測 `uros.profiles.<pid>`、`uros.milestones.<pid>`、`uros.analysis.inputs.<pid>` 已分案，並非 backlog 所說的全部全域。
本輪保留這些可辨識歸屬的資料，不重複遷移。

新增 `case-drafts.js`：`uros.case-drafts.v1.<pid>`，封套含 version/project_id/values。
只允許 intent/site_visited/people_started；沒有 EV/verdict 等推論欄位。
步驟是否開啟是 UI 狀態，不放進 CaseStore 的案件事實層。
舊 `uros.intent` 無可信的案件歸屬，因此不自動掛給目前案件；需明確確認才採用。
Activity 延遲寫入也改以原案件 ID 取意圖，去抖鍵包含案件 ID，避免切案時串到另一案。

### 5. 新發現的呈現與安全缺口

加強回歸後確認案件名稱仍可從沙盤右側 Core 卡片進入 innerHTML，先前只檢查簡報並不足夠。
現已處理簡報、橋接提示、Core 卡片、警示文字、結算戶別與結算方案等外部字串。
溯源顯示的輸入 hash/core version/stale note 也經 HTML escape。
瀏覽器測試先將**作用中案件**寫成惡意 HTML，再開局與檢查財務卡，避免只改未選取案件而得到假陽性通過。

本機診斷與 Activity 分開儲存；不把例外原文、堆疊或可能含個資的參數塞進凍結的事實事件合約。

## 驗收紀錄

| 類型 | 結果 |
|---|---|
| pytest | 260 passed |
| 全部 `tests/web/test_*.mjs` | 577 passed，0 failed |
| Playwright + 真 Pyodide | 50 passed |
| Core isolation / template / links | PASS |
| schema freeze | 20 檔全部相符 |
| Core bundle / web version / chart contract | PASS |
| CI gate identity + 自測 / calibration 同步 | PASS |
| image whitelist | PASS |
| Gate 0 個資/地籍結構守衛及自測 | PASS，零命中 |
| Git diff whitespace | PASS |

主要瀏覽器證據：桌機 1440px、手機 390px；Core 48 戶選配與原生 Python 相等；
CDN 403、驗證器缺席、輸入失效、XSS、備份下載確認、原樣還原、拒絕覆蓋、配額失敗回復、81 戶上限、任務深連結。
截圖位於 `tools/browser/artifacts/`，全部為合成案例，該目錄不進版控。

CI 名稱實測：25 個具 Gate 名稱的步驟，24 個不同 Gate；只有刻意拆為兩步的 Gate 1 重複。
**以上是本機驗收，不是遠端 GitHub Actions 已執行的宣稱。**

## 工程師接手

本機啟動：

```powershell
python tools/prepare_pyodide.py
python tools/serve_web.py --port 8766
```

預覽：[http://127.0.0.1:8766/](http://127.0.0.1:8766/)。
需新版程式與已下載 runtime；此 port 使用自己的瀏覽器 origin，不會自動取得正式站的案件資料。

驗證：

```powershell
python -m pytest -q
Get-ChildItem tests/web/test_*.mjs | ForEach-Object { node $_.FullName }
python tools/check_ci_gates.py
python tools/build_calibration_notice.py --check
node tools/browser/verify.mjs
```

Windows 上依環境設定 `PLAYWRIGHT_BROWSERS_PATH`；本輪使用 `tools/browser/.browsers`。
Pytest 若遇預設暫存目錄權限問題，使用 repo 內全新的 `--basetemp` 目錄；不要清除使用者的資料目錄。

## 尚未完成的產品工作

0. **第四步錯誤文案**：`strategy-workspace.js` 的 `onError` 仍直接顯示 `m.msg`，可能露出原始 Worker/importScripts 字串。已確認此缺口，尚未在本批修改；需統一人話化並將技術細節收進可展開區，再補降級路徑測試。
1. **發布啟用**：等待使用者授權；目前正式站仍走原部署產物，不能宣稱已解決正式站 CDN 問題。
2. **Workspace 面板搬移**：本輪是同案深連結，不是已把面板內嵌到 ③④。下一步抽出共用 panel module，逐個搬遷，維持舊入口與匯入相容，避免 iframe 或複製事件/儲存邏輯。
3. **儲存模型整併**：目前仍有 localStorage 與 IndexedDB 兩套既存使用方式；完整備份已包住兩者，但單一寫入模型需要獨立遷移與衝突方案。
4. **備份進階**：大於 32 MB、跨瀏覽器合併、增量備份、加密備份及多分頁協調另立規格；目前不宣稱已支援。
5. **模型校準**：累積真實成敗案件，隔離 PII，再決定是否修訂機率與版本；不得以本輪 UI 標示取代校準。
6. **P3 企業能力**：帳號、權限、多租戶、資料庫、伺服器持久化、加密、協作與不可竄改稽核仍待產品/資安決策，未先行實作。

本輪沒有把「沒有後端」包裝成「已有企業級資安」，也沒有為了縮短待辦清單而刪掉既有功能。
