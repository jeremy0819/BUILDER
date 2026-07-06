# Urban Renewal OS v1.0 — Architecture Freeze

> **狀態**：已凍結（2026-07-05，Architecture Freeze session）。
> **本檔地位**：全專案架構的最高權威文件（權威順序見 §8）。變更本檔＝架構變更，需使用者核准。
> **本 repo（BUILDER）**：Urban Renewal OS 的目標容器（monorepo）。兩個舊 repo 以「乾淨快照」搬入
> （策略依據：RE-DCF《歷史乾淨度報告.md》——git 歷史含真實案資料，雙方已共識不保留歷史）。
> 建議在 GitHub 將本 repo 更名為 `Urban-Renewal-OS`（使用者操作；更名前文件一律以 BUILDER 稱呼）。

---

## 1. 一句話架構

```
輸入（人工/匯入） → Project JSON（唯一資料合約） → RE-DCF Core（唯一計算來源）
    → Result JSON（不可變、帶溯源戳） → 各消費端只讀渲染（Dashboard / Simulator / 報告 / 未來 CRM·GIS·AI）
```

Core 是 Single Source of Truth：容積、坪效、共負、財務、法規門檻（warnings）**只有 Core 能算**。
消費端一條公式都不准寫。這條管線經重新審視後**維持不變**——它是現有設計中最值得保留的資產。

---

## 2. 核心裁決（每條含：決定／理由／推翻了什麼）

### D1 — Monorepo：三庫合一，BUILDER 為家 【推翻「RE-DCF 永遠獨立 Repository」】

**決定**：Urban-Renewal 與 RE-DCF-Tool 以乾淨快照搬入 BUILDER，舊庫轉私有封存。
**理由**：
1. 本專案唯一開發者、以 AI session 開發。跨 repo 契約同步已被證明是最大失焦源——
   兩庫為了對齊 schema v1.1 產生了 6 份交接/回覆文件，而**公式重複問題照樣發生**
   （evaluator.html 前端自算全套公式，見 ARCH_REVIEW R-1）。
2. Monorepo 讓「schema 變更＋所有消費端適配＋測試」成為**同一個 commit**，弱模型 session 不必
   跨 repo 猜對方狀態。
3. 「獨立性」的真正需求是 **core 零 UI 依賴、可獨立 import**——這是 package 邊界，不是 repo 邊界。
   以測試強制（import-hook 封鎖 streamlit/plotly 後 `import core` 必須成功），不以 repo 隔離。
**推翻了**：RE-DCF ROADMAP 開發原則第 6 條。該條寫於單庫時代，其動機（防止 Core 被 UI 污染）由
package 邊界＋測試承接，不需 repo 邊界。

### D2 — 計算管線與 SSOT：維持，但從「宣告」升級為「執法」

**決定**：管線（§1）不變。新增三道執法機制（§6），因為**今天的 SSOT 只存在於文件裡**：
evaluator/simulator 的教學試算層在前端完整重算容積與共負（`evaluator.html:312-341`）。
**處置**（不重寫封版頁面的前提下）：
1. 教學試算層**降級為「示意模式」**：頁面明示「教學示意，非權威數字；權威數字以 Core 匯出為準」，
   並凍結——不得再新增任何公式。
2. 新增**交叉核對 headless 測試**：用 `schemas/examples/` 案例餵前端教學層，輸出與 Core result 比對，
   容差內才綠——飄移至少會被看見（在教學層被 API 取代前，這是最便宜的止血）。
3. 終局（P3）：前端計算由 Agent/API 呼叫 Core 取代，教學層屆時移除。

### D3 — Project JSON 升級為「完整可重算文件」（schema v2.0，P1 執行、現在不動）

**決定**：schema v1.1 凍結期照舊（位元組不變）。合併完成後第一個架構任務＝schema v2.0：
Project JSON 必須含**重算所需的全部輸入**（含逐層樓板表 floors[]、owners[]、費率參數、情境），
外加 result 與溯源（core_version / computed_at / input_hash）。
**理由**：v1.1 的已知缺口——合約無逐層資料，「從合約 JSON 重算 result」不可行。這打斷了
稽核鏈（數字無法回放驗證），也堵死 Dashboard 多案件管理的重算需求。合約不可重算＝SSOT 只有一半。
**細節**：見 `docs/architecture/SCHEMA_STRATEGY.md`（版本規則、遷移器、向下相容）。

### D4 — Schema 檔案形態：單一 project_schema.json ＋ `$defs` 【推翻「7 個分離 schema 檔」提案】

**決定**：不拆 owner/valuation/cashflow/… 七個獨立 schema 檔；一個 `project_schema.json`，
子實體用 `$defs` ＋ `$ref` 內部引用。CRM/GIS/Document 等 OS 模組資料**不進計算合約**，
各模組自帶檔案（以 `project_id` 關聯），schema 各自獨立、獨立演進。
**理由**：計算合約是原子性的（一個案件一份檔、一次驗證）；拆檔增加版本組合爆炸
（7 檔 × 各自版本），對單人＋弱模型維護是純負擔。模組資料與計算合約分離，才能讓
CRM/GIS 演進不觸發計算合約 bump。

### D5 — Domain Model：核心實體現在定，OS 模組實體只留掛載點 【收斂原提案的 14 實體清單】

**決定**：現在定案的是計算域實體（Project/Site/Floor/Building/Owner/Scenario/SharedCost/
Valuation/RightsExchange/CashFlow/LawRule）。CRM、GIS、Document、AI Context **不現在建模**，
只保留關聯方式（`project_id`）。詳見 `docs/architecture/DOMAIN_MODEL.md`。
**理由**：後四者今天零使用場景、零真實資料；提前建模＝猜，猜錯的 schema 是負資產。
Architecture First 的正解是把**掛載點**設計好，不是把每個未來模組都畫進 ER 圖。

