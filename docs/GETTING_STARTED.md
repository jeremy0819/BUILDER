# Getting Started — 15 分鐘走完一個案件

> Urban Renewal Decision OS 的官方使用流程（M4.5 定版）。
> 一條鐵則：**數字只有一個來源（RE-DCF Core）**；三步各回答一個問題。

## STEP 1 · Site Analysis 基地診斷 —「這塊地值不值得開發？」
開 `dashboard.html`：確認地塊資訊——都市計畫、使用分區、容積/建蔽、法規限制、更新潛力 KPI。
本頁**零計算**，所有數值來自 Core 匯出。答「值得」→ 下一步。

## STEP 2 · Product Planning 產品規劃 —「最佳產品配置？」
開 `evaluator.html`：輸入建築產品（規模/獎勵/單價），看坪效、容積查核、共同負擔、投報與敏感度。
這是**唯一正式計算入口**；滿意後匯出 **v2.1 案件 JSON**（帶 input_hash 指紋）。

## STEP 3 · Negotiation Strategy 整合推演 —「整合機率多少？先談誰？」
兩條路徑：
- **直接推演**：開沙盤，用三滑桿（戶數 12–80／同意比／家族密度）自訂街區。
- **實案推演**：先到 `workspace.html` 匯入 Step 2 的 JSON 建案 → 「帶入沙盤推演」——
  街區＝你的地主清冊（verbatim），結局權變表＝Core 的 §56 逐戶分回。
遊戲結束生成故事化結算報告。

## 之後：案件管理與決策
- **Workspace**：同意看板（事件重放）、任務、決策日誌、時間軸、wf 匯出入——案件的長期經營面。
- **Decision Engine（M4）**：以 result＋workflow state 產出 GO/CAUTION/STOP、三方 EV、
  退場訊號（decision JSON 匯入 Workspace 即上卡）。⚠️ 存活率為示意預設，未經校準前僅供方向感。

## 紅線（使用者也適用）
- 真實案件資料**永不**進版控——一律放本機（Workspace localStorage／`/local_calibration/`）。
- UI 不算數字；發現頁面數字對不上 JSON，那是 bug，請回報。
