# RE-DCF Core ⇄ Urban-Renewal 介面對齊回覆

> **文件性質**：兩專案之介面契約紀錄（Interface Agreement Memo）
> **對象**：RE-DCF Core Engine 開發方
> **我方**：Urban-Renewal（儀表板／試算／沙盤，純前端靜態站）
> **依據契約**：`schemas/project_schema.json`（schema_version 1.0）
> **日期**：2026-07　**狀態**：Phase 1 我方已實作上線
> ⚠️ 本文件所有數字皆為**合成範例**，不含任何真實案件資料。貴方提供之真實案例僅於我方本機驗算，**不進版控**。

---

## TL;DR

| 問題 | 結論 |
|---|---|
| Q1 技術棧 | 我方純前端靜態站 → **純 JSON 交換**（不共用 npm/pip package） |
| Q2 owners[] 欄位 | 見下方規格表：**5 個 P1 必要欄**＋4 個選填欄，匿名代號、不放真實姓名 |
| Q3 串接方向 | **Phase 1 單向**（Core 匯出 → 我方顯示，已完成）；雙向回算屬 Phase 2 |
| Q4 匯入 API | 我方**無端點**，以**檔案**為介質——貴方 Tab⑤「下載案件 JSON」正是對接口，**已實測可用** |
| SSOT 原則 | **RE-DCF Core 是唯一計算來源**；我方只讀 `result`、不重算公式 ✅ 雙方一致 |

---

## Q1. 技術棧 → 純 JSON 交換

我方是**單一自含 HTML＋vanilla JS**：零依賴、零建置、無 Node/Python runtime、無伺服器，託管於 GitHub Pages。

- 共用 npm/pip package **不可行**（無套件管理與 build step）。
- **純 JSON 檔案交換是唯一且正確解**，也符合雙方共識的 Phase 1 定位（Phase 2 才有 FastAPI）。
- 未來若演進為 Urban Renewal OS（apps／core／modules／shared），Core 仍是貴方、我方仍只讀 JSON，**契約不需要改**。

## Q2. owners[]（地主清冊）欄位規格

**原則**：契約只放「**權利事實**」；展示層／CRM 欄位（人格、聯絡方式、談判備註等）由我方自行擴充、**不污染契約**。全部使用**匿名代號**，真實姓名不進契約。

| key | 型別 | P1 必要 | 說明 |
|---|---|---|---|
| `owner_id` | string | ✅ | 匿名代號（W01、W02…），不放真實姓名 |
| `land_share` | number(0–1) 或 `{num,den}` | ✅ | 土地持分——分回與同意門檻計算的根 |
| `pre_building_area_sqm` | number | ✅ | 更新前建物面積（0＝純空地持分） |
| `pre_value` | number(萬) | ✅ | 更新前權利價值（= `pre_renewal_value` 的逐戶拆分） |
| `consent` | enum `agreed / pending / opposed` | ✅ | 同意狀態（我方直接繪製同意率） |
| `min_unit_eligible` | bool | ○ | 是否達最小分配單元（未達 → 領補償金） |
| `return_value` | number(萬) | ○（回算後） | 逐戶分回價值 |
| `equalization` | number(萬) | ○（回算後） | 找補金（正＝補入／負＝找出） |
| `selected_units` | array | ○ | 選配戶別（Phase 2 選屋用） |

**計算關係**：逐戶分回 ＝ 以 `land_share`／`pre_value` 攤分 aggregate 的 `owner_return_value`。
**一致性約束（建議 Core 匯出時自檢）**：`Σ land_share ≈ 1`、`Σ pre_value ≈ result.pre_renewal_value`。

### owners[] 合成範例

