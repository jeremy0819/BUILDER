# BUILDER 本機接續開發紀錄 — 2026-09-25

基準：`main` @ `08097b8`。本紀錄記載 2026-09-25 本機驗證時的狀態，當時尚未 commit、push 或部署；後續工作見 [0.7.0 實作紀錄](OS_0_7_LOCAL-2026-09-27.md)。

## 已完成

1. 建立新版 BUILDER 工作副本，保留原有兩庫舊版。工作區整理清單另存在儲存庫外，避免把私人文件名稱與本機路徑加入版控。
2. 完成 [驗證機制、請求流程與憑證邊界](../architecture/AUTHENTICATION.md) 說明，並加入 README 索引。
3. 修正 `browser-backup.js` 的完整備份匯入驗證。

### 問題與修正

修正前，workflow `{ "order": [], "projects": "broken" }` 會通過備份驗證。
這會允許不符合 `CaseBus.readStore()` 要求的案件映射進入還原流程，造成後續案件讀取失敗。

修正後：workflow 與 projects 必須是物件；每筆紀錄必須是物件；索引不得重複、空白或指向非自有屬性。
欄位存在但字串為空也不能跳過驗證。錯誤在開啟 IndexedDB／寫入 localStorage 之前返回。
不改 Core 計算、凍結 schema、部署設定或既有有效備份的格式。

## 實測結果

| 驗證 | 結果 |
|---|---|
| 修正前重現 | 新增測試在 `projects: "broken"` 出現 `Missing expected exception` |
| `node tests/web/test_player_feedback.mjs` | 37 passed（原 24，新增 13） |
| `node tests/web/test_strategy_security.mjs` | 49 passed、0 failed |
| `tests/web/test_*.mjs` | 15 組檔案全部 exit 0 |
| `tools/check_schema_freeze.py` | 20 份凍結 schema 全相符 |
| `tools/check_web_links.py` | 161 條本地連結可達 |
| `tools/check_core_bundle.py` | Core bundle 同步 |
| `tools/check_ci_gates.py` | PASS |
| `tools/check_real_data_patterns.py` | PASS（結構式地籍資料守衛） |
| `node --check` | 修改的備份 JS 與瀏覽器驗證腳本通過語法檢查 |
| `git diff --check` | PASS |
| 新驗證機制文件的相對連結 | 全部存在 |

Windows Python 工具以 `PYTHONIOENCODING=utf-8` 執行；第一次守衛因終端預設 cp950 無法輸出勾號失敗，設定 UTF-8 後通過。

### 瀏覽器實測

使用本機 `tools/serve_web.py --port 8766` 啟動，在實際瀏覽器開啟首頁、展開「還原備份」，透過檔案選擇器選取合成損壞備份。
畫面顯示 **「還原未完成：案件索引無效」**，留在原頁，檔案欄位被清空，可重新選檔。
前端回歸測試另外驗證拒絕後既有 localStorage 完整保留。

新增 `tools/browser/verify.mjs` 案例會比較拒絕前後的 workflow 與 IndexedDB 三個 object store，並接續既有有效備份還原測試。
**完整 Playwright harness 本次未執行**；新增案例只做語法檢查，其實際錯誤顯示路徑由上述瀏覽器操作驗證。

### 驗證限制

- 本機瀏覽器的 Pyodide CDN 載入逾時，未驗證即時計算成功路徑；頁面正確顯示計算不可用與後續重算選項。
- 本機 Python 3.14 沒有 pytest 等專案依賴，未執行 Python 全量測試。本次未修改 Python 或計算公式。
- 沒有改變正式站。上述通過項目不等於完整 CI 或正式環境驗收。

## 接續方向

舊工程表中的分案草稿、80 戶提示、四步 runtime 來源顯示，在本次基準程式中已存在。
後續應以最新程式逐項核對待辦；較大的剩餘項目是 Workspace 面板歸位。
使用者帳號、RBAC、多人協作仍屬 P3 架構範圍；本次僅說明現況，未自行新增登入系統。
