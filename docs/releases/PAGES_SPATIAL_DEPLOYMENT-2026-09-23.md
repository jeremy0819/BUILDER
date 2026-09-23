# Pages 部署紀錄與驗收

2026-09-23 使用者明確授權本機提交、推送、合併與部署。
本輪在既有已驗證成果上補齊 GitHub Pages 發布組裝，不宣稱正式 0.7.0 release tag。

## 發布範圍

- 正式四步：基地／產品的量體與規劃 UX 改善。
- 獨立 `spatial-prototype.html`：合成基地與單棟量體，只讀探索；不加入四步導覽。
- 保留既有 `index.html` 首頁，不以原型取代目前產品。
- 發布 source commit 寫入 `build-info.json`，供部署後核對。
- 不發布文件、測試、真實地籍、local_calibration、瀏覽器或診斷輸出。
- 不新增 production Pyodide 本機資源部署；這項仍另行處理。

## 部署組裝

`tools/build_pages.py` 將 `apps/web/` 與明確列舉的原型檔案複製到全新的暫存產物。
Three.js 固定版本通過套件及逐檔 hash 後才納入，套件依然不進 Git；正式頁面不下載它。
公開原型與正式網站同源，僅為功能／路徑隔離，不宣稱獨立網域安全沙箱。
公開原型不顯示本機 Core 診斷控制項，正式四步仍使用既有 Core 載入路徑。

## 驗收

- 新增 Pages 組裝與覆寫保護、import-map CSP 一致性測試。
- 真瀏覽器以 `/BUILDER/` 子路徑驗證，不只測網站根路徑。
- 桌機與手機畫布像素、物件選取、CSP、同源資源、無橫向溢出、正式頁面不下載 Three.js。
- 等待第一幀與首次尺寸計算完成後檢查實際像素；超時仍失敗，不以重跑或跳過代替非空檢查。
- 合併前等待 GitHub CI；部署後核對 build-info commit 並重跑公開網址驗證。

完成後的遠端 PR、CI 與 deployment 連結以交付訊息為準，這份 commit 不預先宣稱部署成功。
