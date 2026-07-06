# 快速診斷：本 harness 最漏 token、最易失焦、最易出錯的前三名

> 依據：2026-07-05 Fable session 對三 repo 與既有工作紀錄的實測觀察。每條附弱模型可照做的修法。

---

## 1. 最漏 token：巨檔與長文件整讀進主對話

**證據**：`app.py` 1265 行、`index.html` 753 行、五個 HTML 合計約 2800 行、兩庫 docs 合計約
2700 行、RE-DCF CLAUDE.md 337 行（每 session 自動全載）。一次「把檔案讀進來看看」＝
數千 token 進主對話，且大多數行與當前任務無關。

**修法（照做即可）**：
- 讀檔前先 `wc -l`。>400 行的檔案禁止整讀：用 Grep 找目標段落、用 Read 的 offset/limit 讀區段。
- 「掃描／找東西」一律派 Explore subagent（回報 ≤60 行），主對話只進結論。
- CLAUDE.md 只當索引（≤150 行），長內容放 docs/ 按需引用——本次已重寫，維持它。

## 2. 最易失焦：文件互相矛盾與過時錨點

**證據**：RE-DCF CLAUDE.md 寫開發分支 `claude/claude-md-docs-ls9Bu`（早已不用）、
「app.py 函式目錄 Lines 33–298」（v4.7 已搬進 core/，實測 app.py 無 `def calc_`）；
ROADMAP「永遠獨立 repo」vs 合併計畫 monorepo。弱模型會挑其中一份當真，然後在錯的分支、
錯的檔案位置工作半個 session。

**修法**：
- 遇到兩份文件說法不同：查 `governance/MAINTENANCE.md` §4 權威順序表，高位者勝；
  裁決後**當場修低位文件**並記 LESSONS.md，不留給下一個 session 再踩。
- 文件裡不寫行號、不寫「目前分支」這類保鮮期短的錨點；要引用就引檔名＋函式名。

## 3. 最易出錯：把「文件宣告」當「程式事實」

**證據**：全部文件宣告「Dashboard 不重算、SSOT」，但 evaluator.html:312-341 前端完整重算
容積與共負——宣告與事實相反。弱模型若信文件，會在錯誤前提上做決定（例如「前端沒公式，
所以改 Core 費率不用管前端」→ 教學層數字悄悄飄移）。

**修法**：
- 任何要當前提用的宣告，先花 30 秒驗證：宣告「X 沒有公式」→ `grep -n "=\*\|Math\.\|calc" X`；
  宣告「測試全綠」→ 實跑 `pytest`；宣告「零命中」→ 實跑該 grep。
- 驗證不自驗：自己的產出叫 fresh-context agent 驗（MODEL_DISPATCH §5）。
- 回報時區分「我驗過（附指令輸出）」與「文件說的（未驗）」。
