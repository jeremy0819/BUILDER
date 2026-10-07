# BUILDER 工作站收尾與交接報告

日期：2026-10-07。範圍：工程師 A 的 PR #42 接續 PM／工程師 B 已合併的 main 更新。

## 主管摘要

- 昨天已上 main 的交付是 PR #43：M9.0／M9.1 候選證據基礎與模型狀態揭露，不是完整校準模型。
- 本次把 main `11d6ddb` 整合進 `codex/executive-history-dashboard`，保留主管 Dashboard、首頁圖示與三段數字建案引導。
- 修正候選證據儲存失敗的原始錯誤文字：空間不足／儲存被禁用時顯示可重試訊息，輸入及原案件保留。
- 本機驗收：304 pytest、25 組 web headless、6 組真瀏覽器共 334 項檢查通過；24 份凍結契約相符。
- 只更新 [PR #42](https://github.com/jeremy0819/BUILDER/pull/42)。依使用者裁決，不合併、不部署、不打 release tag。

## 昨天的交付盤點

| 項目 | 已核對狀態 | 邊界 |
|---|---|---|
| [PR #43](https://github.com/jeremy0819/BUILDER/pull/43) | 2026-10-06 已合併，main `11d6ddb` | M9 evidence foundation / honest model status |
| M9.1 候選證據 | observed／assumed 人工紀錄，附來源、日期、信心註記 | 一律 `unverified`，不宣稱外部查證 |
| Evidence 契約 | `evidence-fact-0.1`，單案最多 200 筆、列表顯示最新 20 筆 | 不修改 Project Schema，追加路徑不等於不可竄改儲存 |
| 案件總覽 | 校準狀態可見，證據與詳細資料預設收合 | 戶數不是法定面積門檻；來源文字不是核驗證明 |
| M9 路線 | Evidence → Legal/Route → Agreement → Prediction/Outcome → Calibration | M9.2 之後尚未交付，沒有正式 M9 tag |
| [PR #41](https://github.com/jeremy0819/BUILDER/pull/41) | OPEN，獨立 Site Geometry 提案 | 未混入本次整合，不代表真實幾何已可用 |
| [PR #42](https://github.com/jeremy0819/BUILDER/pull/42) | 本機功能已完成，待使用者審核 | 未合併即未正式部署 |

查證來源：遠端 commit／PR 狀態、M9 計畫、實作與測試；PM 對話僅作脈絡。
對話提及的地方規則未在本次重新法律查證，因此沒有導入新的法規門檻。

## 本次收尾

1. 將 main 同步至現有 PR 分支，沒有把 PR 合入 main，也沒有重寫分支歷史。
2. 解決 CHANGELOG、版本政策、Schema 凍結表的三處衝突；Dashboard 與 Evidence 兩份契約同時保留。
3. 凍結數由兩個分支各自的 23 份整合為 24 份，既有 hash 不變，三處清單一致。
4. 重建並驗證 Core bundle，產物仍與同一份 Core 原始碼同步；Evidence 契約不混入 Core 執行期。
5. 證據面板不再將未知瀏覽器例外直接展示；儲存失敗仍可重試，沒有清空表單或先報成功。
6. 新增證據配額失敗、重試、跨頁衝突、跨案隔離、重新載入與 Dashboard 資料邊界回歸。
7. 補測基地草案採用保留最新 M9 紀錄，但不把紀錄加入 engine 或提升核驗狀態。
8. 主管 Dashboard 測試固定查詢迄日，避免「近三個月」斷言依電腦日期自然過期；原期望值未放寬。
9. 更新 CLAUDE 現況索引：20 → 24 份契約、27 個 CI steps／26 個 Gate 編號、M9 及待審核入口；原檔依協議備份。

## 驗證結果

| 驗證 | 實測結果 |
|---|---|
| Python 全套 | 304 passed |
| Web headless | 25 組腳本全部成功；其中 Planning Session 37、Dashboard 16 |
| 四步／Core／資安／備份／完整沙盤 | 133 passed |
| Pages 專案前綴及降級路徑 | 65 passed |
| 主管歷史 Dashboard | 36 passed |
| 首頁與數字建案引導 | 53 passed |
| 方案比較／採用 | 9 passed |
| 隔離空間原型 | 38 passed |
| Schema freeze | 24 檔全部相符 |
| Core bundle／版本／連結／影像／Core 隔離／Gate 編號／圖表契約／範本 | 全部成功 |
| 校準告示生成一致性 | 成功 |
| Gate 0 隱私守衛及守衛自測 | 成功 |

真瀏覽器使用隔離的合成資料 context，不讀取或改動使用者目前瀏覽器案件。
配額失敗回歸先重現失敗，再修正通過；不是只有靜態接線檢查。
六組共 334 個通過檢查包含不同流程的重複邊界，不能解讀成 334 種獨立產品能力。
正式站部署未執行；GitHub CI 狀態以 PR 的最新 commit checks 為準，不用舊 run 代替本輪驗證。

## 不變條件

- `CORE_VERSION=0.6.0`、最新正式 tag `os-v0.6.0`；未改財務公式、費率、Golden 期望值或既有凍結契約。
- UI 仍只組裝輸入與呈現 Core 結果；沒有第二計算來源，未知數值不補零、不反算量體。
- 合成 3D 與未定位地塊草圖仍不是本案基地配置或真實建築高度。
- 證據仍未核驗；不修改 Data Status、法定可行性、Decision 判定或模型校準狀態。
- Dashboard 唯讀，候選證據不被當成財務量測；查詢不改作用中案件，只有明確進入 Workspace 才切案。
- 無新增真實公司資料、附件、底圖、模型套件或截圖進版控；測試產物留在 ignored artifacts。
- 不掃描其他磁碟，不改部署保護、Pages workflow 或 runtime 部署設定。

## 接手位置

| 用途 | 入口／檔案 |
|---|---|
| 建案／繼續工作 | `apps/web/index.html`；首頁圖示與建案引導已保留 |
| 主管查詢 | `apps/web/executive-dashboard.html`；Core 查詢投影 `core/redcf/dashboard.py` |
| 每日下一步／候選證據 | `apps/web/overview.html`、`overview.js`、`evidence-ledger.js` |
| 基地與量體輸入 | `apps/web/dashboard.html`；不是主管 Dashboard |
| 會議摘要 | `apps/web/meeting.html` |
| M9 後續規格 | `docs/architecture/M9_EVIDENCE_CALIBRATION_PLAN.md` |
| 既有 A 交付報告 | `EXECUTIVE_DASHBOARD-2026-10-05.md`、`HOME_ONBOARDING-2026-10-05.md` |

本機可用預覽：`http://127.0.0.1:8768/`，由 repo 的 loopback-only `tools/serve_web.py` 提供。
停止／重開預覽不刪案件；案件仍在各瀏覽器 origin 的 localStorage／IndexedDB，切換 port 不會自動搬移資料。
需要遷移案件時使用案件備份功能；不要直接清除瀏覽器資料。

```powershell
python tools/serve_web.py --port 8768
python -m pytest -q
python tools/check_schema_freeze.py
python tools/check_core_bundle.py
python tools/check_web_version.py
node tools/browser/verify.mjs
node tools/browser/verify_pages.mjs
node tools/browser/verify_dashboard.mjs
node tools/browser/verify_home.mjs
```

瀏覽器驗證先按 `docs/DEVELOPING.md` 準備固定版本 Playwright、Pyodide 與空間依賴；不要把 runtime 資產加入版控。

## 尚待裁決／下一站

1. 使用者審核 PR #42；只有獲准合併後，才依原 Pages 流程部署。
2. PR #41 正式幾何提案需獨立審核來源契約與未核驗草圖轉輸入規則，不能由展示畫面倒推事實。
3. M9.2 開工前查證中央與地方法規，定義 route state、資料缺口與拒答契約；不以戶數比例代替法定同意門檻。
4. Prediction／Outcome Ledger 有可追溯資料與足夠驗證後再校準；目前不產出精確成功機率或精確預期損失。
5. same-origin Pyodide 的正式部署仍待先前的使用者裁決，不在本輪偷偷修改設定。
