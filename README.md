# BUILDER — Urban Renewal Decision OS

![CI](https://github.com/jeremy0819/BUILDER/actions/workflows/ci.yml/badge.svg)

把一個都更／危老案，走成一條可稽核的決策流程：

**Site Analysis → Product Planning → Negotiation Strategy → Decision Report**
（基地診斷 → 產品規劃 → 整合推演 → 決策報告；通用語言見 `docs/STANDARD_WORKFLOW.md`）

**現況**：M1–M4 完成（工程地基／產品地基／Workflow OS＋B 系列／Decision Engine v0.1）；
M4.5 試金石（財務/係數與真實案比對 ×2 ✅；stage_tree 存活率未校準——verdict＝方向性判斷，非投資結論）；M5 THE WORKFLOW（決策流程 IA）進行中。
工作流只呈現引擎輸出——公式只在 `core/redcf`（SSOT），判讀只出自 Decision Engine。
品質治理：**CI 八道 Gate**（資料紀律／pytest／安裝性／Core 隔離／範本迴歸／連結／沙盤與
Workspace headless／schema 凍結／圖檔白名單），任一紅即擋 merge；release 現況 **os-v0.3.0**。
授權：未定（Proprietary 拍板中——正式聲明前保留所有權利）。

- `core/redcf/`＋`schemas/`＋`apps/streamlit/`（唯一計算核心，SSOT；源自 RE-DCF-Tool）
- `apps/web/`＋`docs/methodology/`（決策流程外殼與方法論；源自 Urban-Renewal）

啟動：`pip install -r requirements.txt` → `streamlit run apps/streamlit/app.py`（計算工具）；
靜態站直接開 `apps/web/index.html`（15 分鐘上手見 `docs/GETTING_STARTED.md`）。測試：根目錄 `pytest`。

**CI 五道 Gate**（Gate0–Gate4，`.github/workflows/ci.yml`，任一紅即擋 merge；共 6 條指令）：
Gate0 資料紀律／Gate1 pytest＋min_example／Gate2 Core 零 UI 依賴／
Gate3 Excel 範本迴歸（內容比對）／Gate4 靜態站連結。本地一次跑完：

```bash
bash check_no_real_names.sh && python -m pytest -q && python min_example.py \
  && python tools/check_core_isolation.py && python tools/check_template.py \
  && python tools/check_web_links.py
```

待辦（使用者操作）：Pages／Streamlit Cloud 部署切換、舊庫封存、補推 tag、LICENSE 拍板
（見 `docs/architecture/DEPLOYMENT_MIGRATION.md`、`docs/releases/`）。

## 從哪裡開始

| 你是 | 讀 |
|---|---|
| AI session | `CLAUDE.md`（索引）→ `governance/MODEL_DISPATCH.md` |
| 想懂架構 | `ARCHITECTURE.md`（六大裁決＋資料流）、`docs/architecture/FREEZE_REVIEW-2026-07.md`（複審＋評分） |
| 要執行搬遷 | `docs/architecture/MIGRATION_PLAN.md` |
| 想看路線圖 | `docs/architecture/ROADMAP.md`（P0–P3） |
| 版本規則／發布 | `governance/VERSION_POLICY.md`、`docs/releases/CHECKLIST.md` |
| 部署／授權 | `docs/architecture/DEPLOYMENT_MIGRATION.md`、`docs/releases/LICENSE_ANALYSIS.md` |

授權：未定（LICENSE 待 repo 擁有者拍板；分析見 `docs/releases/LICENSE_ANALYSIS.md`，建議 Proprietary）。
本庫零真實案件資料；範例皆為合成案例。
