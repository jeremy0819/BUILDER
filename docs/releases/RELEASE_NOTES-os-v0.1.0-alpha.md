# os-v0.1.0-alpha — Urban Renewal OS（首個可測版本）

> 這份內容可直接貼進 GitHub Release 的說明欄。Target 選 `release/os-v0.1.0-alpha`。

## 這個版本是什麼
Urban Renewal OS 的首個內部可測版本：架構凍結 → 三庫合併（monorepo）→ M1 基礎建設完成。
**alpha 定位**：合約仍會在 M2 的 schema v2.0 做破壞性升級，故僅供內部測試，非對外穩定版。

## 內容
- **計算核心（SSOT）**：`core/redcf/` — 容積查核（§162）／坪效／共同負擔 L6／投報／估值。
- **互動網站**：`apps/web/` — 儀表板 / 賽局沙盤 / 坪效投報試算（含「對接 Core」JSON 匯入）/ 白皮書 / 說明會簡報。
- **計算工具**：`apps/streamlit/app.py` — RE-DCF 精確計算，可匯出 Project JSON。
- **CI 五道 Gate**（Gate0–Gate4）：資料紀律／pytest＋min_example／Core 零 UI 依賴／Excel 範本迴歸／靜態站連結。
- **治理**：版本政策、Release Checklist、Domain Model、Schema 策略、M1 Closing Review、M2 Roadmap。

## 已知限制（測試員先知道，不必回報）
- **教學層數字是示意**：evaluator/simulator 頁內即時試算為教學示意；權威數字以匯入的 Core JSON（result 欄位）為準。
- 逐戶權變/找補、IRR/NPV 尚未實作（排 M2/P2），相關欄位可能為空。
- 頁面字型走系統 fallback（不影響功能）。

## 怎麼測
見 `docs/releases/TESTER_GUIDE.md` 的 T1–T8 測試腳本；用 `schemas/examples/` 的合成範例，零真實資料。
回報進 GitHub Issues，**勿貼真實案件地號/姓名/金額**。

## 基準
- Commit：`release/os-v0.1.0-alpha`（＝feature 分支同一 tip）。
- CI：五道 Gate 全綠。schema v1.1 凍結 hash `e37e10db…5bd4a96`。
- 下一步：M2-A schema v2.0（合約穩定後才做新模擬器）。