```json
"owners": [
  { "owner_id": "W01", "land_share": 0.18, "pre_building_area_sqm": 210.5,
    "pre_value": 4716, "consent": "agreed",  "min_unit_eligible": true },
  { "owner_id": "W02", "land_share": 0.07, "pre_building_area_sqm": 0,
    "pre_value": 1834, "consent": "pending", "min_unit_eligible": true },
  { "owner_id": "W03", "land_share": 0.02, "pre_building_area_sqm": 33.0,
    "pre_value": 524,  "consent": "opposed", "min_unit_eligible": false }
]
```

> owners 為**空陣列**時的行為（已實作）：我方僅顯示總量、提示「逐戶分回待權利人清冊」，不會報錯。

## Q3. 串接方向

- **Phase 1（已完成）**：`RE-DCF 評估完 → 匯出 JSON → 我方匯入顯示／健檢`。單向。
- **Phase 2（未來）**：`我方權利人資料 → 回算 RE-DCF 權利變換` 需要貴方提供計算端點（FastAPI），現階段不做。
- **建議**：owners[] 欄位**現在就進契約**（如上表），Phase 2 開雙向時不必升破壞性版本。

## Q4. 匯入方式（已上線，歡迎實測）

我方無 API 端點，以檔案為介質。已在 `evaluator.html` 上線「**🔗 對接 RE-DCF Core**」區塊：

1. 開啟 `evaluator.html` → 捲到「🔗 對接 RE-DCF Core」（或導覽列點「🔗 對接 Core」）。
2. **上傳** Tab⑤ 匯出的 `.json`，或按「📋 改用貼上」貼 JSON；也可按「🧪 載入合成範例」看效果。
3. 頁面即顯示：
   - **Core 權威結果**（容積・坪效／財務・投報／估價 三組，英文 key 附註）——**只讀、不重算**；
   - **消費端健檢**：銷坪比 1.58–1.68 帶、容積餘量 < 0、共負比（含 **< 70% 具 100% 融資潛力**閘門）、§162 免計基準（僅顯示、不越權重判）、owners 空提示；
   - 「↧ 帶入教學試算欄位比對」：把 `land / building / finance` 映射到我方教學模型做交叉比對（明示教學近似，權威值以 Core 為準）。
4. 驗證規則：缺 `schema_version / project.name / project.renewal_type / result` 或 result 六個必要數值欄 → 顯示具體錯誤訊息。
5. **隱私**：匯入資料只留在使用者本機瀏覽器，不上傳、不入庫。

> 我方已以貴方提供之真實案例於本機完成整包驗算：`result` 全欄位可重現（容積鏈、總銷、共負比、報酬率、增值倍率），健檢正確標出銷坪比偏離與容積超出。**該檔案與數字均未進版控。**

---

## 給 Core 的 4 個契約建議（消費端視角）

1. **單位標註**：`used_floor_area`（㎡）與 `saleable_area`（坪）混用易誤讀——建議 key 帶單位（如 `saleable_area_ping`）或加 `units` metadata。
2. **Core 隨 result 附 `warnings[]`**：健檢（銷坪比偏離、容積超出、§162、共負異常）**你們算最準**。附上權威警告陣列，我方直接畫紅黃燈、不自行判斷，避免兩端邏輯分歧。建議格式：
   ```json
   "warnings": [
     { "code": "EFFICIENCY_OUT_OF_BAND", "level": "warn",
       "message": "銷坪比 1.70 高於正常帶 1.58–1.68", "field": "efficiency_ratio" }
   ]
   ```
3. **result 加 `computed_at`（ISO 8601）與 `core_version`**：追溯是哪一版公式算的（`schema_version` 已有，讚）。
4. **明訂 owners 為空的語意**：「總量可信、逐戶不可算」——我方已按此實作。

---

## 我方接下來要做的事（讓你們知道怎麼配合推進）

### 已完成 ✅
- Phase 1 匯入（檔案／貼上、合約驗證、SSOT 顯示、消費端健檢、比對帶入、合成範例）。

