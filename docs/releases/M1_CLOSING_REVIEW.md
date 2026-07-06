# M1 Closing Review — Urban Renewal OS

> 日期：2026-07-06。性質：唯讀複審（review，非改建）。方法：兩個 fresh-context subagent 分別掃
> 程式碼與文件，證據皆 grep/實測。本檔是「能否進 M2」的判定書。
> **判定：✅ 可進入 M2。** 無 Critical/High 阻斷項；發現皆為 Medium/Low 技術債，已排入 M2 Roadmap。

---

## 0. 掃描總結（好消息先講）

| 面向 | 結果 |
|---|---|
| Dead code | **零**（core 19 個 def 全有呼叫者；app.py 7 個函式全被用；無 `if False:`／無大段註解碼） |
| TODO/FIXME/XXX/HACK | **零**（全 repo .py/.html/.md grep 無命中） |
| 孤兒檔案 | **零**（舊 shim calc_engine.py/law_db.py 已確認未殘留於 BUILDER） |
| core 零 UI 依賴 | ✅（grep streamlit/plotly 僅 1 處 docstring，非 import） |
| CLAUDE.md 行數 | 三份 47/64/48，全 ≤150 ✅ |
| governance 單檔 | 全 ≤200 ✅ |

## 1. Technical Debt（依嚴重度）

| # | 債 | 證據 | 處置 |
|---|---|---|---|
| TD-1 | **app.py `main()` 1068 行**（全檔 84%，0 巢狀函式） | apps/streamlit/app.py:207 | M2-R1 拆 `_render_sX()`；純 UI 重構、不動公式 |
| TD-2 | **靜態頁引用 Google Fonts CDN**——與「零外部 CDN、可離線」紅線有出入 | apps/web/{index,evaluator,simulator,briefing,whitepaper}.html:8,10 | 既存債（搬遷前既有）；字型會 fallback、不影響功能。M2-R5 決策：內嵌 or 接受並修正紅線措辭 |
| TD-3 | 五巨檔 HTML（324–753 行，自含 JS）＋教學層前端公式（R-1） | apps/web/*.html | 凍結維持；新模擬器走「開新頁＋Core JSON 橋接」，不改舊頁 |
| TD-4 | 文件產生器（make_briefing_pptx/make_whitepaper_docx/make_report_docx）未進 CI、彼此有重複 helper | tools/make_*.py | M2-R4 抽共用 helper＋補 CI smoke-run（低優先） |
| TD-5 | dict 傳遞、無型別（models/ 未建） | core/redcf/*.py | 依 D5 裁決，隨 P2 新實體引入 dataclass，不回頭大改 |

## 2. 可重構點（前 5，只列值得做的）

1. **app.py main() 拆分**（TD-1）——最大標的，按 S1–S11 節點拆。
2. app.py 四宮格 KPI（759/767/775/783）重複樣板可抽 helper。
3. core `calc_共同負擔`（finance.py:48, 62 行）、`產生報告`（io.py:52, 68 行）超長——**碰公式層需先過 pytest、且不可改邏輯**（紅線1），低優先。
4. 兩個 docgen 產生器的重複排版 helper 抽 `tools/_docgen_helpers.py`（TD-4）。
5. app.py `unsafe_allow_html` 24 次、內嵌 style 字串重複——集中成常數，瑣碎低優先。

## 3. Naming 不一致（皆屬灰區，非 bug）

- `check_bonus_limit`（英文動詞）與 `calc_容積查核`（中文＋calc_）同在 capacity.py——非 contract 邊界層卻用英文，屬命名規範灰區（capacity.py:27 vs 44/53）。**裁決**：不動（改名要動 core，風險>收益），記錄供 M2 命名規範文件參考。
- finance.py 參數 `p: dict` 中英混用——屬慣例（p=參數 dict），可接受。

## 4. Documentation 缺漏

| # | 缺漏 | 處置 |
|---|---|---|
| DOC-1 | 無 `apps/web/` 頁面地圖／README（舊庫的逐頁說明只留在已封存 docs/methodology/） | M2-D1 建 apps/web/README.md（導覽，非新功能） |
| DOC-2 | 無 tools/ 總覽文件（現況＝查原始碼 docstring） | M2-D1 一併補 tools/README.md |
| DOC-3 | 無測試策略文件（test_golden vs test_headless 分工只在檔頭） | M2-D1 補 docs/architecture 測試策略段 |
| DOC-4 | docs/redcf/、docs/methodology/ 10+ 份歷史文件**無 ARCHIVED 標記**，含搬遷前語境（「本庫」「姊妹庫」「兩個獨立 repo」） | M2-D2 批次加 `> [ARCHIVED 2026-07]` 頁首（機械性，可派 haiku） |

## 5. 已修正的事實錯誤（本次 review 順手，屬「修正矛盾」非新功能）

- **schema 檔名**：ARCHITECTURE.md/DOMAIN_MODEL/SCHEMA_STRATEGY 誤寫 `project.schema.json`（點）→
  已統一為實際檔名 `project_schema.json`（底線）。這是最高權威文件的孤兒引用，會誤導弱模型找錯檔。
- **VERSION_POLICY.md** 殘留「六道 Gate」→ 已改「五道 Gate」（與其餘文件一致）。

## 6. 未修、留待 M2 的一致性項（本 review 只記錄，不改建）

- ARCH_REVIEW.md/MIGRATION_PLAN.md/FREEZE_REVIEW.md 仍寫「四道門」——ci.yml 註解已說明「四道＋Gate0＝五道」，
  非真矛盾但未回頭更新。M2-D3 統一補「五道」或加註（這幾份是歷史複審記錄，優先度低）。
- 兩舊庫 README 封存橫幅之後保留大量 v4 舊內容，未加「歷史保留」段落分隔——輕微，M2-D2 一併處理。

## 7. 進入 M2 的判定

**可進入。** 依據：零 Critical、零 High、零 dead code、零 TODO 殘留、CI 綠、core 隔離成立、
版本治理與 release 流程已就緒。M1 的 6 個完成標準全數達成（見 docs/releases/CHECKLIST.md）。
所有 review 發現皆為 Medium/Low 技術債與文件整潔項，已排入 `docs/releases/M2_ROADMAP.md`，
不阻斷 M2 開工。
