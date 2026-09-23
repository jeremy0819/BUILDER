# Visualization Foundation 0.7.0 工作報告

日期：2026-09-23。基準：本機 `edf920c`。
狀態：本輪稽核、提案與隔離原型完成；非 os-v0.7.0 正式發布，未推送／合併／部署。

## 主管摘要

完成「先確認資料能說什麼，再驗證 3D 呈現」的第一步。
原有四步頁面與量體／產品 UX 不變；新增的是獨立本機測試頁，不增加第五套正式工作流。

你的人工輸入地籍／描繪基地構想已納入接入提案，但本輪不假裝它已成為正式幾何來源。
人工描地只能提供候選基地輪廓，不能一併得出建築 footprint 與實際 height。
外部搜尋只能補附來源的候選證據，需要確認授權、有效日期、適用範圍與人工採用；不得自動覆寫。

## 交付

| 交付 | 位置 |
|---|---|
| Schema Audit、Visualization／Geometry／Selection Provenance Proposal、版本路線 | `docs/architecture/VISUALIZATION_FOUNDATION_0_7.md` |
| 固定版本、授權、CSP、離線、效能與正式導入邊界 | `docs/architecture/ADR_THREEJS_VISUALIZATION.md` |
| Synthetic-only 3D 頁面、fixture、操作說明 | `tools/spatial-prototype/` |
| 最小依賴準備／離線完整性檢查 | `tools/prepare_spatial_prototype.py` |
| 獨立 loopback server | `tools/serve_spatial_prototype.py` |
| Python、headless、真瀏覽器回歸 | `tests/test_spatial_prototype.py`、`tests/web/test_spatial_prototype.mjs`、`tools/browser/verify_spatial.mjs` |

## 已驗證的互動

立體／俯視、旋轉、縮放、平移、重置、hover／物件選取；手機一指旋轉、雙指平移與縮放。
有 geometry_hash、來源版本、單位及 local-demo 座標標記；沒有冒造案件 input_hash。
Three.js 與真正本機 Pyodide 共存；缺 WebGL、context loss、缺本機依賴均有可見 fallback。
Core 共存測試與展示幾何是兩份分離合成 fixture，沒有宣稱已完成 Core → geometry 管線。

## 驗證結果

| 範圍 | 實測 |
|---|---|
| Python 全套 | 268 passed，含本輪 8 項 installer／路徑邊界測試 |
| Web headless 全套 | 708 passed，含本輪 22 項原型邊界測試 |
| 原有真瀏覽器 | 82 passed |
| 新原型真瀏覽器 | 29 passed |
| 凍結 Schema | 20 個基準全數相符 |
| Gate 0／差異檢查 | 個資守衛零命中，守衛自測與 `git diff --check` 通過 |
| 其他 | Core bundle、版本、CI Gate 身分、圖表、161 個連結、影像、Core 隔離、校準資料守衛通過 |

瀏覽器測試含桌機 1440×1000、手機 390×844、WebGL 像素非空、畫面無橫向溢出、觸控目標與零外部請求。
測試渲染預算：draw calls <= 12、triangles < 2,000、device pixel ratio <= 1.5；閒置停止渲染。
手機為 Chromium 觸控模擬，不宣稱已完成 iOS／Android 實機 GPU 與 FPS 驗收。
上述是本機驗證，不代表遠端 CI 已執行，也未宣稱經獨立 reviewer 簽核。

## 資料量與資安

- Three.js 固定 0.180.0，四檔合計 759,816 bytes，放在既有 ignored artifacts，沒有進 repo。
- 原型 source 設 64 KiB 回歸上限；本輪全部新增程式、測試與文件合計約 56 KB，低於 64 KiB。
- 正式 `apps/web/` 零修改、零原型引用，正式頁面新增載入量為零。
- 無 base64 圖資、地籍底圖鏡像、CAD、模型大檔或大型貼圖；截圖不納入版控。
- 無 localStorage／IndexedDB／Activity 寫入；Core、凍結 schema、版本號、Pages 設定不變。
- 無真實地籍／地主資料，未把案件資訊送到搜尋或第三方服務。
- 安裝階段需要網路取得公開套件；備妥資源後原型的瀏覽器請求全為同源。

## 複驗與下一步

本機原型：`http://127.0.0.1:8767/`，既有四步流程仍用 `http://127.0.0.1:8766/dashboard.html`。
重建／測試指令見原型 README；CI 已把本輪測試接到現有 Gate 21 與 Gate 19，不改發布設定。

下一輪先裁決正式空間契約與 Three.js 有限依賴例外，再決定人工描地的定位／驗證方式與正式資料來源。
0.8.0 才接可靠的真實基地、footprint、height；0.9.0 視樓層資料成熟度；0.10.0 接決策溯源，不保證 LOD 2。
M7.5 歷史定位保留 Existing Area / Floor Visualization，不改寫歷史成果。
