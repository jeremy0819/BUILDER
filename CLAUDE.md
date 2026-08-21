# BUILDER（→ Urban-Renewal-OS）— Session 索引

> 本 repo 是 Urban Renewal OS 的目標容器（monorepo）。**入口＝OS shell（`apps/web/index.html`）**；
> **分支＝單線 `main`**；真實校準一律 `/local_calibration/`（gitignored）。
> 本檔只做路由——保持 ≤150 行。**改動現況段時，數字一律以下方指令實測，不得憑印象寫。**
>
> ### 現況（2026-08｜實測基準）
>
> | 座標 | 值 | 怎麼查 |
> |---|---|---|
> | CORE_VERSION | **0.6.0** | `grep CORE_VERSION core/redcf/_version.py` |
> | 最新 release tag | **os-v0.5.0** | `git tag -l \| tail -1` |
> | 凍結 schema | **20 檔** | `python tools/check_schema_freeze.py` |
> | CI Gate | **20 道** | `grep -c 'name: "Gate' .github/workflows/ci.yml` |
>
> **已出貨**：M4 決策引擎（三方 EV/verdict/exit）→ M5 THE WORKFLOW → M5.5 傳動軸（Pyodide
> 在瀏覽器跑同一份 Core）→ M6 THE STRATEGIST（逐型對策）→ **M7 THE CASE OS 全五項**
> （Memory/Watchtower/Scenario/**Attribution 加總守恆歸因**/量體視圖）→ **M8.1 圖表契約**＋
> **M8.2 歸因瀑布圖**。core 0.6.0 ＝ `input_hash` 數值正規化（溯源鍵跨 Python/JS 邊界穩定）。
>
> **進行中／待裁決**：M8.3 互動量體、M8.4 敏感度地圖、M8.5 GIS（方案 B 本機匯入）；
> **P1：Decision v0.2 攜帶 `core_version`**（`matchDecision()` 目前單鍵比對，跨版本會誤掛，
> 須於 os-v0.6.0 發布前完成，見 `docs/architecture/P1-decision_core_version_binding.md`）。
> **P3 未開工**——開工 Gate 卡在「stage_tree 存活率僅 n=1 錨定」與「真實清冊 PII 隔離方案未定案」。

## 開工前必讀（依序，共約 10 分鐘）

1. `governance/MODEL_DISPATCH.md` — 怎麼派工、選模型、驗收（**先讀這份再動手**）
2. `ARCHITECTURE.md` — 架構凍結：六大裁決、資料流、SSOT 執法（最高權威文件）
3. `governance/JUDGMENT_RUBRICS.md` — 何時升級／何時算完成／何時停下問人

## 紅線（違反任何一條＝立即停止並回報）

1. 計算公式只存在 `core/`（合併後 `core/redcf/`）——前端/Dashboard 一條公式都不准寫
2. `schemas/project_schema.json` v1.1 凍結中，位元組不可變
3. 零真實案件資料進版控（段名/姓名/金額，含檔名與 commit 訊息）
4. 改公式必跑 `pytest`，不綠不 commit
5. `simulator.html` V4 封版，不重寫
6. **Workspace 永不自行推論**：只呈現 Core Output／Workflow State／Decision Engine Output；
   任何取不到的資訊（EV、GO/CAUTION/STOP、風險窗、三型分類）**不得由 UI 自算**——schema 先行。
   每個元件先答「這是 DISPLAY 資訊，還是 ADVANCE 決策？」（見 `knowledge/00_FIRST_PRINCIPLES.md` 四題關卡）
   **語意釐清**：「UI 零推論」限制的是**權威**（UI 不得自行發明邏輯），不是**頻率**——
   即時/高頻呼叫 Core 完全合規；「批次計算才合規」是誤讀（DUAL_TRACK/M5.5 B 軌裁定）。

## 路由表

| 要做的事 | 讀哪份 |
|---|---|
| 產品第一性原理／四層決策框架／新頁面關卡 | `knowledge/00_FIRST_PRINCIPLES.md`（決策脊椎；每新增頁面前必過四題關卡） |
| 派 subagent／選模型／驗收產出 | `governance/MODEL_DISPATCH.md`、`governance/TASK_TEMPLATES.md` |
| 判斷「該不該／算不算完成／要不要問」 | `governance/JUDGMENT_RUBRICS.md` |
| 改檔案前查權限（🟢🟡🔴） | `governance/MAINTENANCE.md` |
| 執行兩庫搬遷（P0） | `docs/architecture/MIGRATION_PLAN.md`（逐步驗收，照做） |
| M7 Case OS（記憶層／Timeline／Attribution） | `docs/architecture/M7_CASE_OS_SPEC.md`（憲章：Local-first、只記事實不記推論） |
| 動 schema／查版本規則 | `docs/architecture/SCHEMA_STRATEGY.md` |
| 查實體定義／要不要建模 | `docs/architecture/DOMAIN_MODEL.md` |
| 排優先序／判斷某功能該不該現在做 | `docs/architecture/ROADMAP.md`（P0–P3） |
| 下一步做什麼／各站順序與驗收 | `docs/architecture/NEXT_PLAN-2026-08.md`（N1–N7 施工序） |
| 了解已知風險與文件衝突裁決 | `docs/architecture/ARCH_REVIEW.md`、`docs/architecture/FREEZE_REVIEW-2026-07.md` |
| 版本規則／發布流程／授權 | `governance/VERSION_POLICY.md`、`docs/releases/`（CHECKLIST、LICENSE_ANALYSIS） |
| 都更開發模式／整合方法論／遊戲架構 | `docs/handbook/`（整合人手冊、整合人沙盤架構手冊）；狀態報告 `docs/releases/PROGRESS_REPORT-2026-07.md` |
| CI 五道 Gate 怎麼跑／怎麼修 | `.github/workflows/ci.yml`＋`tools/check_*.py` |
| harness 常見翻車與修法 | `governance/DIAGNOSIS.md` |
| 交接脈絡與低信心警示 | `governance/LETTER_TO_FUTURE_SESSIONS.md` |
| 踩了新雷 | 寫進 `LESSONS.md`（格式見 MAINTENANCE §2） |

## 文件權威順序（衝突時）

使用者指示 > ARCHITECTURE.md＋governance/ > 各 repo CLAUDE.md > ROADMAP > 其餘 docs。

## 相關 repo

- `jeremy0819/RE-DCF-Tool` — 計算核心（搬入前的家）；`jeremy0819/Urban-Renewal` — 靜態站與方法論。
- session 若未掛載，用 add_repo 加入。搬遷完成後兩舊庫轉私有封存。
