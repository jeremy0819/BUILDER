# os-v0.2.0-beta — Urban Renewal OS（Contract Foundation）

> 這份內容可直接貼進 GitHub Release 的說明欄。Target 選 `release/os-v0.2.0-beta`（或 `os-v0.2.0-beta` tag）。
> tag 由 repo 擁有者於 GitHub UI 建立（本開發環境 egress 政策擋 tag push）。

## 這個版本是什麼
M2 = **合約基礎（Contract Foundation）**。把 alpha 時仍會漂移的資料合約升級成
**schema v2.0「完整可重算合約」並正式凍結**，同時收斂出穩定的 Core 對外介面。
**beta 定位**：合約已凍結、可對接；逐戶權變/找補（M3）與 IRR/現金流（M4）尚未實作。

## 三大內容

### 1. Schema v2.0（完整可重算合約，已凍結）
- 新增逐層 `input.floors[]`——補上 v1.1 的重算缺口，**給 Core 此檔即可回放出 result**。
- `provenance`：`input_hash`（sha256 溯源指紋）＋`core_version`＋`law_db_version`。
- **三視圖**：`schemas/v2/{input,output,metadata}.schema.json`，委派單一權威檔
  `project_schema_v2.json#/$defs`（架構 D4：不分叉合約），消費端可單獨驗證任一區塊。
- **凍結守衛**：CI Gate 6（`tools/check_schema_freeze.py`）鎖 v1.1＋v2.0＋三視圖位元組。
- **遷移器**：`core/redcf/migrations.py` 鏈式 1.0→1.1→2.0（舊檔缺 floors→`input_complete:false`）。

### 2. Core Interface（穩定四動詞）
`core/redcf/api.py`：`calculate()` / `validate()` / `serialize()` / `deserialize()`——
消費端只依賴這層，內部函式名可演進。**零新公式**（門面委派既有 core.calc_*）。

### 3. UX Foundation ＋ Simulator Foundation
- **Dashboard**（`apps/web/index.html`）：逐層樓板表、可重算驗證徽章、provenance 溯源列、跨案比較。
- **URBAN STRAND**（`apps/web/os-simulator.html`）：整合模擬器——PLAN PHASE（開發模式×建築規模
  ↔ 整合關係的「宇宙關聯」）、整合進度旅程軌、S1–S11、家族羈絆、CODEC。財務格為 Core 烘焙的唯讀值。
- **UI Binding Map**（`docs/architecture/UI_BINDING_MAP.md`）：每個 UI 數字綁到 `result.*` 與 core 來源。

## 已知限制（測試員先知道，不必回報）
- 逐戶權利變換/找補、owners 輸入 UI 排 **M3**；IRR/NPV 排 **M4**——相關欄位可能為空。
- 模擬器遊戲層（住戶說服/AP/週）是敘事機制，非 Core 數字；PLAN PHASE 財務格才是 Core 值。
- 教學層數字仍為示意；權威數字一律以 `result` 欄位為準。

## 怎麼測
```bash
python -m pytest -q                    # 33 passed
node tests/web/test_os_simulator.mjs   # URBAN STRAND 24 passed
python tools/check_schema_freeze.py    # schema 凍結守衛
```
用 `schemas/examples/v2/` 的合成範例，零真實資料。回報進 GitHub Issues，**勿貼真實案件地號/姓名/金額**。

## 基準
- Core `0.2.0`／schema `v2.0`（凍結 hash `f1c466a3…df38e6b1`）。
- CI：Gate0–Gate6 ＋ Gate1.5 全綠。
- 驗收：`docs/releases/M2_CLOSE_REPORT.md`（七項 FINAL REVIEW 全 PASS）。
- 下一步：**M3 — Rights & Compensation**（權利變換/找補 + owners UI），走 schema v2.x 升級流程。
