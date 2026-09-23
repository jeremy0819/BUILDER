# 0.7.0 Visualization Foundation

狀態：Schema Audit 已完成；正式契約仍為 Proposal；隔離原型可驗證，不是正式 Viewer。
日期：2026-09-23。稽核基準：本機 `edf920c`，Core 0.6.0。
本文件承接使用者的新版規格與「手動輸入地籍／描繪基地」構想，不修改 frozen schema。

## 1. Schema Audit

| 權威位置 | 已有 | 缺少／不得推論 |
|---|---|---|
| `schemas/project_schema_v2_1.json` input.site | 基地面積、容積與獎勵參數 | 邊界 polygon、座標系、實測精度 |
| 同檔 input.floors；`core/redcf/recompute.py` | 樓層標籤、面積、計容積與免計面積欄位 | 穩定 floor_id、標高、層高、平面、用途幾何 |
| 同檔 result | Core 容積、坪效、財務、逐戶分回 | Building footprint、height、Spatial LOD |
| `schemas/household_outcome.schema.v0.1.json` | 逐戶 before/after/delta、input_hash | unit polygon、正式選配關係、獨立 selection provenance |
| `core/redcf/allocation.py` | 按產品條件產出 eligible_units | 候選戶型不是已分配戶別；不可轉為空間定位 |
| `apps/web/massing-view.js`、`site-massing.js` | 面積比例與逐層呈現 | 圖形版面尺寸不是真實建築長寬高 |

結論：既有案件資料最高只能稱 Area / Floor Diagram，不能宣稱 Spatial LOD 0。
沒有邊界、footprint 或 height，不得以正方形基地、均分樓層、標準層高補足。
Schema 寬鬆接受未知欄位不代表那些欄位已成為正式契約。

## 2. Capability Level

BUILDER Spatial LOD 是內部能力分級，不宣稱等同 BIM／CityGML 等標準。

| 能力 | 必備資料 | 可啟用 |
|---|---|---|
| Diagram | 既有面積／樓層資料 | 面積比較、表格；不畫真實配置 |
| Spatial LOD 0 | 經驗證的 site geometry、building footprint、height 及來源 | 單棟或多棟唯讀量體、俯視、來源查閱 |
| Spatial LOD 1 | LOD 0 + floor_id、elevation、floor_height、floor_geometry、usage、來源 | 逐層切片、用途圖例、圖表對照 |
| Spatial LOD 2 | LOD 1 + unit_id、unit_geometry、正式 household/unit mapping、allocation provenance | 點選實際單元並連到有效的逐戶結果 |

Capability 必須由正式驗證層產出；UI 只消費，不能用欄位猜測或用上市日期決定。
Prototype 的 synthetic 圖形只驗證技術，不替任何案件取得以上能力資格。

## 3. Visualization Contract Proposal

建議新增獨立 Presentation 契約，不編輯既有 Project 或 Household 凍結檔。
以下欄位是提案，不是本輪新增的正式 schema 或已接受輸入。

| 區塊 | 擬定欄位／規則 |
|---|---|
| 版本 | `schema_version`、`validator_version`；新檔、新基準、新 fixture，經核准才凍結 |
| 綁定 | `case_id`、`input_hash`、`core_version`；`scenario_id` 僅在可解析至既有 Scenario 時填寫 |
| 幾何來源 | `geometry_source`、`geometry_source_version`、`geometry_hash`、`unit`、`coordinate_system`、`generated_at` |
| 座標細節 | 水平座標系與 axis order、垂直基準、local origin（適用時）；local 座標不得冒充可套地籍圖 |
| 可用性 | `capability`、`validation_status`、`missing_fields`、`reason_codes`、逐物件 source_ref |
| 幾何資料 | site.boundary、buildings[].id/footprint/height；floors、units 只在其能力級別存在 |
| 指標引用 | 對既有 result 的路徑與有效來源綁定；不得另存可獨立編輯的容積／財務副本 |
| 不確定性 | source_date、accuracy（unknown 可明示）、review_status、適用範圍；人工採用不代表測量精度已證實 |

`input_hash != geometry_hash`：前者識別 Core 輸入，後者識別空間內容，任何一方更新都使舊關聯失效。
正式 scene identity 至少包含 contract version、case/scenario、input_hash、core_version、geometry_hash 及 source version。
timestamp 不是 hash，也不拿渲染時間冒充幾何來源或 Core 計算時間。

幾何 hash 提案：採用明定的 canonical 數值／鍵排序／字元編碼，涵蓋單位、座標基準、物件 ID、座標與高度。
不得自行四捨五入或為去重改變邊界。環方向、閉合方式、洞與 MultiPolygon 的正規化須在正式契約定案並跨語言測試。
本輪 `fixture.mjs` 的 hash 僅處理受控合成 fixture，不可直接升格為通用地籍 canonicalizer。

## 4. Selection Provenance Proposal

現有 household schema v0.1 不變。未來以版本化 envelope 關聯原結果，至少包含：

