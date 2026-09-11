# 遊玩介面 UI/UX 規劃 — 設計原始檔

已發布的設計畫布：<https://claude.ai/code/artifact/25f7c63d-6623-4944-b2dc-1b048775d386>

| 檔 | 內容 |
|---|---|
| `Main.dc.html` | 四步動線・資訊架構（含 2026-09-11 實測頁高／可點元素） |
| `SourceSystem.dc.html` | 來源語意系統（CORE／INPUT／DECISION 三種，沒有第四種） |
| `StateMatrix.dc.html` | 狀態矩陣（計算核心 × 決策綁定 × 快照陳舊） |
| `Components.dc.html` | 元件規格（數值格／空狀態／警語條／導覽列） |
| `Mobile.dc.html` | 手機規範（字級下限、觸控目標、導覽列收合） |
| `canvas.json` | 畫布版面配置 |

**設計紀律**：所有 token 取自 `apps/web/os-unified.css` 的實際值
（accent `#5a48d6`、line `#dfe3e8`、KPI `750 19px/1.2` mono、圓角 8/6px），
不新增第二套設計語言。圖上的紅色數字皆為真實瀏覽器實測，非估計。

**產出檔不進版控**：`builder-play-ui-plan.html` 約 2.5 MB（內含畫布編輯器本體），
比整個 repo（`size-pack` 1.33 MiB）還大，已由 `.gitignore` 排除。
要重新產生就從上表的原始檔重新組裝；畫布若在線上被編輯過，先取回再改。
