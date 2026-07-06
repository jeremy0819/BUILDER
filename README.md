# Urban-Renewal-OS（暫名 BUILDER）

都市更新／危老前期評估的整合系統（Urban Renewal OS）目標容器。

**現況**：架構凍結完成（2026-07），等待執行兩庫搬遷（乾淨快照）：

- `RE-DCF-Tool` → `core/redcf/`＋`schemas/`＋`apps/streamlit/`（唯一計算核心，SSOT）
- `Urban-Renewal` → `apps/web/`＋`docs/methodology/`（靜態展示與方法論）

## 從哪裡開始

| 你是 | 讀 |
|---|---|
| AI session | `CLAUDE.md`（索引）→ `governance/MODEL_DISPATCH.md` |
| 想懂架構 | `ARCHITECTURE.md`（六大裁決＋資料流） |
| 要執行搬遷 | `docs/architecture/MIGRATION_PLAN.md` |
| 想看路線圖 | `docs/architecture/ROADMAP.md`（P0–P3） |

授權：未定（LICENSE 待 repo 擁有者決定；見 ROADMAP 平行線）。
本庫零真實案件資料；範例皆為合成案例。
