# Site Geometry → Planning → Core 整合提案

狀態：**Proposal，尚未核准或實作**。本文件定義正式基地幾何如何進入規劃決策鏈；不修改 Core、既有 Schema、資料遷移或正式 Viewer 能力。沿用 [0.7.0 Visualization Foundation](VISUALIZATION_FOUNDATION_0_7.md) 的 Spatial LOD 與來源門檻。

## 1. 問題與不可跨越的界線

目前 `site-intake.js` 的 `normalized-unlocated` 多邊形是 Level A 參考草圖，沒有比例、座標系或量測精度。`site-massing.js` 以輸入基地面積、建蔽率與標準樓板產生數值草案；面積比例矩形不是基地、footprint 或實際樓高。Core 以數值 engine 重算，不接收草圖 polygon。因此草圖、Core 與合成 3D 不能被 UI 標成已連結。

| 資料狀態 | 可呈現 | 不可宣稱 |
|---|---|---|
| Level A：參考草圖 | 描繪、註記、登記面積與 Core 數值 | 地籍定位、可建範圍、依形狀計算、正式量體 |
| Level B：已驗證基地 Geometry | 具來源的基地平面、範圍與資料狀態 | 僅憑基地 polygon 就推算退縮、footprint 或樓高 |
| 已接受的 Planning/Massing Model | 同源 Top View／3D；有條件連接 Core 數值 | 超出採用規則與來源的法規合規或設計精度 |

Level A 資料**不得自動升格**。即使其頂點與正式 polygon 看似相同，仍須另建候選來源、座標與單位、人工查核和驗證紀錄。現行 `site_intake` 保持原格式，不在匯入時轉成正式 Geometry。

## 2. 建議資料流與權責

```text
來源文件／測量或定位資料
  → Site Geometry 候選 → 獨立驗證與採用 → Site Geometry Contract
  → Planning Rules／明示假設 → Buildable Envelope → 選定 Footprint
  → Planning Input（完整 lineage + Core 數值 engine）
  → Core recompute → Core Result
  → Massing Model（核對同一 Planning Input 與 Core Result）
  ├─ Top View
  ├─ Isometric 3D
  └─ Floor Slice（另須 LOD 1 資料）
```

Geometry 驗證層只接受或拒絕來源資料，不決定法規可建範圍。Planning 層需要已核准、具版本的退縮／道路斜線／法定空地等規則，或明示且可追溯的規劃假設；**現有 Core 沒有這些正式規則，UI 不得自行補算**。Buildable Envelope 是規則運算結果，footprint 是在 envelope 內經選定的設計／規劃假設，兩者不得混稱。沒有規則或選定 footprint，就只展示已驗證基地平面與既有面積表。

Core 繼續擁有容積、銷售與財務結果。未來 Planning Adapter 以同一 footprint／樓層資料產生完整數值 engine，交給 Core 重算；它必須記錄幾何、規則、轉換版本與人工採用。Core `input_hash` 仍識別其數值輸入，不能單獨證明它來自哪一塊地。是否讓 Core schema 直接攜帶 Geometry reference，是須另行核准的版本化決策；在核准前不得宣稱現行 Core 已驗證空間合規。

「已連結計算」只能在 Site Geometry、Planning Input、Core Result 與 Massing Model 四者的版本和 hash 全部相符、且能力驗證通過時顯示。只有正式基地 polygon，或只有 Core 重算成功，都不足以取得此狀態。

## 3. 候選契約形狀

下列是**欄位提案，不是可匯入的正式 JSON Schema**。正式採用需要獨立版本、fixture、validator 與 migration 決議。

```json
{
  "site_geometry": {
    "geometry_id": "stable-id",
    "polygon": "Polygon or MultiPolygon with rings and holes",
    "unit": "m",
    "coordinate_system": "identified horizontal CRS and axis order",
    "source": "record/document identifier",
    "source_version": "effective revision",
    "checked_at": "ISO-8601 timestamp",
    "geometry_hash": "sha256:…"
  },
  "massing_model": {
    "site_geometry_ref": "geometry_id + geometry_hash + source_version",
    "planning_rule_ref": "approved rule set or explicit assumption",
    "buildable_envelope": "validated polygon + provenance",
    "footprint": "selected polygon + provenance",
    "floors": "identified floors; geometry only where supplied",
    "height": "value + unit + source and basis",
    "input_hash": "Core numeric engine hash",
    "geometry_hash": "accepted site geometry hash",
    "planning_hash": "site + rules + footprint + transformation identity"
  }
}
```