- case_id / scenario_id / input_hash / core_version。
- allocation_engine_version、product_input_hash、before_map_hash、selection_input_hash。
- outcome_hash、computed_at，以及正式 mapping 的來源與版本。
- 使用到的產品單價、公設比、坪型、車位等完整輸入需可回放；hash 不是輸入備份。
- 未進行實際選屋時 mapping 缺席，顯示「尚無實際選配」，不建立假 unit_id。

同一份 Core result 配上不同產品或選配條件，可以產生不同 household outcome。
單憑 input_hash 相同不夠；相同候選戶型也不代表多人被配置至同一實體住宅。
一戶多單元、多權利人等關係須獨立定義，不能預設為一對一。

## 5. 人工描地與資料補齊的接入方式

建議採「候選輸入」而非「自動真相」：

1. 使用者輸入地籍識別與資料日期，原始檔預設只在本機處理；不進版本庫、記錄或分析遙測。
2. 描繪 polygon，記下底圖來源、比例／控制點、座標基準及操作版本。沒有定位依據就標 local/unlocated，不貼到真實地圖。
3. 外部搜尋僅回傳候選證據：發布機關、文件或圖資 URL、公告／有效日期、查詢時間、授權與適用範圍。
4. 使用者逐項確認；衝突保留並標示，不以「較新搜尋結果」自動覆寫現有值。
5. 正式驗證層檢查封閉、自交、洞、座標／單位、範圍、相互包含及面積差異。Viewer 不修補幾何、不自行變更 Core 基地面積。
6. 通過後產生新的 geometry version/hash；再次綁定方案與 Core result，不回填舊快照。

人工描基地只能解決 site 的候選來源，不能同時補出建築 footprint 與 height。
建築師提供的設計、人工明示的規劃假設、核定圖說應分開標示；「規劃假設」不可標成「實際樓高」。
搜尋不能可靠地得出未來建築配置，也不能由法定高度上限推斷設計高度。

外部查詢前須顯示將傳送的欄位及接收機關，取得當次同意；不能自動送出地主姓名、持分、財務資料或整份案件。
本輪不實作外部搜尋、地籍自動抓取、人工描圖寫入或檔案匯入，來源格式決策留至下一階段。

## 6. 官方資料查核（2026-09-23）

- [國土測繪圖資服務雲](https://www.nlsc.gov.tw/cp.aspx?n=16732)：圖台瀏覽與程式介接資格不同；地籍 WMS／WMTS／API 等服務有特定申請對象限制，不能假設一般公司可直接取用。
- [服務條款](https://maps.nlsc.gov.tw/pro/use_clause.jsp)：內容使用需遵循來源標示等條件，不得大量下載；不建立圖磚鏡像或整區快取。
- [介接服務說明](https://maps.nlsc.gov.tw/S09SOA/homePage.action?Language=ZH)：正式串接前逐項確認服務、授權、申請與技術限制。

因此「系統搜尋補齊」目前只是候選證據工作流提案，不是已可無條件上線的資料供應鏈。
本次搜尋沒有傳送真實地籍識別、所有權人或案件內容。

## 7. 儲存與資料量預算

本輪：合成 fixture、小型原始碼與文件進 repo；Three.js、Pyodide、截圖與瀏覽器只在既有 ignored artifacts。
正式 apps/web 沒有引用 prototype，沒有新增預載、Service Worker、localStorage、IndexedDB 或 Activity。

下一階段建議預算（待正式契約核准，非現有能力）：

- 單次 geometry JSON 上限 1 MiB、總頂點上限 10,000；超限明確拒絕，不在 UI 靜默簡化。
- 單案空間本機快取上限 10 MiB；超限須使用者匯出／清理，不靜默刪除採用過的證據。
- 計畫版本只保留 geometry_hash 引用；幾何實體按內容去重，不在每個快照複製一份。
- 外部證據預設存來源與必要摘錄，不存整站網頁、原始圖磚、航照或 base64 CAD。
- 清除、匯出、孤立 blob 回收與 quota failure 必須有測試；來源 URL 也可能含個資，公開匯出需移除。

## 8. 版本路線與開工門檻

| OS Release | 交付方向 | 前置門檻 |
|---|---|---|
| 0.7.0 | 本 audit、三種 provenance 提案、Three.js ADR、隔離原型、沿用已完成 UX 收斂 | 正式案件不受影響；完整測試；未等同已發布 tag |
| 0.8.0 | Traceable Massing Viewer | 幾何契約核准、來源可用、依賴 ADR 核准；沒有資料的案件留在 Diagram |
| 0.9.0 | Spatial Inspection | floor geometry 完整才切片；GIS 採 capability gate，不強制納入 |
| 0.10.0 | Decision Integration | 方案／歸因／敏感度／逐戶結果／紀錄／報告有效綁定；不承諾 LOD 2 |

OS、Core、Schema、App 版號彼此獨立；這輪不為了 0.7.0 標題而改 CORE_VERSION 或 release tag。
M7.5 保留歷史成果 Existing Area / Floor Visualization，不宣稱 Complete Spatial Visualization。
正式 Viewer 前需核准本契約及 Three.js ADR；若必須改凍結格式，另走新版本、遷移與全消費端回歸。
