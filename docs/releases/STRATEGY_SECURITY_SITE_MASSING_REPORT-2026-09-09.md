# 策略分析、資安與基地量體模擬交付報告

日期：2026-09-09
分支：codex/strategy-security-workspace
基底：codex/unified-ui-decision-land-data，包含先前四步介面整合。
狀態：本機實作與驗收完成；未合併 main、未建立 release tag、未部署遠端站台。

## 主管摘要

本輪將第四步升級為可操作的策略分析工作區，並把逐層量體生成與容積模擬加入第一步。
定位仍是具溯源的決策輔助，不是經校準的投資預測、建築許可判定或企業級案件資料庫。

完成的工作：

- 四步共用案件列、主題與尺寸規則；修復手機版整頁橫向溢出。
- 策略分析以完整 engine 呼叫既有 Core，依序取得財務、Decision 與 Strategy。
- 地主觀察提供四型及未知狀態、可簽性、產權原因、關鍵戶與行為訊號。
- 財務假設保留空白為不足，不代填樂觀數值。
- 分開呈現地主溝通、產權清理、風險、推薦理由與禁止採取的動作。
- 第一頁新增量體草案生成、選層、逐層輸入、Core 容積比較與警告。
- 修補跨頁文字注入、CSV 公式注入、輸入容量與物件鍵、Worker 失敗處理。
- 首次完成本輪真正的 Chromium / Pyodide 操作驗證，不僅是原始碼掃描。

本輪不修改任何 Core 公式、Core 版本、凍結 schema、黃金範例或 release 版本。
本次策略和量體重算均不寫回案件快照；原案件與正式分析的界線有可見標示。

## 第一步：量體生成

入口：dashboard.html 的「量體生成與容積模擬」。

1. 選取既有案件，即載入原案 floors[]。
2. 輸入地上層數與標準樓板面積，生成規則草案。
3. 生成沿用 CaseBus 既有輸入模板，含一層地下室；不是額外發明一套免計公式。
4. 點選樓層圖，修改樓板、計容積、梯廳、安全梯、陽台的原始輸入。
5. 按 Core 重算，比較案件快照與本次草案的允建、計入、剩餘容積和銷售坪數。
6. 任何修改立即使前次結果失效；「還原案件」回到原始輸入。

重要契約：

- 圖為樓板面積比例的逐層量體示意，不是真實基地形狀、三維建築或法規核准圖。
- 生成新量體時，只在暫存 engine 移除 params.面積表計入容積。
  否則 Core 會依原面積表彙總值計算，造成樓層改變但計入容積不變。
- 未生成前保留原案面積表設定，逐層 0 不得詮釋成該層免計。
- 既有階段的法規、都市設計、建蔽、退縮、日照、消防與高度合法性，不由示意圖保證。
- 可調整的是 Input，量體圖與 Core Output 不提供拖曳反算。
- 草案尚不提供跨頁套用／持久化方案，避免未經驗收就覆蓋正式案件。

## 第四步：策略分析

Worker 管線：

完整 engine + workflow 快照 + 財務假設 + 地主觀察
→ Core recompute
→ Core input_hash
→ Core decide
→ Core strategize
→ 暫態呈現／使用者主動匯出

策略頁新增：

- anchored 錨定型，補齊現行 profile v0.2 值域。
- 沒有分型的戶別交由 Core 判讀為訊號推測，不擅自分類。
- 產權待清理必須有明確原因，不由 UI 猜測原因。
- 地主觀察與財務假設先存 localStorage，不以 Core 就緒為前提。
- 來源指紋與 request token 雙重檢查，舊回應不能蓋過新輸入／不同案件。
- 三方 EV、資料不足欄位、Core 模型假設、策略溯源與建議依據。
- 手動 JSON 匯出；不自動將計算輸出寫入 CaseStore 或 Workflow。

本輪發現瀏覽器 Worker 原先沒有載入 jsonschema，但 Decision / Strategy 會呼叫該驗證器。
已透過固定 Pyodide 0.26.4 套件來源載入 Core 既有依賴，沒有繞過 schema 驗證，也沒有自製替代驗證器。

同意計數目前仍讀取已存案件快照。它不是最新同意事件的法律判定，
更不是土地面積／建物面積／人數等法定門檻的完整檢核。頁面已明示此限制。

## 資安修補

