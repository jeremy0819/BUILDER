# Urban-Renewal-OS（暫名 BUILDER）

![CI](https://github.com/jeremy0819/BUILDER/actions/workflows/ci.yml/badge.svg)

都市更新／危老前期評估的整合系統（Urban Renewal OS）目標容器。

**現況**：架構凍結＋兩庫搬入完成；**M1 基礎建設完成**（CI 六道 Gate、Headless 測試、
版本治理、Release Checklist、部署遷移計畫、LICENSE 分析）。可發 `os-v0.1.0-alpha`。

- `RE-DCF-Tool` → `core/redcf/`＋`schemas/`＋`apps/streamlit/`（唯一計算核心，SSOT）
- `Urban-Renewal` → `apps/web/`＋`docs/methodology/`（靜態展示與方法論）

啟動：`pip install -r requirements.txt` → `streamlit run apps/streamlit/app.py`（計算工具）；
靜態站直接開 `apps/web/index.html`。測試：根目錄 `pytest`。

**CI 六道 Gate**（`.github/workflows/ci.yml`，任一紅即擋 merge）：
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
