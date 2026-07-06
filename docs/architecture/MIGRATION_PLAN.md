# 合併搬遷計畫（P0 操作手冊——寫給執行搬遷的弱模型 session）

> 原則：**搬家不是改建**。本手冊只搬、不改功能。每一步有驗收指令，紅了就停在該步，不往下走。
> 策略依據：乾淨快照（兩庫 git 歷史含真實資料，不保留歷史）；基準點＝RE-DCF commit `ea0fe9b`
> （遠端 ref＝分支 `premerge-v0.2.0`；⚠️ tag `v0.2.0-premerge` 只存在本地、尚未推上遠端，
> 正式 tag 待 repo 擁有者補推——不要用 `git checkout v0.2.0-premerge`，會失敗）。

---

## 步驟 0 — 開工前檢查（任何一項不過 → 回報使用者，不開工）

```bash
# 在兩個舊庫各自執行
bash check_no_real_names.sh                                     # 兩庫都要 PASS
cd RE-DCF-Tool && pip install -r requirements.txt && pytest     # 全綠
sha256sum RE-DCF-Tool/schemas/project_schema.json               # 等於乾淨度報告的凍結 hash
```

## 步驟 1 — 快照搬入（只 copy，不改內容）

| 來源 | 目的地 |
|---|---|
| RE-DCF `core/` | `core/redcf/` |
| RE-DCF `schemas/` | `schemas/` |
| RE-DCF `test_golden.py` | `tests/test_golden.py` |
| RE-DCF `app.py`＋`.streamlit/` | `apps/streamlit/` |
| RE-DCF `make_template.py`＋Excel 範本 | `tools/` |
| RE-DCF 其餘 docs（ROADMAP/CHANGELOG/REVIEW/檢核/交接文件） | `docs/redcf/` |
| Urban-Renewal 5 個 HTML＋產生器 py＋pptx/docx 產物 | `apps/web/`（產生器進 `tools/`） |
| Urban-Renewal `docs/` | `docs/methodology/` |

**不搬**：`calc_engine.py`、root `law_db.py`（shim，就地淘汰）、`啟動工具.bat`（路徑會變，重寫）、
兩庫 `.git`、已被取代的舊 MERGE_PLAN 類文件、`供py/`（本來就不在版控）。

## 步驟 2 — 機械修正（唯一允許的「改」）

1. `core/redcf/` 內部 import 前綴：`from core.xxx` → `from core.redcf.xxx`（批次，機械性）。
2. `apps/streamlit/app.py`：`from calc_engine import` → `from core.redcf import`；
   `from law_db import` → `from core.redcf.law_db import`。
3. `tests/`、`tools/` 同步改 import 與相對路徑。
4. `apps/web/` 頁面間相對連結修正＋`.nojekyll`。
5. 版號抽常數（RE-DCF 技術債「UI 版號散落 4 處」——搬家時順手做，這是清單上唯一的順手項）。

**驗收**：`pytest` 全綠；`python -c "import core.redcf"` 於無 streamlit 環境成功；
`python tools/make_template.py` 能重產 Excel；瀏覽器開 `apps/web/index.html` 正常。

## 步驟 3 — CI 建立（P0 的新增物，唯一例外於「只搬不建」）

`.github/workflows/ci.yml` 四道門（每次 push 全跑）：
```
1. pytest（黃金＋合約測試）
2. bash check_no_real_names.sh → FAIL 即擋（真實段名檢查）
3. headless 迴歸（apps/web，沿用 Urban-Renewal 的 Node stub-DOM 測試法）
4. schema 凍結 hash 比對（v2.0 上線後改為 schema 驗證測試）
```
理由：所有品質門檻目前只存在於「文件＋人的記憶」。session 會換、會忘；CI 不會。

## 步驟 4 — 部署切換（需使用者操作的兩件事）

1. GitHub Pages：Settings → Pages → 指向本庫 `apps/web/`（或 root＋路徑調整）。
2. Streamlit Cloud：新增本庫 app，主檔 `apps/streamlit/app.py`；**下架舊 RE-DCF 部署**
   （舊 URL 曾顯示真實案名——乾淨度報告殘留風險 #3）。
3. 舊庫轉私有封存＋README 指向新庫。

## 步驟 5 — 收尾驗收（全綠才宣告合併完成）

```
□ CI 四道門全綠
□ Pages 網址開得起來，5 頁互鏈不斷
□ Streamlit Cloud 載入案例C，L2→L6 帶數字
□ evaluator「對接 Core」匯入 schemas/examples/ 任一檔成功
□ check_no_real_names.sh PASS（另抽查新庫全部 commit 訊息無真實段名）
□ 兩舊庫已封存、舊 Streamlit URL 已下架
```

## 失敗處理

- 任一步驟驗收紅 → 修到綠才走下一步；同一步驟卡 2 輪 → 按 governance/MODEL_DISPATCH §4 升級或問使用者。
- 發現任何真實案件字串 → **立即停止**，不 commit，回報使用者（這是唯一的「全線停車」事件）。
