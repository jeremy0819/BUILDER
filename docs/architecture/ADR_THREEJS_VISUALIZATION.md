# ADR — Three.js Visualization Dependency

日期：2026-09-23。狀態：隔離原型已驗證；正式 Viewer 導入待核准。
這不是對 `ARCHITECTURE.md` D6「零依賴」的自行改寫。

發布補充（同日使用者授權）：允許將合成原型部署於獨立 Pages 路徑 `spatial-prototype.html`。
公開版與正式頁面同源，不宣稱獨立網域／安全沙箱隔離；原型仍不讀寫案件、不接正式導覽。
套件只在部署產物中組裝，正式頁面不引用。公開版隱藏本機 Core 診斷面板；正式 Viewer 的依賴例外仍待核准。

## 決策範圍

允許在 `tools/spatial-prototype/` 建立 synthetic-only 測試頁，以獨立 loopback origin 運行。
原始碼不放進 `apps/web/`、不加入正式導覽，不讓 Three.js 成為 Core 或四步流程的必要依賴。
原型用既有 Core Worker 做一次合成運算共存測試，但不把該運算結果綁到展示幾何。

## 依賴與供應鏈

| 問題 | 本輪決定 |
|---|---|
| 固定版本 | Three.js 0.180.0；不是「永遠最新」，升級要重驗 hash 與互動 |
| 來源 | 官方 npm three package，`three.lock.json` 固定 tarball URL、SHA-512 及四個檔案 SHA-256 |
| 載入 | 同源原生 ES modules + 固定 import map；無 bundler，無框架 |
| 最小檔案 | three.module.min.js、three.core.min.js、OrbitControls.js、LICENSE |
| 大小 | 實測合計 759,816 bytes（含 LICENSE，未壓縮），預算上限 1,200,000 bytes |
| Repository | 只提交工具、lock、合成 fixture；下載物在既有 ignored `tools/browser/artifacts/spatial-vendor/` |
| 安裝 | `python tools/prepare_spatial_prototype.py`；限制壓縮檔大小、僅抽取明確列舉的普通檔案、驗證完整性 |
| 啟動檢查 | `--check` 可離線驗證四檔；server 啟動先驗證，損壞即拒絕 |
| License | 官方 r180 為 MIT；本機保留原 LICENSE。正式散布的授權檢核待正式導入決議 |
| 更新安全 | 完整性不代表無漏洞；正式導入前需依固定版本重新做依賴安全檢視 |

## Offline／CSP／Deployment

預先備妥本機檔案後不需要外部 API、CDN、字型、材質或圖磚。
「可離線」指本機 HTTP server + 已準備資源，不宣稱 `file://` 或未安裝資源也能啟動。
本機資源缺失明示 fallback，永不偷偷連 CDN。安裝步驟需要網路，但只下載公開套件、不攜案件資料。

隔離 server 綁 `127.0.0.1`；禁目錄列表、路徑逃逸、外部連線、iframe 與表單送出。
CSP `script-src 'self'` 搭配固定 import-map hash；`wasm-unsafe-eval` 只為既有 Pyodide 共存。
不開放 `unsafe-eval`、通配遠端網域或動態搜尋代理。
公開合成頁以 CSP meta 保留限制與固定 import-map hash；Pages 不部署測試 server。
正式四步 CSP 與 Pyodide runtime 供應方式不變；Pages 僅增加原型組裝步驟。

## Mobile／資源釋放

Orthographic Camera + OrbitControls；旋轉／縮放／平移／重置／選取均只改視角。
無材質貼圖、動態陰影、人物、動畫或外部模型。像素比上限 1.5；按需 render，閒置不持續渲染。
scene 預算：draw calls <= 12、triangles < 2,000。ResizeObserver、controls、geometry、material 在離頁清理。
桌機與手機 viewport 驗證畫布像素非空、相機操作、觸控、文字不溢出。
本輪 Chromium 行動模擬不是實體手機 GPU 效能證明；正式接受前要補低階 Android／iOS 實機量測。

## Fallback

WebGL 缺失、context loss、依賴缺失：顯示明確狀態，停用相機控制，保留既有合成物件資料。
不改用假 3D，不用截圖冒充可操作模型。正式版亦需保留原本面積／表格路徑。

## 撤回與正式導入

此原型可整體移除而不影響 production，因 production 零引用。
正式導入需要使用者核准 D6 的有限例外、供應與授權方式、空間契約及真實來源驗證。
不以原型跑通等同正式架構接受，也不把 OS 0.7.0 的發布日期當成核准。

## 官方來源

- [Three.js installation](https://threejs.org/manual/pages/installation.html)：模組與 addons 需正確載入及版本一致。
- [r180 LICENSE](https://raw.githubusercontent.com/mrdoob/three.js/r180/LICENSE)：固定版本授權原文。
- [npm 0.180.0 metadata](https://registry.npmjs.org/three/0.180.0)：套件版本、完整性與授權資訊。
