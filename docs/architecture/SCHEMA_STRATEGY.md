# Schema 策略：版本、相容、遷移（隨 Architecture Freeze 凍結）

> 檔案形態裁決見 ARCHITECTURE.md D4：單一 `project_schema.json` ＋ `$defs`，不拆七檔。
> 現行 v1.1 **凍結中**（基準 sha256 見 RE-DCF《歷史乾淨度報告.md》），本檔規劃的 v2.0 在
> **P1（合併完成後）**才動工。凍結期任何 schema 需求 → 記 backlog，不動檔案。

---

## 1. 版本規則（Semver on `schema_version`）

| 變更類型 | 版本動作 | 例 |
|---|---|---|
| 純新增 optional 欄位 | minor bump（1.1 → 1.2） | v1.0→v1.1 加 warnings[]/owners[] |
| 改名、改型別、改必填、刪欄位、重構 | **major bump**（1.1 → 2.0） | v2.0 輸入區塊重構 |
| 修 description/註解（不影響驗證） | patch，不 bump `schema_version` 欄位 | — |

紀律（維持既有拍板＋補強）：
- major 變更前先知會所有消費端（monorepo 後＝同 commit 內完成全部消費端適配＋測試綠才算完）。
- `schema_version` 是**資料檔內欄位**（消費端據此分流），schema 檔本身以 `$id` 加版本錨點。
- 消費端必須宣告支援範圍（如 evaluator：支援 1.0–2.x；1.0 檔顯示「舊格式」橫幅——既有行為，維持）。

## 2. v2.0 設計目標（D3：完整可重算文件）

一句話：**Project JSON 檔案本身就是完整案件紀錄**——給 Core 這個檔，Core 必須能重算出一樣的 result。

```
project.json (v2.0)
├── schema_version: "2.0"
├── project:   { id, name(代號), case_type }
├── input:                              # ★ 重算所需的全部輸入，一項不缺
│   ├── site: {…}                       # 基地（使照面積、分區、容積率…）
│   ├── floors: [ {樓層, 樓板, 圖說計入, 梯廳, 安全梯, 陽台} ]   # ★ v1.1 最大缺口
│   ├── plan: { 獎勵拆解, 容積移轉, 公設比, 外皮係數 }
│   ├── finance: { 單價, 六科目費率, 貸款參數 }
│   ├── owners: [ … ]                   # v1.1 九欄規格照搬進 input
│   └── scenario: { name, overrides }   # 顯式情境（baseline 可省略 overrides）
├── result:                             # Core 輸出（消費端只讀）
│   ├── capacity / efficiency / shared_cost / valuation
│   ├── rights_exchange / cashflow      # P2 落地前為 null
│   └── warnings: [ {code, message, severity} ]
└── provenance:                         # 溯源（不可變）
    ├── core_version / computed_at      # v1.1 已有
    ├── input_hash                      # ★ 新增：sha256(input 區塊正規化序列化)
    └── law_db_version                  # ★ 新增：法規資料版本
```

驗收定義（v2.0 完成的黃金判準，寫進測試）：
`load(project.json) → core.recompute(input) → 與檔內 result 逐欄位相等（容差 0.5 m²/既有標準）`，
對 `schemas/examples/` 全部範例成立。

## 3. 向下相容與遷移

- **遷移器住在 Core**：`core/redcf/migrations.py` 提供 `migrate(doc) -> doc`（1.0→1.1→2.0 鏈式）。
  消費端**不得**各自寫轉換邏輯（那是公式複製的近親）。
- 1.x 檔案缺 floors → 遷移後標 `input_complete: false`，result 保留但標「不可重算之歷史檔」；
  消費端照舊顯示（evaluator 既有的 1.0 橫幅模式推廣為通則）。
- 每個 major 版本附 fixture 測試：舊版範例檔 → migrate → 新 schema 驗證通過。
- 廢止政策：最多同時支援兩個 major（2.x 上線後 1.x 只讀不寫；3.0 上線時 1.x 停止支援）。

## 4. 弱模型 session 的操作規則

1. 凍結期（現在）：**任何**修改 `schemas/project_schema.json` 的念頭 → 停，記 backlog，問使用者。
2. v2.0 動工時：先寫 fixture 與驗收測試（§2 黃金判準），再改 schema，最後改消費端——同一 commit。
3. 改 schema 後必跑：`pytest`（合約測試）＋ headless（消費端）＋ examples 重新生成
   （`schemas/examples/generate_examples.py`）。
4. 禁止在 schema 裡發明本檔未規劃的頂層區塊；新需求＝先改本檔（🔴 需使用者核准）再改 schema。
