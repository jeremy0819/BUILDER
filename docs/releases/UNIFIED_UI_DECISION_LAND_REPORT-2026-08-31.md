# BUILDER 四步介面、決策視覺與地政整合回報

日期：2026-08-31  
分支：`codex/unified-ui-decision-land-data`

## 主管摘要

本段完成四個主步驟的介面整合，讓 Site、Product、People、Decision 共享同一套案件列、色彩、字體、密度與主題切換。使用者在任何一步都能辨識目前案件、Core 版本與流程位置；Product 預設只顯示 Core 權威摘要，教學工具改為按需開啟，主操作面明顯縮短。

Decision 已加入可互動的四節點關聯圖。使用者可點選量體、財務、人心與判讀，切換右側權威證據；互動不修改資料、不拖曳結果，也不做反向推算。Site 新增本機地政資訊區，整理既有清冊與附件狀態，並提供官方查詢入口，但不會自動傳送案件資料。

本段未修改 Core Formula、未變更任何 Schema、未打 release tag。完整回歸為 `253 pytest + 490 web headless`，桌機與窄版瀏覽器實測均無整頁橫向溢位或控制台錯誤。

## 本段交付

| 需求 | 結果 | 使用者可見變化 |
|---|---|---|
| 四步風格一致 | 完成 | 共用案件列、步驟標題、色彩、字體、卡片半徑、主題與操作圖示 |
| 決策頁圖像互動 | 完成 | 四節點關聯圖及證據面板；點選節點即可切換來源明細 |
| 介面精簡化 | 完成 | Product 以 Core 摘要為預設；舊教學與匯入工具收進五個分頁；Decision 詳細表與 Strategy 收合 |
| 結合地政資訊 | 完成本機第一階段 | 顯示清冊筆數、圖件狀態、地籍事實預覽及四個官方服務入口 |

## 給工程師

### 架構與資料責任

- `apps/web/os-shell.js`：四步共用案件情境列。案件切換仍透過 `CaseBus`，只保存主題與作用中案件，不建立第二份案件資料。
- `apps/web/os-unified.css`：共用設計 token 與響應式規則。各頁既有功能保留，只統一外框與資訊密度。
- `apps/web/decision-view.js`：由 `rec.view`、`rec.snap`、`rec.decision` 逐欄建立唯讀 view model。比例、單位與缺值處理只屬 presentation formatting，不產生新的領域結果。
- `apps/web/land-information.js`：由本機 `roster` 與 `assets` 逐欄呈現。模組沒有 `fetch`、XHR 或 WebSocket，也不把案件參數附在外部 URL。
- `tests/web/test_unified_ui.mjs`：固定四頁共用資源、Decision 不可拖曳／不可對外請求、地政 URL 不得夾帶案件識別資料、輸出必須 HTML escape。
- `.github/workflows/ci.yml`：新增同屬 Gate 18 的共用介面與資料邊界測試；Gate 19 保留給規劃中的真實瀏覽器自動化。

### Decision 互動契約

四個節點的來源固定如下：

| 節點 | 權威來源 | 呈現欄位 |
|---|---|---|
| 量體 | Core result view | 允建容積、使用容積、容積餘量 |
| 財務 | Core result view | 銷售坪數、共同負擔比、地主分回比、全案投報率 |
| 人心 | Workflow snapshot | 已同意、權變戶數、同意門檻 |
| 判讀 | Decision Engine | 判定、完工機率、決策急迫度、破局引爆點 |

點擊只改變選取狀態與證據面板內容。節點皆為原生 button，可鍵盤到達；程式不存在 drag、drop、contenteditable 或寫回 `CaseStore` 的路徑。

### 地政整合邊界

目前採 Local-first：BUILDER 顯示使用者已匯入的清冊與圖件，外部服務只開啟官方首頁。未實作自動查詢、外部圖磚、地址拼接或案件資料上傳。

官方入口：

- 內政部地籍圖資網路便民服務：<https://easymap.land.moi.gov.tw/Index>
- 全國地政電子謄本系統：<https://ep.land.nat.gov.tw/Home/SNWorkItem>
- 內政部不動產交易實價查詢服務網：<https://lvr.land.moi.gov.tw/>
- 國土測繪圖資服務雲：<https://maps.nlsc.gov.tw/>

地段、地號、門牌、所有權人與附件不會自動出現在外部 URL。這是隱私與離線能力的產品邊界，不是尚未處理的錯誤。

## 驗證報告

| 驗證 | 結果 |
|---|---|
| Python | `253 passed` |
| Web headless | `490 passed`，10 個測試檔全綠 |
| 新增 UI／Decision／Land 測試 | `29 passed` |
| Gate 0 | 真陽性自測全攔、假陽性自測全放、repo 零命中 |
| Gate 4 | 本地連結 `104` 條全部可達 |
| Gate 6 | 凍結 Schema `20` 份全部相符 |
| Gate 8／9／10／16 | 影像白名單、Core bundle、前端版本、Chart Contract 全綠 |
| 瀏覽器桌機 | 1440 x 900，四頁共用字體／背景／案件列，整頁無橫向溢位 |
| 瀏覽器窄版 | 390 x 844，四頁無整頁橫向溢位；Product 分頁完整可見 |
| 主要互動 | Product 分頁、Decision 四節點、People 啟動流程均通過；控制台零錯誤 |

Windows 本機第一次執行 Gate 2 時，檢查器在輸出 PASS 訊息階段遇到 `cp950` 編碼限制；改用與 CI 等價的 UTF-8 輸出環境後通過。Core 匯入與計算本身沒有失敗。

## 後續路徑

1. N3／Gate 19：安裝並固定 Playwright 瀏覽器測試，將本次人工驗收的案件切換、Product 分頁、Decision 節點與窄版條件自動化。
2. 地政第二階段：採使用者本機匯入的向量圖資或圖件包，建立地籍圖與基地事實的對照；仍不把真實圖資放入版控。
3. Decision 第二階段：接上既有 Attribution waterfall、量體逐層視圖與情境結果，形成同一個證據工作區；每張圖仍依 chart contract 標示來源與不可誤讀事項。
4. 資料治理：任何自動地政串接須先定義欄位白名單、同意流程、留存期限、錯誤信封與離線降級，再決定是否導入 API。
5. 版本治理：本段不改 Core 或 Schema，因此維持 `core 0.6.0` 與 `release os-v0.5.0`；是否發版仍走 `docs/releases/CHECKLIST.md` 的人工裁決。

