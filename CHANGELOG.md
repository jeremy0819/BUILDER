# CHANGELOG — Urban Renewal OS（core/redcf）

> 記錄 CORE_VERSION 的每次變動（VERSION_POLICY：公式、費率、law_db、合約結構變動才 bump）。
> UI 版本（app.py v4.x）與 OS release tag（os-vX.Y.Z）另有軸線，不在此表。

## 0.3.0 — 2026-07-12（M3・Rights & Compensation 第一批）

- **新增** `core/redcf/rights.py`：`calc_權利變換`（都更條例 §56——依更新前權利價值
  比例分配更新後可分配總值 → 逐戶 `return_value`）、`calc_找補`（equalization ＝
  選配 − 分回；正=補入/負=找出；未選配=None）、`build_owner_allocations`。
  結構性分配公式，**零校準費率**；更新前價值之路寬/分區/建物型態係數待使用者核准。
- **合約** schema **v2.1**（minor：純選填新增）：`input.owners[]` 逐戶欄位定義
  （含 `selected_value`）＋ `result.owner_allocations[]`；權威檔
  `schemas/project_schema_v2_1.json`（凍結，Gate 6）；遷移鏈補 `2.0 → 2.1`。
- **recompute**：owners 帶 `pre_value` 時附逐戶分回表（委派 rights.py，本體零公式）。
- 既有黃金測試期望值**零變動**；v2.0 檔案位元組不變（凍結維持）。

## 0.2.0 — 2026-07（M1–M2 基準）

- 三庫合併後的計算核心基準：容積查核（§162）/坪效/共同負擔 L6/投報/估值；
  schema v2.0 完整可重算合約（recompute/verify/input_hash）；遷移鏈 1.0→1.1→2.0；
  四動詞門面 `api.py`。詳見 `docs/releases/M2_CLOSE_REPORT.md`。