### D6 — 技術棧：不融合、不升級

靜態頁（apps/web）維持零依賴、零建置、可離線（Pages 部署）；Streamlit 維持 Demo/輸入工具定位；
Core 維持純 Python package。**不引入** bundler、framework、資料庫、後端服務——直到 P3 的
Agent repo 需求成立為止。單人專案的每一個新技術都是永久維護稅。

---

## 3. Repository 結構（凍結）

```
BUILDER/（→ 建議更名 Urban-Renewal-OS）
├── ARCHITECTURE.md              # 本檔（最高權威）
├── CLAUDE.md                    # 索引（≤150 行，只路由不塞內容）
├── governance/                  # 制度檔：模型調度/判斷 rubric/範本/維護協議/診斷/交接信
├── core/redcf/                  # ★ 計算核心（原 RE-DCF core/，唯一公式來源）
├── schemas/                     # project_schema.json ＋ examples/（合約與範例）
├── apps/
│   ├── web/                     # 原 Urban-Renewal 5 個靜態頁（Pages 部署根）
│   └── streamlit/               # 原 app.py ＋ .streamlit/（Streamlit Cloud 進入點）
├── tests/                       # 黃金測試、合約測試、交叉核對 headless 測試
├── tools/                       # make_template.py、產生器、headless 測試腳本
├── docs/
│   ├── architecture/            # DOMAIN_MODEL / SCHEMA_STRATEGY / MIGRATION_PLAN / ROADMAP / ARCH_REVIEW
│   ├── methodology/             # 原 Urban-Renewal docs（方法論歸展示側）
│   └── redcf/                   # 原 RE-DCF docs（公式與校準紀錄歸 Core 側）
└── .github/workflows/ci.yml     # P0 必建：pytest＋grep 真實段名＋headless＋schema hash
```

**保留／不合併／拆分**：
- 保留搬入：RE-DCF `core/ schemas/ test_golden.py tools`、Urban-Renewal 5 頁＋docs。
- 不搬入：兩庫 git 歷史（乾淨快照）；`calc_engine.py`／root `law_db.py` shim（搬家時淘汰，
  import 一律 `from core.redcf import …`）；已被取代的舊文件（逐檔判定，見 MIGRATION_PLAN）。
- 未來拆分：`Urban-Renewal-Agent`（P3，FastAPI＋AI，需金鑰與伺服器，部署形態不同才拆 repo）。
- 舊庫處置：轉私有封存＋README 指向新庫；舊 Streamlit 部署下架（曾顯示真實案名）。

---

## 4. 資料流與快取規則

```
[人工輸入/Excel匯入]                     [law_db（版本化法規資料）]
        │                                        │
        ▼                                        ▼
   Project JSON ──────────────► RE-DCF Core ──────► Result JSON（不可變＋溯源戳）
   （輸入區塊）                  （唯一公式）              │
                                                ┌────────┼──────────┐
                                                ▼        ▼          ▼
                                          evaluator  Dashboard   報告/簡報
                                          （只讀）  （V6，只讀）  （只讀）
                                                         │
                                                         ▼（P3 起）
                                                   CRM / GIS / AI Copilot
                                                   （只讀 result；AI 不心算）
```

| 規則 | 內容 |
|---|---|
| **純函式性** | `result = f(輸入區塊, core_version, law_db 版本)`。同輸入必同輸出（黃金測試的前提） |
| **可快取** | Result JSON（key＝input_hash＋core_version）；由 result 衍生的圖表/KPI 彙總 |
| **不可快取／不可複製** | warnings 門檻、法規參數、費率——消費端不得落地成自己的常數（那是公式複製的變體） |
| **不可變** | 已產出的 Result JSON（重算＝產新檔新戳，不改舊檔）；黃金測試期望值與校準費率（改動需使用者核准，見 governance/MAINTENANCE.md 🔴 類） |
| **跨版本** | core_version 不同的 result 不可混用比較；Dashboard 顯示每筆數字的 core_version |

---

## 5. 部署拓撲（兩條線，互不干擾）

- **GitHub Pages** ← `apps/web/`（純靜態，`.nojekyll`）。
- **Streamlit Cloud** ← `apps/streamlit/app.py`（Cloud 設定指定主檔路徑；合併當天要改部署設定）。
- CI（GitHub Actions）看門：pytest、真實段名 grep、headless 迴歸、schema hash（凍結期）。

---

## 6. SSOT 執法機制（宣告不夠，要有牙齒）

1. **測試執法**：core 零 UI 依賴測試（import-hook）＋黃金測試＋合約 schema 驗證＋
   前端交叉核對測試（D2-2）——全部進 CI，紅了擋 merge。
2. **審查執法**：任何 PR/commit 觸碰 `apps/` 且 diff 含算術運算子與金額/面積變數 → 視為紅旗，
   按 governance/JUDGMENT_RUBRICS R3 停下確認。
3. **文件執法**：governance/MAINTENANCE.md 權限矩陣——schema、費率、期望值是 🔴 類，
   session 不得自行變更。

---

## 7. 明確不做清單（凍結期至 P1）

不做 API、不做 AI、不做資料庫、不做使用者系統、不做商辦版、不重寫封版頁面、
不在合併途中加任何新功能（「搬家不是改建」——兩側交接文件的共同原則，維持）。

## 8. 文件權威順序

使用者指示 > 本檔＋governance/ > 各 repo CLAUDE.md > ROADMAP 類 > 其餘 docs（歷史文件）。
本檔與舊文件衝突處，以本檔為準；已知衝突清單見 `docs/architecture/ARCH_REVIEW.md` 附錄。
