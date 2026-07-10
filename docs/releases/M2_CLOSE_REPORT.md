# M2 CLOSE REPORT — Contract Foundation（schema v2.0 ＋ Core Interface）

> 對象：M2 FINAL REVIEW 的七項驗收。每項給「結論 + 證據（可自行重跑的指令/檔）」。
> 版本座標：Core `0.2.0`／schema `v2.0`（凍結）／預備發布 `os-v0.2.0-beta`。
> 日期：2026-07-10。

---

## 驗收總表

| # | 驗收項 | 狀態 | 證據 |
|---|---|---|---|
| 1 | **Schema v2 frozen** | ✅ PASS | `tools/check_schema_freeze.py`（Gate 6）5 檔 hash 相符 |
| 2 | **Core API stable** | ✅ PASS | `core/redcf/api.py` 四動詞＋`tests/test_api.py` |
| 3 | **Packaging ready** | ✅ PASS | `pyproject.toml`＋CI Gate 1.5（clean import） |
| 4 | **UI Binding complete** | ✅ PASS | `docs/architecture/UI_BINDING_MAP.md` |
| 5 | **Simulator architecture ready** | ✅ PASS | `os-simulator.html` SIMCORE＋`test_os_simulator.mjs`（Gate 5） |
| 6 | **No UI calculation** | ✅ PASS | Gate 2 隔離＋UI 只讀 `result.*`＋SIMCORE 零財務公式測試 |
| 7 | **No Core logic change** | ✅ PASS | 黃金測試不變（`test_golden.py` 綠）；api 為門面不含公式 |

全體：**PASS → 建議進入 M3**。下方逐項展開。

---

## ⚠️1 Schema v2 正式凍結

**結論**：已凍結，並補上使用者要求的 input/output/metadata 三視圖與 version/migration/validation。

**架構取捨（誠實交代）**：使用者要求 `schemas/input.schema.json`、`output.schema.json`、
`metadata.schema.json` 三個獨立檔。架構凍結裁決 **D4 明確否決把合約拆成多個獨立來源檔**
（避免多份 schema 各自漂移）。折衷方案——**單一權威檔 + 三視圖委派**，同時滿足兩邊：

- **單一權威檔**：`schemas/project_schema_v2.json`，內含 `$defs.input` / `$defs.output` /
  `$defs.metadata` 三段實體定義（D4 不破）。
- **三視圖檔**：`schemas/v2/input.schema.json`、`output.schema.json`、`metadata.schema.json`，
  每個只有一行 `$ref` 指回權威檔的 `$defs`（零重複、共用同一 `schema_version`）。
  消費端要單獨驗證某一區塊時，用視圖檔；`core.redcf.api.validate(doc, view='output')` 直接支援。

**version / migration / validation 三要素**：

| 要素 | 落點 | 驗證 |
|---|---|---|
| version | `schema_version: "2.0"`（const）＋凍結 hash | `check_schema_freeze.py`（Gate 6） |
| migration | `core/redcf/migrations.py` 鏈式 1.0→1.1→2.0 | `test_schema_v2.py::test_v1_1_遷移到_2_0`、`test_遷移具冪等性` |
| validation | `api.validate()`＋`schemas/v2/*.schema.json` | `test_api.py`（整份＋三視圖＋壞值攔截） |

**凍結 hash**（唯一來源＝`tools/check_schema_freeze.py` `FROZEN` 表）：

```
v1.1  schemas/project_schema.json      e37e10db…d4a96
v2.0  schemas/project_schema_v2.json   f1c466a3…8e6b1
      schemas/v2/input.schema.json     b420313e…19ae2
      schemas/v2/output.schema.json    1d5445f8…547f3
      schemas/v2/metadata.schema.json  6bb6694a…68348d
```

證據：`python tools/check_schema_freeze.py` → 5 檔全部相符。

## ⚠️2 Core Interface

**結論**：已從「裸函式 A/B/C」收斂成四動詞穩定門面 `core/redcf/api.py`。

