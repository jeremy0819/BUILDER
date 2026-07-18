# M5-P1 SPEC · Case Workspace（單案容器）

> **文件類型**：架構規格（docs/architecture/）　**母憲法**：`M5_WORKFLOW_SPEC.md` §2／§5-P1
> **狀態**：定案 → 實作　**層**：純呈現（零計算、零推論）
> **註**：母憲法所稱 wireframe 附圖未入庫，本 spec 以文字定版其元素；附圖到位後只準修版面、不准加邏輯。

## 1. 定位

`dashboard.html` ＝ **Case Workspace（單案容器）**：使用者從 Workspace（多案）挑案後，
在這裡「看見一個案子的全貌」並出發走三步。**不是 STEP 1 的計算頁**——它承載 STEP 1
Site Analysis 的「呈現」，同時是整案的容器（狀態＋資產＋即時結果＋出口）。

## 2. 版面元素（依母憲法 P1 清單）

| 區塊 | 內容 | 資料來源（一律 verbatim） |
|---|---|---|
| 案件頭 | 代號/類型/模式＋STEP 導軌（1 Site［本頁］→ 2 Product → 3 People → ✓ Report） | Workspace store（wf/snap） |
| 案件狀態 | 階段 S1–S11、同意計數/門檻、決策 verdict 徽章、健檢 warnings 數 | Workflow 事實＋decision JSON＋result（逐欄） |
| Site facts | 基地面積/容積率/獎勵率/容積移轉…（呈現 STEP 1 的「輸入事實」） | v2.1 `input.params` 逐欄複製（新增 snap.site 子集） |
| 即時規劃結果 | 共負比/投報率（＋「重算請至 Product Planning」出口） | v2.1 `result` 逐欄（既有 snap 欄位） |
| 基地圖說資產 | 基地圖說／地籍圖／都市計畫圖／街景照片 四槽，本機附圖 | 使用者本機影像 → 縮圖存 localStorage，**永不進版控** |
| 示範案例區 | 原烘焙 Core 示範儀表板（保留，明標「示範」） | 既有 baked 資料 |

無作用中案件時：顯示教學型空狀態（去 Workspace 匯入／看示範案例），不留白牆。

## 3. 紀律（沿用 C2/M4/M5 鐵律）

- 本頁**零計算**：新增的 `snap.site` 只准逐欄複製 `input.params`，Gate 7 SSOT 稽核擴充覆蓋。
- 「值不值得」verdict 只呈現 decision JSON（input_hash 溯源）；無 decision＝空槽，不代判。
- 影像資產：canvas 縮圖（≤800px）後存本機 localStorage；容量滿即明確報錯，不靜默失敗；
  真實圖資零進版控（紅線 3 適用於影像）。

## 4. DoD

- [ ] 有作用中案件：案件頭＋狀態＋Site facts＋即時結果＋四槽資產＋三步出口全部呈現
- [ ] 無案件：教學型空狀態
- [ ] snap.site 逐欄 verbatim（Gate 7 新測試）；頁面零推論
- [ ] 影像四槽可附/可刪/重載留存；quota 錯誤有明確訊息
- [ ] Gate 0/4/7 綠；瀏覽器實開零 console error
