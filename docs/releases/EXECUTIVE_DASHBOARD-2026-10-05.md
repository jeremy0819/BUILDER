# 主管 Dashboard 交付與審核報告

日期：2026-10-05。分支：`codex/executive-history-dashboard`。
狀態：程式與本機驗證完成，送 PR 審核；未合併、未部署、未打 release tag。

## 主管摘要

Dashboard 專門回答「現在如何、過去如何、哪裡變了」，不再承擔輸入與建模。
新入口 `apps/web/executive-dashboard.html`；首頁、四步共用列、案件總覽與 Meeting Brief 都可進入。
既有 `dashboard.html` 保留為①基地與量體 Workspace，不搬檔、不破壞舊連結。
Meeting Brief 沿用既有 `meeting.html`，不複製另一套會議資料。

| 用途 | 畫面 | 可以做什麼 |
| --- | --- | --- |
| 看 | 主管 Dashboard | 查詢、歷史、比較、來源與事件 |
| 做 | 四步 Workspace | 基地、量體、產品、地主、任務與決策 |
| 帶出去 | Meeting Brief | 現況、會議基準後的變更、卡點與待決事項 |

預設桌機 1440 × 900 及筆電 1280 × 800 一頁可見；手機 390 × 844 改為單欄，沒有橫向溢位。
查詢不切換 Workspace 的作用中案件；只有使用者明確點來源／Workspace／Meeting 才交接選定案件。

## 可交付功能

- 案件、3 月／6 月／1 年／全部／自訂日期、七項指標查詢。
- 六項摘要：總銷、共同負擔、地主分回價值、全案投報率、最新同意戶數、資金缺口狀態。
- X 軸只用已登錄時間，間距依實際時間，不以點的序號等距排列。
- 已採用案件序列與方案建立歷史分開，未採用方案不冒充案件現況。
- 財務差額在 Core 查詢投影產生；比例差顯示 pp，沒有前端財務公式。
- 成本科目上一筆／本筆比較，金額可點選來源；不自行拆分總額。
- 點時間點可查看指紋、記錄版本、重播版本及同日 Activity；時間相近不宣稱因果。
- 缺完整輸入的快照保留缺口、斷線及可收合缺漏清單，不插值、不補零。
- 時間軸範圍包含有日期但無數值的快照；相近時間點可由收合的歷史明細選取，不必精準點到重疊圓點。
- Core 載入失敗仍可查閱已存快照，清楚標示期間／歷史比較未執行，可重試。
- 顯示 Worker ready 回報的實際同源／CDN 備援來源，不把備援載入冒充本機資源。
- 日期、案件、方案、事件全部留在本機；主管頁沒有 3D、數字編輯或任何案件寫入 API。

## 工程契約

新增 `core/redcf/dashboard.py`，`DASHBOARD_VERSION = 0.1.0`。
`query_dashboard()` 只呼叫既有 `recompute()`／同一分析鏈；沒有修改容積、財務、費率或法規公式。
Worker 與 `runtime.dashboard()` 傳完整已保存 engine；不把計算移到 UI。

新增 `schemas/dashboard_query.schema.v0.1.json`，`schema_version = dashboard-0.1`。
凍結 hash：`a7aef32bb2b447d8827c80abebf3fdfa63870f550c1cbc09b1db679e89b74071`。
凍結表、版本政策的事實紀錄、發布清單三處一致；既有 22 檔基準不變，現在 23 檔。
`CORE_VERSION` 仍為 0.6.0；此為獨立唯讀查詢投影，不變更既有 Result 契約。
圖表契約明定時間軸、台北時區、禁止插值、禁止編輯／拖曳，以及五項 `must_not_read_as`。
現行 Core 重播結果不得冒充當時舊版本的原始結果；不同版本結果不直接混算。

### 歷史來源與比較定義

1. 舊快照只有指紋時，以同指紋已存方案尋找完整輸入；找不到即缺漏。
2. 採用方案以 Activity 的採用時間作 X 軸，不用方案建立時間代替。
3. 方案歷史單獨以建立時間查詢，標示未必採用。
4. 目前案件以既有 `snap.computed_at` 與 `engine` 重播；不以今天改寫歷史日期。
5. 較上一筆＝選定期間內前一筆已登錄時間點，不是上月平均，也不跳過缺漏強行比較。
6. 每次期間最多 256 筆，先篩日期再限制；無持久化查詢快取、無新增資料庫或套件。

## 明確限制與下一站

- 不少舊快照沒有完整輸入，因此無法保證完整財務歷史；此次沒有製造或補寫歷史。
- 目前同意 KPI 是最新現場事實，非所選歷史日期的同意數；同意歷史圖暫顯示資料不足。
- `owner_return_value` 是地主分回價值，不是建商利潤；`shared_cost` 是共同負擔，不是任意公司全案成本。
- 八期成本出資及峰值不是淨資金缺口；資金缺口保留「—」，不從成本圖推導。
- 下一站應先設計 append-only 的完整 input／Core result 歷史保存契約，再接企業淨現金流、融資與利潤口徑。
- 圖表目前只查本瀏覽器已存案件，不連接公司文件、不爬取或上傳案件資料。

第一性原理關卡：支援 L2 執行監測與 L3 續投審視；幫主管定位變化及證據，
不是新增 Calculator；唯一財務來源仍為 Core，Dashboard 不推論或決定案件。

## 驗證

- `python -m pytest -q`：294 passed，新增 Dashboard 17 測。
- `tests/web/test_*.mjs`：23 個腳本全部通過；新增來源與唯讀邊界 15 項斷言。
- `node tools/browser/verify_dashboard.mjs`：35 passed，真 Pyodide、桌機／筆電／手機、離線、鍵盤、存入型 XSS、查詢零寫入。
- `node tools/browser/verify.mjs`：128 passed，既有四步到沙盤結算再返回決策；實際同意紀錄不變，固定 CDN 備援也通過。
- `node tools/browser/verify_scenario_compare.mjs`：9 passed；方案比較與採用連動無退步。
- `node tools/browser/verify_pages.mjs`：51 passed，含組裝後 `/BUILDER/` 路徑的主管頁與手機介面；這是本機部署產物驗證，不是正式部署。
- schema freeze、Core bundle、web version、links、image whitelist、Core isolation、CI gate identities、chart contracts、結構式 PII 守衛均通過。
- 合成截圖存於 gitignored `tools/browser/artifacts/executive-desktop.png`／`executive-mobile.png`，不將圖像或公司資料放入版控。

CI 沿用 Gate 21 加入 headless、Gate 19 加入主管頁瀏覽器旅程，不重編 Gate、不修改 Pages 部署設定。
正式站仍由使用者審核 PR 後決定合併及部署。
