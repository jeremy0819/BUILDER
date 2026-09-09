# B3 Browser Runtime Completion

日期：2026-09-09。接續第一批策略／資安／量體成果；第一批已由 PR #25 合併。
本文件記錄技術驗收；正式部署狀態以 GitHub Actions 的目標 commit 為準。

## 主管摘要

- B1：已 rebase main；Gate 18 為 CaseBus、Gate 19 為瀏覽器、Gate 20 為統一介面。
- B2：第一批已先推送，沒有等待 B3；其 CI 及 PR #25 的 Pages 部署已成功。
- B3：補上獨立決策與選配映射呼叫、完整 bundle 契約測試及真正 Pyodide 驗證。
- 不改 Core 公式、凍結 schema、黃金案例或版本號，不跳過驗證器。

## 工程契約

| Runtime API | 輸入 | Worker 呼叫 | 回傳欄位 |
| --- | --- | --- | --- |
| decide(engine, workflow, inputs) | 完整 engine、工作流程、建模假設 | recompute → input_hash → Core decide | result、input_hash、decision |
| allocate(engine, product, beforeMap) | 完整 engine、產品組合、更新前事實 | recompute → input_hash → Core calc_選配映射 | result、input_hash、household_outcome |
| analyze(engine, workflow, inputs, profiles) | 完整 engine 與逐戶觀察 | recompute → decide → strategize | result、input_hash、decision、strategy |

Core 的選配函式名稱是 calc_選配映射；allocate 是瀏覽器 transport API，
不是新增另一套權利變換或坪數公式。兩個新 API 均先從完整 engine 重算，
不接受 UI 自行拼成的 result 作為權威來源，回傳與逐戶結果攜帶相同 input_hash。

原第四步 analyze 已能即時產生決策，不限於匯入資料；本輪再提供獨立 decide 介面。

## jsonschema 啟動條件

Decision、Strategy、Allocation 都會驗證凍結 schema，失敗即拒絕產出。
Worker 透過固定版本 Pyodide 的 loadPackage 載入 jsonschema，並在 ready 前實際 import。
即使下載失敗只被套件載入器記成訊息，import 仍會失敗，不能錯誤宣告 ready。
檔頭已移除「完整計算主線純 stdlib」的過期描述，改為如實列明驗證器依賴。

## 測試修正

tests/test_core_bundle.py 分成兩種環境，不再混稱：

1. 正常依賴：不提供 pandas，但提供 jsonschema／referencing；
   還原 bundle 後，recompute、decide、strategize、選配映射與原生 Core 逐欄一致。
2. 故障依賴：封鎖驗證器，斷言三種需驗證的功能皆明確拒絕。

真正的 WASM／套件下載由 tools/browser/verify.mjs 驗證，Python 子行程不冒充 Pyodide。
新增瀏覽器測試包含：獨立三條管線與原生 Core 相同、48 戶選配結果與雜湊、
非法單元 ID 被 schema 拒絕，以及 jsonschema 下載被封鎖時不能進入 ready。

## 驗收

- Python：257 passed，其中 bundle 測試 7 項。
- Web headless：539 passed，其中策略／資安／量體 49 項。
- 真正 Chromium + Pyodide：32 項通過。
- Core / schema / bundle 未修改，維持既有 20 檔凍結與 Gate 10 版本治理。
- 保留先前的 stale-response、離線輸入保存、stored-XSS、外部請求與手機版測試。

部署使用既有 Pages workflow，不新增發布來源、不改 tag、不繞過 branch protection。
企業權限、加密、完整離線 runtime 與歷史資料清理仍不在本次已完成範圍。