| 範圍 | 本輪處理 |
| --- | --- |
| 策略頁 | 外部本機脚本、禁止 inline script 的 CSP、no-referrer |
| 動態文字 | 案件名稱、地主代號、清冊、任務、決策、期限等採 textContent 或 HTML escape |
| 工作區動作 | 移除案件 id 插入 inline onclick 的路徑，改成 data attributes 和事件處理 |
| JSON | 5 MB、64 層、200,000 節點上限；拒絕非有限數值與危險物件鍵 |
| CSV | 對可能被 Excel 當公式的起始字元加以中和，再作 CSV quoting |
| 圖片 | 已存附件只接受 raster data URL，不直接載入任意遠端圖片／SVG URL |
| Worker | 初始化／請求逾時、失敗、終止均結清 pending promises，失效後 ready=false |
| 隱私 | 移除產品頁自動外部字型載入；官方地政入口不夾帶案件查詢參數 |
| 本機損壞資料 | CaseBus 不把無法解析的舊資料當空庫後覆寫；原始內容保留 |

依據：[OWASP DOM XSS](https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html)、
[OWASP XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)、
[OWASP HTML5 Security](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html)。

## 驗收證據

| 驗證 | 結果 |
| --- | --- |
| Python pytest | 253 passed |
| 既有 web headless | 490 passed |
| 新增策略／資安／量體 headless | 47 passed |
| 真實 Chromium + Pyodide | 25 項通過 |
| Schema freeze | 20 檔全部相符 |
| Core bundle | 同步，未修改 Core |
| 靜態連結 | 112 條可達 |
| 隔離／範本／圖檔／版本／Chart Contract | 全通過 |
| Gate 0 | 送版來源快照零命中；守衛自測真陽性 7／假陽性 9 通過 |

Gate 0 在 git tracked + untracked non-ignored 的完整來源快照執行，
排除的只有已被 .gitignore 排除之瀏覽器安裝檔、node_modules、測試輸出等本機產物。
不修改 Gate 0 規則，不以增加例外方式放過新內容。

25 項瀏覽器驗證包括：

- 真實 Worker 載入、Core 策略生成、匯出及觀察持久化。
- 原生 Python 與瀏覽器 input_hash 相符。
- 分析不寫回 CaseStore；輸入修改與在途回應競態不能恢复舊結果。
- 第一步生成規則量體，逐層調整確實改變 Core 計入容積。
- 桌機 1440 px／手機 390 px，不發生整頁橫向溢出。
- 案件名稱、任務與決策文字的 stored-XSS payload 保持惰性文字。
- 模擬 Worker 無法啟動，仍可儲存觀察且不能偽造分析結果。
- 所有實測外部請求為固定 Pyodide CDN 的 GET，沒有案件 request body。
  此為本測試路徑的觀察結果，不是對所有未測功能的全面保證。

截圖與合成匯出檔位於 tools/browser/artifacts/，已 gitignore，不進版控。
CI 新增 Gate 19，使用 Playwright 1.58.2 與 lockfile；僅測試依賴，不加入前端框架。

## 工程師重跑

    python -m pytest -q
    node tests/web/test_strategy_security.mjs
    npm ci --prefix tools/browser --ignore-scripts --no-fund
    node tools/browser/node_modules/playwright/cli.js install chromium
    node tools/browser/verify.mjs

本機若將瀏覽器裝於 tools/browser/.browsers，須設定 PLAYWRIGHT_BROWSERS_PATH 為該絕對路徑。
CI 使用預設 Playwright 路徑。瀏覽器測試自行啟動 loopback server 並於結束時關閉。
瀏覽器測試需要可連線 Pyodide CDN；斷線是可見失敗，不以 mock 代替真實 Core 成功。

## 不能宣稱已完成的事項

1. localStorage / IndexedDB 未加密。共用電腦、惡意擴充套件、同源脚本仍是風險。
2. 沒有企業身分驗證、RBAC、伺服器審計、不容竄改日誌或加密備份。
3. 首次載入仍依賴 Pyodide CDN，離線首次啟動尚未完成；固定版本不等於完整供應鏈隔離。
4. CSP 嚴格脚本政策本輪僅落在 report.html；其他歷史 inline-script 頁面仍需逐步外移。
5. 未對整個儲存庫歷史進行敏感資料清除；重寫 git 歷史需要獨立審查與協作安排。
6. 沒有宣稱完成獨立滲透測試、全站無弱點、或真實案件的法律／投資適用性驗證。
7. 量體是逐層二維示意，未冒充建築設計、GIS 或三維法規檢討。

## 建議後續順序

P0：企業上線前，完成資料分級、權限、備份、部署安全標頭與獨立安全審查。
P1：Consent 事件到 Core 決策的版本化契約，區分接觸／口頭意願／正式簽署與法定面積門檻。
P1：量體草案接回既有 Scenario + 作準機制，保存完整 engine、來源二元組及顯式套用紀錄。
P2：幾何輸入 schema 後，再做離線 Three.js 三維量體、退縮／高度資料與本機地政匯入。
P2：以去識別案例校準策略與存活率；保留樣本量、適用範圍及不確定性，不只優化圖形。