`geometry_id` 是可辨識物件的穩定 ID；`geometry_hash` 識別幾何內容，`source_version` 與 `checked_at` 是來源與查核狀態，不能用 hash 或時間戳互相替代。`planning_hash` 用來綁定基地、規則版本、選定 footprint、層數／高度依據及轉換版本；`input_hash` 維持 Core 既有定義。正式 scene identity 至少包含 case/scenario、contract version、geometry_hash、planning_hash、input_hash、core_version 和來源版本。任何不一致都拒絕把舊數字與新形狀並列成「同一方案」。

驗證層須定義並測試 polygon 閉合、自交、洞、多塊地、單位、CRS、axis order、合理座標範圍與拓撲；不得在 Viewer 靜默修補。Canonical hash 的數值精度、環方向／起點、洞與 MultiPolygon 順序、字元編碼與鍵排序須定案並跨語言測試；現有合成 fixture hash 不可直接用於地籍。`source` 應能回到來源文件、資料日期、授權與查核人／方法；原始附件與可能含個資的 URL 不應直接出現在公開報告。

登記基地面積與 polygon 計算面積是不同證據。驗證層需顯示差值和容許門檻，由有權採用者選定計算依據；不得因為畫出 polygon 就覆蓋現有 `site_area_sqm`。規劃 footprint 面積與 Core 樓板面積也需逐層核對，不能讓 Viewer 自己補成一致。

## 4. 單一幾何，多種視圖

Top View、Isometric 3D 與未來 Floor Slice 只能從同一份已接受 `massing_model` 建立。不同視圖共享 site polygon、buildable envelope、footprint、樓層 ID 和高度來源；相機旋轉、縮放、選層只是暫態 view state，不改 Planning Input 或案件歷程。沒有 footprint 和 height 時，不生成矩形假量體。沒有 floor geometry／標高／用途時，不啟用 Floor Slice 或宣稱 Spatial LOD 1。

WebGL 不可用時保留 Core 數字、來源狀態與表格。使用者可從一個物件追到規劃假設、幾何來源、Core 輸入與結果；UI 不儲存獨立可編輯的「展示專用」容積值。

## 5. 失效與測試門檻

| 變更 | 必須失效或重新核對 |
|---|---|
| 基地 polygon、單位、CRS 或來源版本 | Geometry 驗證、envelope、planning_hash、scene 與結果綁定 |
| Planning 規則／假設或選定 footprint | envelope／footprint、planning_hash、數值 engine、Core Result 與 scene |
| 樓層／高度依據或數值 Core 輸入 | planning_hash 或 input_hash、Core Result 與 scene 綁定 |
| Core 版本或案件方案 | Core Result 與所有衍生展示綁定 |
| 相機、俯視切換或選取 | 僅 view state；不重算、不寫案件歷程 |

最低驗收：Level A 草圖修改不改 Core／massing；Level B 無規則時只顯示基地；缺 footprint／height 時不啟用正式 3D；同一 model 的 Top View 與 3D footprint 頂點一致；geometry、規則或 Core 任一 hash 更動時拒絕舊綁定；面積衝突必須明示並阻止自動採用；WebGL fallback 可讀數字；含個資來源不進公開輸出。使用可回放的合成 fixture 加上獨立來源授權測試，不以視覺截圖代替契約測試。

## 6. 待審架構決議

1. 正式 Site Geometry 的來源與授權：接受的測量、地籍、設計文件格式、定位方式與人工查核角色。
2. CRS／單位白名單、polygon canonicalization、hash 演算法與面積差異處理。
3. 退縮等 Planning 規則的權威、版本、適用地區與缺規則時的能力降級；明示假設如何審查。
4. Planning Adapter 與 Core 的版本化介面：Geometry reference 進入哪一層契約、如何產生可回放的數值 engine、如何處理既有案件。
5. Footprint、樓層幾何與高度的來源門檻，以及正式 Viewer 的 [Three.js 依賴決議](ADR_THREEJS_VISUALIZATION.md)。

上述決議與契約驗證通過後，才另開實作 PR。此提案不解鎖現有合成 3D，也不把逐戶 `eligible_units` 解讀成實際選屋位置。
