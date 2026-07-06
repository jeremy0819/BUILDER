# Urban-Renewal-OS（暫名 BUILDER）

都市更新／危老前期評估的整合系統（Urban Renewal OS）目標容器。

**現況**：架構凍結完成（2026-07）；兩庫已以乾淨快照搬入（MIGRATION 步驟 0–2 完成）：

- `RE-DCF-Tool` → `core/redcf/`＋`schemas/`＋`apps/streamlit/`（唯一計算核心，SSOT）
- `Urban-Renewal` → `apps/web/`＋`docs/methodology/`（靜態展示與方法論）

啟動：`pip install -r requirements.txt` → `streamlit run apps/streamlit/app.py`（計算工具）；
靜態站直接開 `apps/web/index.html`。測試：根目錄 `pytest`。
待辦：CI（步驟 3）、Pages/Streamlit Cloud 部署切換與舊庫封存（步驟 4，repo 擁有者操作）。

## 從哪裡開始

| 你是 | 讀 |
|---|---|
| AI session | `CLAUDE.md`（索引）→ `governance/MODEL_DISPATCH.md` |
| 想懂架構 | `ARCHITECTURE.md`（六大裁決＋資料流） |
| 要執行搬遷 | `docs/architecture/MIGRATION_PLAN.md` |
| 想看路線圖 | `docs/architecture/ROADMAP.md`（P0–P3） |

授權：未定（LICENSE 待 repo 擁有者決定；見 ROADMAP 平行線）。
本庫零真實案件資料；範例皆為合成案例。
