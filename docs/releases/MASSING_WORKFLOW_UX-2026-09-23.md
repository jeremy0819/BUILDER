# 量體與四步操作改善交付報告

日期：2026-09-23。基準：`origin/main` 的 `8094ae8`。
分支：`codex/massing-workflow-ux`。本文件記錄本機開發與驗證，不代表已推送、合併或部署。

## 主管摘要

本輪收斂①基地與②產品的主要工作，不新增獨立頁面或另一套計算。
原本量體依自身最大面積縮放，調整後不容易辨認差異；現在把案件快照和本次草案放在同一比例尺上比較。
草案可即時調整，但採用前不改案件。採用後保持案件 ID，沿四步動線前進。

| 範圍 | 交付 |
|---|---|
| ①量體 | 同尺度前後比較、輸入即時更新圖面、Core 去抖重算、選層／鍵盤操作 |
| ①資訊密度 | 地政、清冊、歷程、既存明細收合；逐層微調預設收合，選圖才展開 |
| ②產品 | 預設即為真 Core 財務調整，保留單價／營造／公設比／車位控制；移除重複 KPI |
| 交棒 | 明確「採用並前往下一步」；不採用也可沿用案件快照前進 |
| 手機 | ③盤面六欄、無橫向溢出；備份控制項補足觸控高度；警語不因導覽收合消失 |
| 來源 | ①②④顯示當頁實際 runtime 來源；③僅讀快照，明標快照模式 |

## 工程變更

1. `site-massing.js` 與 `site-massing.css`：輸入面積比例圖，不是假造建築平面或法規核准量體。所有容量、坪數、財務結果逐欄讀 Core。
2. `planning-session.js`：①②共用草案狀態。輸入變動立即失效舊結果；過期非同步回應不得恢復結果；停止自動重算會取消待執行排程。
3. `product-planning.js`：完整 engine 傳 Core，保留既有財務覆寫路徑；單價允許小數。沒有 engine 時保留建案／匯入出口。
4. 明確採用才呼叫 `CaseBus.applyResult/replace`。採用前比對 pid、完整 engine、input_hash 與 core_version；同案的新 workflow 事實保留，跨頁輸入衝突拒絕覆蓋。
5. 舊示範紀錄未帶頂層 pid 時，使用既存 `wf.project.project_id`，不創造新案件 ID。
6. 新快照逐戶分配只讀本次 `owner_allocations`。沒有回傳就留空；跨輸入／版本的舊現金流失效，不冒充新結果。Workflow 更新作用中快照，不誤改第一筆歷史快照。
7. Gate 21 納入規劃狀態回歸；Gate 19 加入①→②→③的真 Pyodide 採用流程與錯誤路徑。

## 安全與邊界

- 未修改 `core/`、任何凍結 schema、費率、黃金範例、Core bundle、版本號、`pages.yml`。
- 無新增後端、帳號、遠端案件傳輸、第三方圖磚或 runtime 依賴。
- 圖面不可拖曳改值；比例算術僅為圖形幾何，不是容積或財務公式。
- Core 不可用或溯源缺失時禁止採用；欄位顯示「—」，不補零。儲存失敗與 Core 原始例外不直接呈現。
- 草案尚未採用時離頁會警告；本輪草案是記憶體狀態，並非持久化自動儲存。採用後資料仍只在本機，仍需備份。
- 本輪沒有引進真實地籍或地主資料。瀏覽器證據只使用合成案例，放在 gitignored artifacts。

## 驗證

驗收命令：

```powershell
python -m pytest -q
Get-ChildItem tests/web/test_*.mjs | ForEach-Object { node $_.FullName }
node tools/browser/verify.mjs
python tools/check_schema_freeze.py
python tools/check_core_bundle.py
python tools/check_web_version.py
python tools/check_ci_gates.py
python tools/check_web_links.py
python tools/check_chart_contracts.py
python tools/check_image_whitelist.py
python tools/build_calibration_notice.py --check
```

Gate 0 在僅包含受版控檔與待納入檔的乾淨暫存樹執行，排除 runtime／瀏覽器下載物。
瀏覽器主驗證封鎖 CDN，走本機 Pyodide；另測本機 loader 404 時才回退固定版本 CDN。
尺寸：桌機 1440×1000、手機 390×844。PNG 位於 `tools/browser/artifacts/`。

2026-09-23 最終本機驗證結果：

| 驗證 | 結果 |
|---|---|
| Python | 260 passed |
| Web headless | 686 passed，含新增 34 項規劃狀態回歸 |
| 真瀏覽器／Pyodide | 82 passed，含完整採用動線、失敗路徑、手機版與儲存型 XSS |
| Schema freeze | 20 個既有 schema 全數通過，未改 schema |
| 其他守衛 | Core bundle、版本、CI 編號、161 個連結、圖表契約、圖片、Core 隔離與校準資料通過 |
| Gate 0／差異檢查 | 結構式與列舉式個資守衛零命中，守衛自測通過；`git diff --check` 通過 |

以上為本機結果，不代表遠端 CI 已執行。
預覽網址：`http://127.0.0.1:8766/dashboard.html`。本輪未推送、未合併、未部署。

## 設計同步

`docs/design/UI_UX_PLAN-2026-09.md` §8 與 `docs/design/Main.dc.html` 同步新增本輪規格。
未改線上畫布服務，也未把大型編輯器產出檔納入版控。
本機附件 PDF 路徑不存在，本輪依 PM 已推送的 Markdown／畫布原始檔工作，未聲稱核對不可讀的 PDF。

## 下一階段

1. Workspace 共用面板抽取：同意／任務移入③、決策紀錄／時間軸移入④；不得 iframe 或複製資料寫入邏輯。此輪只是收斂①②，沒有宣稱完成面板搬移。
2. 設計持久化規劃草案的版本契約與恢復流程，再做自動儲存；目前不把本機記憶體草案稱為已保存。
3. GIS 本機匯入先定 PII 隔離與檔案限制，再上圖層。缺乏地籍幾何、樓高與建築法規輸入時，不把示意圖升格為真實建築量體。
4. Pages 同源 runtime 部署仍等明確授權；企業登入、RBAC、加密與協作另案設計。