### 收到 owners[] 後，我方立即做（仍屬 Phase 1、純前端）
1. **逐戶分回表**：owner_id × 持分 × 更新前價值 × 分回價值 × 找補金，含 `Σ` 一致性自檢。
2. **同意率視覺化**：以 `consent` 統計同意比例，對照都更／危老門檻（§37、危老 100%）畫達標線。
3. **沙盤劇本橋接（評估→整合演練）**：把 owners 的「持分結構＋同意狀態」轉成 simulator 的**匿名開局盤面**（例：高持分未同意者 → 樞紐戶），讓「Core 評估完的案件」可以直接拿去做整合推演。只讀、單向、不回寫。

### 需要貴方提供的（依優先序）
| # | 事項 | 用途 |
|---|---|---|
| 1 | **2–3 個 Tab⑤ 匯出檔**（可去識別化）壓測 | 驗匯入相容性與邊界（危老／都更、有無容移、共負高低各一） |
| 2 | **owners[] 開始填資料**（P1 必要 5 欄即可） | 解鎖上面三項功能 |
| 3 | `warnings[]`＋`computed_at`／`core_version` | 我方改讀權威警告、停用自判 |
| 4 | schema 破壞性變更時**先知會**（bump `schema_version`） | 我方驗證器同步升版 |

### 明確不做（邊界）
- ❌ 我方不重算任何 Core 公式（SSOT 尊重）。
- ❌ Phase 2（FastAPI／雙向回算／AI）在 V4 產品線穩定前不啟動。
- ❌ 真實案件之姓名、地號、金額不進任何一方的版控。

---

## 附：完整合成範例（可直接餵我方匯入功能測試）

```json
{
  "schema_version": "1.0",
  "project": { "name": "（合成範例）示範段", "renewal_type": "urban_renewal" },
  "land": {
    "site_area_sqm": 1200, "plaza_area_sqm": 0, "far": 2.25,
    "bonus_ratio": 0.35,
    "bonus_breakdown": { "時程": 0.10, "規模": 0.10, "基本": 0.15 },
    "tdr_transfer_sqm": 300
  },
  "building": { "public_ratio": 0.33, "stair_hall_exempt_pct": 8, "balcony_exempt_pct": 10, "unit_count": 40 },
  "owners": [
    { "owner_id": "W01", "land_share": 0.18, "pre_building_area_sqm": 210.5, "pre_value": 4716, "consent": "agreed",  "min_unit_eligible": true },
    { "owner_id": "W02", "land_share": 0.07, "pre_building_area_sqm": 0,     "pre_value": 1834, "consent": "pending", "min_unit_eligible": true },
    { "owner_id": "W03", "land_share": 0.02, "pre_building_area_sqm": 33.0,  "pre_value": 524,  "consent": "opposed", "min_unit_eligible": false }
  ],
  "finance": {
    "residential_price": 60, "shop_area": 80, "shop_price": 84,
    "parking_count": 50, "parking_price": 200, "construction_price": 19
  },
  "result": {
    "baseline_far": 2700, "allow_floor_area": 3945, "used_floor_area": 3820,
    "remaining_floor_area": 125, "stair_exempt_cap": 591.75, "balcony_exempt_area": 410,
    "saleable_area": 1985, "efficiency_ratio": 1.66,
    "total_sales": 139500, "shared_cost": 80910, "shared_cost_ratio": 0.58,
    "owner_return_value": 58590, "owner_return_ratio": 0.42, "return_rate": 0.724,
    "pre_renewal_value": 26200, "value_multiple": 2.26
  }
}
```

> 註：範例中 owners 僅列 3 戶示意（Σ land_share 未滿 1 屬正常——示意用途）；正式匯出請補滿全體權利人並通過 Σ 自檢。

---

*版本 1.0｜2026-07｜Urban-Renewal 側介面紀錄。合約以 `schemas/project_schema.json` 為準；本文件為消費端之對齊回覆與需求清單。全文合成範例，不含真實案件資料。*
