# 模型調度守則（Model Dispatch Protocol）

> 讀者：在 Urban-Renewal OS 三 repo（BUILDER / RE-DCF-Tool / Urban-Renewal）工作的**每一個** Claude session，
> 不論模型大小。本檔是「怎麼派工、怎麼驗收」的唯一規範。
> 制定：2026-07-05（Fable 5 session）。模型資訊為當日查證值，過期請照 §0 的方法重查，不要憑記憶填。

---

## 0. 已查證的模型與參數（2026-07-05）

| 名稱 | 模型 ID | Agent 工具 `model` 參數 | 定位 |
|---|---|---|---|
| Haiku 4.5 | `claude-haiku-4-5-20251001` | `haiku` | 機械性批次：grep 彙整、改名、格式化 |
| Sonnet 5 | `claude-sonnet-5` | `sonnet` | **預設工作馬**：讀碼、實作、測試、掃描 |
| Opus 4.8 | `claude-opus-4-8` | `opus` | 升級用：連錯除錯、公式/法規判斷、第二意見 |
| Fable 5 | `claude-fable-5` | `fable` | 例外性架構判斷。額度稀缺，日常禁用 |

- 可用 subagent 類型：`Explore`（唯讀搜尋）、`Plan`（規劃）、`general-purpose`（可改檔）、`claude`、`claude-code-guide`（Claude Code 使用問題）。
- Agent 工具**沒有 effort 參數**。reasoning effort 只能寫在 `.claude/agents/*.md` frontmatter；本專案目前未建立自訂 agent（待使用者需要時建立）。
- **未確認事項**（不要當作事實使用）：
  - 被安全機制導向 Opus 4.8 的請求是否消耗 Fable 額度 → 到 claude.ai 用量儀表板實測。
  - 未來 session 能否 spawn `model: "fable"` → 先試，失敗改 `opus`。
- 重查方法：看系統提示的 Environment 段（列出當前模型 ID 清單），或用 `claude-api` skill 查官方模型表。

---

## 1. 指揮官不下場

主對話（指揮官）只做四件事：**判斷、決策、整合、對使用者報告**。

以下工作一律派 subagent，指揮官不自己做：

| 工作 | 派給 | model |
|---|---|---|
| 讀 >400 行的檔案、或一次要看 >3 個檔案 | Explore | sonnet |
| 全 repo grep ＋彙整（如真實段名掃描） | Explore | haiku |
| 跑測試並解讀失敗原因 | general-purpose | sonnet |
| 批次機械修改（改 import 前綴、改名、加註解） | general-purpose | sonnet |
| 查網頁 / 官方文件 | general-purpose | sonnet |
| 對抗審查 / read-back 驗收 | general-purpose（fresh context） | sonnet |

指揮官親自做的例外：單檔小修（diff < 50 行）、對使用者的最終回覆、
牽涉公式／合約／法規的**判斷**（實作仍可發包，判斷不外包）。

判斷句：「這件事換成便宜模型做，品質會掉嗎？」——不會掉就發包。

---

## 2. 任務交辦三要素（缺一不發包）

1. **目標與動機**：要什麼＋為什麼要（subagent 遇到岔路才能自行取捨）。
2. **驗收條件**：可機械檢查——具體指令＋預期輸出（如 `pytest` 全綠、`grep` 零命中）。
3. **回報格式**：長度上限＋「結論＋檔案:行號」。

範本見 `governance/TASK_TEMPLATES.md`（搜尋／實作／重構／研究／審查五型）。

---

## 3. 回報合約（subagent 端義務）

- 只回**結論與證據**（檔案:行號），總長 ≤ 60 行。
- 長產物（報告、清單、程式碼）**寫進檔案**，回報只給路徑＋三行摘要。
- 禁止把整個檔案內容貼回主對話。
- 找不到／做不到要明說：「零命中＋已掃範圍」或「卡在哪＋已試什麼」。

---

## 4. 升降級路徑

```
haiku 同一子任務錯 1 次
  → 升 sonnet（同一 prompt 補上失敗輸出）
sonnet 同一子任務連錯 2 次
  → 帶完整失敗軌跡（原 prompt、兩次輸出、錯在哪）升 opus
opus 解出模式後
  → 把解法寫成具體規則（存入 LESSONS.md），降回 sonnet/haiku 批次套用
同一件事最多重試 2 輪
  → 仍失敗：停下問使用者，附完整失敗軌跡與已排除的假設
```

「同一子任務」定義：驗收條件相同的一次發包。改了驗收條件＝新任務，重試計數歸零。

---

## 5. 驗證不自驗

- **產出者不驗收自己的產出**。驗收一律派 fresh-context agent（不帶產出過程的上下文）。
- 檔案類 → read-back：新 agent 讀回檔案，逐條核對驗收條件，回報「過／不過＋證據」。
- 程式碼 → 測試或實跑：RE-DCF 動公式必跑 `pytest`；動 UI 必須真的啟動看畫面
  （教訓：v4.8 曾黃金測試全綠但 UI 整頁崩潰）。
- 高風險判斷（公式、法規解讀、schema 變更）→ **第二意見**：另派一個 agent 用同樣輸入獨立解一次，
  比對答案；不一致 → 升級模型或問使用者，不得擲硬幣選一個。

---

## 6. 本專案的紅線（派工前先讀，subagent prompt 裡要複述）

1. **SSOT**：計算公式只存在 `core/`（合併後 `core/redcf/`）。任何前端（HTML／Streamlit）
   不得新增或複製公式，含 warnings 門檻判斷。
2. **schema 凍結**：`schemas/project_schema.json` v1.1 凍結中，位元組不可變
   （基準 sha256 見 RE-DCF《歷史乾淨度報告.md》）。變更需求記 backlog。
3. **零真實案件資料**：真實段名／案名／金額／姓名不進版控（含檔名與 commit 訊息）。
   驗證指令：`grep -rn "竹蓮\|安和\|安民\|中正\|龜山" --exclude-dir=.git .` 零命中。
4. **黃金測試是硬門檻**：改公式後 `pytest` 不綠不准 commit。
5. **simulator.html V4 封版**：不重寫；改動走 V5 路線圖。
