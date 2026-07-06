# M2 Roadmap — Schema v2.0 · Packaging · 新模擬器

> 前置：M1 完成（CI 五道 Gate、版本治理、Release 流程）＋M1 Closing Review 判定「可進 M2」。
> 定位：M2 是「合約升級＋地基收尾＋第一個新面向（模擬器）」。仍不做 AI/API/後端（那是 P3）。
> 排序原則：Architecture First → Domain First → Core First。新模擬器排在合約與地基之後，
> 因為它要吃 Core 的權威數字，合約沒升級好、模擬器就只能接舊的教學層數字（重蹈 R-1）。

---

## M2 分期（依相依順序）

### M2-A：合約升級 schema v2.0（最高優先，其餘多半卡它）
**Why**：v1.1 合約無逐層 floors[]，「從合約 JSON 重算 result」不可行＝稽核鏈斷、Dashboard/模擬器
拿不到可回放的權威數字（ARCHITECTURE D3、SCHEMA_STRATEGY §2）。
**Task**：
- 先寫 fixture 與驗收測試（load→recompute→逐欄位相等），再改 schema，最後改消費端——同一 commit。
- `core/redcf/migrations.py`：`migrate(doc)` 鏈式 1.0→1.1→2.0；消費端不得各自寫轉換。
- schema v2.0 結構：input（site/floors/plan/finance/owners/scenario）＋result＋provenance
  （core_version/computed_at/input_hash/law_db_version）。
- examples 以 v2.0 重生（generate_examples.py）。
**Deliverable**：schema v2.0 凍結宣告＋遷移器＋全 examples 通過「重算等值」測試。
**驗收**：`pytest` 綠（含新 fixture）；舊 v1.1 範例 migrate 後通過 v2.0 驗證；CI Gate1 綠。

### M2-B：Packaging（pyproject，讓 sys.path 墊片退場）
**Why**：core.redcf 現靠 app.py／腳本的 sys.path 墊片＋根 conftest.py 撐住，非真 package（FREEZE_REVIEW M4）。
**Task**：加 `pyproject.toml`，`core.redcf` 可 `pip install -e .`；移除 app.py／tools 的 sys.path 墊片；
tests 改標準匯入。
**Deliverable**：乾淨環境 `pip install -e . && pytest` 綠；墊片碼刪除。
**驗收**：Gate2 隔離仍 PASS；min_example 與 CI 全綠。

### M2-C：新都更模擬器（沙盤推演 → 整合 Core 精確計算）★ 使用者指定
**Why**：現 simulator.html（V4 封版）的財務是前端教學層自算（R-1）。新模擬器要吃 Core 算好的
權威數字，把「賽局談判沙盤」建在「精確計算」之上——這同時是 R-1 的正解。
**設計（已與使用者定案的機制）**：
- **Core 預算 JSON 橋接**（靜態純度＋SSOT 兼顧）：Python Core 先算好 Result JSON（含 owners 逐戶
  分回、共負、投報、warnings），新模擬器（靜態頁）**只讀** JSON 當權威盤面，在其上做談判/情緒/
  樞紐戶賽局。數字一律來自 result 欄位，模擬器一條公式都不寫。
- **開新頁，不改封版頁**：新增 `apps/web/os-simulator.html`（或協商命名），simulator.html（V4）維持封存。
- 對應舊 roadmap P2「沙盤劇本橋接（5-1）」：evaluator 匯入的 owners[] 一鍵轉開局盤面。
**前置**：M2-A（要 v2.0 的完整可重算 JSON，模擬器才有逐層/情境資料可吃）。
**Deliverable**：新模擬器頁；輸入一份 Core Result JSON → 走「評估→開局→推演→復盤」全程、零後端。
**驗收**：headless 測試（沿用 Node stub-DOM）跑新頁核心；瀏覽器實開；所有顯示數字可溯源到 JSON 欄位；
`bash check_no_real_names.sh` PASS；新頁不含任何計算公式（人工審 diff）。
**不做**：AI 地主（那是 P3 需 LLM）、後端、改 Core 公式。

### M2-D：文件與一致性收尾（可與上並行，多為機械性、可派 haiku）
- **D1**：補 `apps/web/README.md`（5 頁地圖）、`tools/README.md`（各腳本用途）、測試策略段（DOC-1/2/3）。
- **D2**：docs/redcf/、docs/methodology/ 10+ 份歷史文件批次加 `> [ARCHIVED 2026-07]` 頁首；
  兩舊庫 README 封存橫幅後補「以下為歷史保留」分隔（DOC-4）。
- **D3**：ARCH_REVIEW/MIGRATION_PLAN/FREEZE_REVIEW 的「四道門」統一為「五道 Gate」或加註。
- **D4**：命名規範文件（capacity.py 的 check_ vs calc_ 灰區記錄；不改碼，只立規範供未來遵循）。

### M2-R：重構（低優先，行為不變，全程 pytest 綠）
- **R1**：app.py `main()` 1068 行 → 拆 `_render_sX()`（TD-1，最大標的，純 UI）。
- **R2–R5**：KPI 樣板 helper、docgen 共用 helper、CSS 常數化（TD-4／§2）。
  ⚠️ 碰 core 公式層的拆分（calc_共同負擔/產生報告）需先過 pytest 且不可改邏輯，否則不動。

## 相依總覽

```
M2-A schema v2.0 ──► M2-C 新模擬器（要 v2.0 可重算 JSON）
        └──► M2-B packaging（可與 A 並行，但 A 先穩較好）
M2-D 文件、M2-R 重構：任何時候可並行（不阻斷主線）
```

## M2 完成標準

schema v2.0 凍結＋遷移器＋新模擬器可 demo＋pyproject 化＋文件一致性收尾 →
可發 `os-v0.2.0-beta`（走 CHECKLIST）。P3（AI/API/Agent repo）之開工 Gate 見 ARCHITECTURE ROADMAP。

## 明確不做（M2 禁區，沿用凍結）

不做 AI／Copilot／後端 API／FastAPI／資料庫／使用者系統；不改 Core 既有公式邏輯；
不重寫封版頁（simulator.html V4）；不動費率常數與黃金測試期望值（🔴 需使用者核准）。
