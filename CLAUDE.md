# BUILDER（→ Urban-Renewal-OS）— Session 索引

> 本 repo 是 Urban Renewal OS 的目標容器（monorepo）。現況：**M2 關閉（os-v0.2.0-beta 已發布）＋
> M3 進行中（權利變換/找補）**：core 0.3.0（`rights.py` §56 逐戶分回＋找補，見 `CHANGELOG.md`）、
> schema **v2.1**（`project_schema_v2_1.json`，owner_allocations；v1.1/v2.0/v2.1 皆凍結，Gate 6 守衛）、
> Streamlit Tab⑤ owners CSV → 逐戶權變。**入口＝URBAN STRAND OS shell（`apps/web/index.html`）**，
> 儀表板在 `apps/web/dashboard.html`，其他介面皆為 shell 之模組。分支 `main` 與 feature 同步推進。
> M3 待續：更新前價值係數（🔴 需使用者核准）、三態地主/選屋（見 `docs/releases/ROADMAP_M2-M8.md`）。
> 本檔只做路由——保持 ≤150 行。

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

## 路由表

| 要做的事 | 讀哪份 |
|---|---|
| 派 subagent／選模型／驗收產出 | `governance/MODEL_DISPATCH.md`、`governance/TASK_TEMPLATES.md` |
| 判斷「該不該／算不算完成／要不要問」 | `governance/JUDGMENT_RUBRICS.md` |
| 改檔案前查權限（🟢🟡🔴） | `governance/MAINTENANCE.md` |
| 執行兩庫搬遷（P0） | `docs/architecture/MIGRATION_PLAN.md`（逐步驗收，照做） |
| 動 schema／查版本規則 | `docs/architecture/SCHEMA_STRATEGY.md` |
| 查實體定義／要不要建模 | `docs/architecture/DOMAIN_MODEL.md` |
| 排優先序／判斷某功能該不該現在做 | `docs/architecture/ROADMAP.md`（P0–P3） |
| 了解已知風險與文件衝突裁決 | `docs/architecture/ARCH_REVIEW.md`、`docs/architecture/FREEZE_REVIEW-2026-07.md` |
| 版本規則／發布流程／授權 | `governance/VERSION_POLICY.md`、`docs/releases/`（CHECKLIST、LICENSE_ANALYSIS） |
| 都更開發模式／整合方法論／遊戲架構 | `docs/handbook/`（整合人手冊、URBAN_STRAND架構手冊）；狀態報告 `docs/releases/PROGRESS_REPORT-2026-07.md` |
| CI 五道 Gate 怎麼跑／怎麼修 | `.github/workflows/ci.yml`＋`tools/check_*.py` |
| harness 常見翻車與修法 | `governance/DIAGNOSIS.md` |
| 交接脈絡與低信心警示 | `governance/LETTER_TO_FUTURE_SESSIONS.md` |
| 踩了新雷 | 寫進 `LESSONS.md`（格式見 MAINTENANCE §2） |

## 文件權威順序（衝突時）

使用者指示 > ARCHITECTURE.md＋governance/ > 各 repo CLAUDE.md > ROADMAP > 其餘 docs。

## 相關 repo

- `jeremy0819/RE-DCF-Tool` — 計算核心（搬入前的家）；`jeremy0819/Urban-Renewal` — 靜態站與方法論。
- session 若未掛載，用 add_repo 加入。搬遷完成後兩舊庫轉私有封存。
