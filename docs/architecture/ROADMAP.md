# Urban Renewal OS — 統一路線圖 P0–P3（取代散落的 V5–V7／RE-DCF P0–P3 對照）

> 排序原則：Architecture First → Domain First → Core First → 最後才 AI。
> 鐵律（沿用既有）：上一階段未達完成標準，下一階段不開工；每階段都有「不做清單」。
> 舊版本號對照：V5–V7（Urban-Renewal 側）與 RE-DCF vNext 的項目全數收編於此，此後以 P0–P3 稱呼。

## 現況座標（2026-07・M 里程碑對照）

> P0–P3 是**架構層**排序；日常推進另用 **M 里程碑**敘事。兩者對照如下：

- **P0 合併與地基** ✅ 完成（三庫合一、CI 十道 Gate、Pages/Streamlit 部署）。
- **P1 合約升級與 SSOT 止血** ✅ 完成（schema v1.1/v2.0/v2.1 凍結、教學層降級、交叉核對）。
- **P2 Domain 補完** ✅ 大致完成（§56 權變/找補、B 系列係數、現金流結構；IRR/NPV 與分縣市 law_db 待續）。
- **P3 對外介面與智慧層** ⏳ 未開工（開工 Gate 未全過：存活率尚待真實破局案校準）。

**M 里程碑正名與位置**：M1–M4 完成 → M4.5 試金石 →
**M5＝THE WORKFLOW**（決策流程 IA，P0/P1/P2 動線已落地）→
**M5.5 傳動軸駕駛艙**（B1 Pyodide／B2 同框即時評估／B3 依賴高亮／**B1.5 零步啟動＋介面收斂**）
→ **下一站 M6＝THE STRATEGIST**（逐型對策）。
⚠️ 釐清：**同框駕駛艙屬 M5.5 B2，不屬 M6**；M6 專指「逐型對策」智慧層。
（細節見 `../../CHANGELOG.md` Unreleased 節與 `../releases/HANDOFF-M5.5.md`。）

---

## P0 — 合併與地基 ✅ 完成

**目標**：三庫合一、CI 上線、部署切換。零新功能。
**內容**：照 `MIGRATION_PLAN.md` 執行（搬入→機械修正→CI→部署→驗收）。
**完成標準**：MIGRATION_PLAN 步驟 5 清單全綠。
**不做**：任何公式、schema、UI 功能變更。

## P1 — 合約升級與 SSOT 止血

**目標**：讓「數字可回放、飄移可偵測」。
| 項 | 內容 | 驗收 |
|---|---|---|
| schema v2.0 | 完整可重算文件（floors[]/scenario/input_hash/law_db_version），含遷移器 | SCHEMA_STRATEGY §2 黃金判準：examples 全數 load→重算→等值 |
| 教學層降級 | evaluator/simulator 教學試算掛「示意模式」標示；凍結前端公式 | 頁面顯示標示；此後 apps/ diff 不再新增公式 |
| 交叉核對測試 | examples 餵前端教學層 vs Core result，容差比對進 CI | CI 綠；故意改一個前端常數會紅（測試的測試） |
| 黃金測試參數化 | 單一 `test_golden` 拆為逐案 pytest 參數化案例 | 失敗時能指出「哪一案哪個值」 |
**不做**：owners UI、新計算函式、API。

## P2 — Domain 補完（原 V5＋V6 的 Core 側）

**目標**：從「單期快篩」補到「權變＋現金流」，數字從 B 級升 A 級。
| 項 | 內容 | 前置 |
|---|---|---|
| owners 輸入 UI | 地主清冊 CSV 匯入（比照逐層表模式） | 無 |
| `calc_rights_exchange()`／`calc_compensation()` | 逐戶分回、找補（填 OwnerAllocation） | owners UI；真實清冊私下校準 |
| `calc_更新前價值` 補強 | 路寬/分區/建物型態係數 | 無 |
| `calc_cashflow()`→`calc_irr()`/`calc_npv()`＋Loan Engine | 分期現金流（私有實案可校準） | 無 |
| `regulation/` 分縣市 | law_db 拆縣市，每條附條文/上限/來源/更新日期 | 縣市清單問使用者 |
| 沙盤劇本橋接（原 5-1）／Dashboard 多案件（原 V6） | 消費端功能，只讀 result | schema v2.0 |
**完成標準**：一個合成案 JSON 走完「匯入評估→逐戶分回→轉沙盤→復盤」10 分鐘 demo；
Dashboard 每個數字可溯源到 result 欄位。
**不做**：API、AI、真實 PII 進版控。

## P3 — 對外介面與智慧層（原 V7）

**開工 Gate（三項全過才開工）**：① P1＋P2 穩定運轉；② 權變/現金流經真實案驗證；
③ 真實清冊 PII 隔離方案定案。
| 項 | 內容 |
|---|---|
| Python package（`redcf-core`）→ CLI → FastAPI | Core 從 package 變服務；公式穩定前不開 API（消費端會被破壞性變更打死） |
| `Urban-Renewal-Agent`（此時才拆新 repo） | FastAPI＋金鑰代理；瀏覽器永不持鑰 |
| AI Copilot／AI 地主／多 Agent 報告 | AI 只讀 result＋law_db，可溯源（引法條號/Core 欄位），**不心算** |
| 教學層退場 | 前端試算改呼叫 API，刪除前端公式，交叉核對測試同步退役 |

## 平行線（不占 P0–P3）

商辦版（NOI/Cap Rate）＝獨立產品線，複製架構另開；LICENSE 決定（使用者的法律決定，P0 期間提醒一次）。