| 動詞 | 語意 | 內部委派（零新公式） |
|---|---|---|
| `calculate(engine)` | 從輸入快照重算 result（唯一計算入口） | `recompute.recompute` → `contract.build_result_json` |
| `validate(doc, view=…)` | 結構 + 可重算雙重驗證 | `jsonschema` ＋ `recompute.verify` |
| `serialize(doc, path=…)` | dict → 正規化 JSON（可寫檔） | `json.dumps` |
| `deserialize(data)` | JSON/路徑/dict → 正規化到 2.0 | `migrations.migrate` |

四動詞已於 `core/redcf/__init__.py` 匯出，可 `from core.redcf import calculate, validate, serialize, deserialize`。
證據：`tests/test_api.py`（14 案，含 calculate 逐欄位重現、三視圖驗證、竄改 result 被 recompute 抓出）。

## ⚠️3 UI Binding Map

**結論**：`docs/architecture/UI_BINDING_MAP.md` 已建，三層鏈 `UI → result.field → core 函式`。

- Dashboard 每張卡/長條/甜甜圈/warnings/溯源列皆登記綁定。
- 模擬器 PLAN PHASE 財務格綁 `SCEN`（Core 烘焙的唯讀值），遊戲層零財務公式。
- M3 owners UI 的輸出綁定**先行固定**（`input.owners[]` + `OWNERS_*` warnings），避免 M3 臨時發明欄位。

範例（節錄）：

| UI | Source（`result.*`） |
|---|---|
| 容積卡 | `allow_floor_area` / `remaining_floor_area` |
| 財務卡 | `return_rate` / `owner_return_ratio` / `total_sales` |
| 共負甜甜圈 | `shared_cost_ratio` |
| Risk/健檢 | `warnings[]`（code/level/field） |

## ⚠️4 M2 Release os-v0.2.0-beta

**結論**：發布說明已備 `docs/releases/RELEASE_NOTES-os-v0.2.0-beta.md`，內容涵蓋
Schema v2 / UX Foundation（Dashboard）/ Simulator Foundation（URBAN STRAND）。
tag 需 repo 擁有者於 GitHub UI 建立（本環境 egress 政策擋 `refs/tags/*` push）。

---

## 七項 FINAL REVIEW 逐項

- ☑ **Schema v2 frozen** — Gate 6 hash 守衛，5 檔位元組鎖定。
- ☑ **Core API stable** — 四動詞門面 + 測試；簽章往後只增不改。
- ☑ **Packaging ready** — `pyproject.toml`（`redcf-core` 0.2.0）＋Gate 1.5 clean-import。
- ☑ **UI Binding complete** — UI_BINDING_MAP.md 全綁定。
- ☑ **Simulator architecture ready** — SIMCORE 純邏輯區塊 + 24 headless 測試 + PLAN/整合宇宙關聯。
- ☑ **No UI calculation** — Gate 2 Core 隔離；前端只讀 `result.*`；SIMCORE 零財務公式；門檻讀 `warnings`。
- ☑ **No Core logic change** — 黃金測試期望值未動（`test_golden.py` 綠）；api/recompute/migrations 皆不含公式。

## 全綠證據（可重跑）

```bash
python -m pytest -q                      # 33 passed（含 test_api 14、test_schema_v2）
node tests/web/test_os_simulator.mjs     # URBAN STRAND 24 passed
python tools/check_schema_freeze.py      # 5 檔 hash 相符（Gate 6）
python tools/check_core_isolation.py     # Gate 2 Core 零 UI 依賴
bash check_no_real_names.sh              # 資料紀律 PASS
```

## 裁決

**M2 FINAL REVIEW：七項全 PASS。** 建議正式關閉 M2、進入 **M3（Rights & Compensation：
權利變換/找補 + owners 輸入 UI）**。M3 第一動＝在 `core/redcf/` 新增權變公式並走 schema v2.x
升級流程（新版本 + 遷移器 + 更新 `check_schema_freeze.py` 基準），UI 綁定依 UI_BINDING_MAP §3。

> 待辦（不阻擋 M2 關閉，交還 repo 擁有者）：於 GitHub UI 建立 `os-v0.2.0-beta` release
> （本環境無法 push tag）。發布前逐項對 `docs/releases/CHECKLIST.md` 打勾。
