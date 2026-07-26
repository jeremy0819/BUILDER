# 開發指南（Developer Docs）

> 從 README 移出的技術細節。README 偏產品「怎麼用」，本檔講「怎麼開發」。

## 專案結構

| 目錄 | 內容 |
|---|---|
| `core/redcf/` | **唯一計算核心（SSOT）**——容積／坪效／財務／權變／現金流／決策引擎／策略引擎 |
| `schemas/` | 凍結的合約（12 份，位元組不可變，Gate 6 守衛） |
| `apps/web/` | 靜態站：駕駛艙／沙盤／決策報告（純呈現，零計算） |
| `apps/streamlit/` | Streamlit 精確計算介面（消費 core，不含公式） |
| `tools/` | 建置與守衛腳本（bundle、示範案生成、各 Gate 檢查） |
| `tests/` | pytest（Python）＋ `tests/web/`（node headless） |
| `docs/`, `governance/`, `knowledge/` | 架構、治理、領域知識 |

## 本機啟動

```bash
pip install -r requirements.txt
pip install -e .                       # 套件可安裝性（Gate 1.5 亦驗此項）

streamlit run apps/streamlit/app.py    # 精確計算介面
# 靜態站：直接開 apps/web/index.html（部分功能需 http server）
python -m http.server 8000 -d apps/web # 建議：Pyodide 需同源載入 worker
```

15 分鐘上手見 [`GETTING_STARTED.md`](GETTING_STARTED.md)。

## 測試

```bash
python -m pytest -q                    # 目前 118 項
node tests/web/test_os_simulator.mjs   # 沙盤遊戲核心 86 項
node tests/web/test_workspace.mjs      # 工作區 49 項
```

## CI 十一道 Gate

定義於 `.github/workflows/ci.yml`，**任一紅即擋 merge**。

| Gate | 檢查 | 腳本 |
|---|---|---|
| 0 | 資料紀律：真實段名零命中 | `check_no_real_names.sh` |
| 1 | pytest ＋ `min_example.py` ＋ 套件安裝性 | — |
| 2 | Core 零 UI 依賴（封鎖 streamlit/plotly 後仍可算） | `tools/check_core_isolation.py` |
| 3 | Excel 範本迴歸 | `tools/check_template.py` |
| 4 | 靜態站連結無死鏈 | `tools/check_web_links.py` |
| 5 | 沙盤遊戲核心 headless | `tests/web/test_os_simulator.mjs` |
| 6 | schema 凍結（位元組級） | `tools/check_schema_freeze.py` |
| 7 | 工作區 headless | `tests/web/test_workspace.mjs` |
| 8 | 圖檔白名單（文字掃描補洞） | `tools/check_image_whitelist.py` |
| 9 | `core-bundle.js` 與 `core/redcf` 同步 | `tools/check_core_bundle.py` |
| 10 | 前端版本徽章與 Core／tag 一致 | `tools/check_web_version.py` |

本地一次跑完：

```bash
bash check_no_real_names.sh && python -m pytest -q && python min_example.py \
  && python tools/check_core_isolation.py && python tools/check_template.py \
  && python tools/check_web_links.py && node tests/web/test_os_simulator.mjs \
  && python tools/check_schema_freeze.py && node tests/web/test_workspace.mjs \
  && python tools/check_image_whitelist.py && python tools/check_core_bundle.py \
  && python tools/check_web_version.py
```

## 建置腳本

```bash
python tools/build_core_bundle.py      # 打包 core → apps/web/core-bundle.js（Pyodide 用；改 core 後必跑）
python tools/build_demo_rosters.py     # 重新生成合成示範案 A/B/C（含產權清冊、view、cashflow）
```

> 兩者皆為**衍生產物**，由 Gate 9 / 測試守衛，不得手改。

## 開發紅線

1. **公式只寫在 `core/redcf`**——前端、Streamlit、沙盤一條都不准寫。
2. **凍結 schema 位元組不可變**。要改＝走版本升級（新檔＋新版本號＋遷移器＋更新三處 hash 基準：
   `tools/check_schema_freeze.py`、`governance/VERSION_POLICY.md`、`docs/releases/CHECKLIST.md`）。
3. **零真實案件資料進版控**（含檔名與 commit 訊息）。真實校準只放 `/local_calibration/`（gitignored）。
4. **改公式必跑 `pytest`**，不綠不 commit。
5. **`simulator.html` V4 封版**，不重寫。
6. **呈現層零推論**：畫面只呈現 Core／Workflow／Decision／Strategy 的輸出，不自行發明邏輯。
   （限制的是「權威」不是「頻率」——即時呼叫 Core 完全合規。）

## 版本座標

| 版本 | 載體 | bump 時機 |
|---|---|---|
| `CORE_VERSION` | `core/redcf/_version.py` | 計算公式／費率／合約結構變動 |
| `ENGINE_VERSION` | `core/redcf/decision.py` | 決策引擎邏輯變動 |
| `STRATEGY_ENGINE_VERSION` | `core/redcf/strategy.py` | 策略引擎邏輯變動 |
| schema 版本 | 各 schema 檔內 | 加選填欄＝minor；改名／改型別／改必填＝major |
| OS Release | git tag `os-vX.Y.Z` | 每次正式發布 |

規則詳見 [`governance/VERSION_POLICY.md`](../governance/VERSION_POLICY.md)。
