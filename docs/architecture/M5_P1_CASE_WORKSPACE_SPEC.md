# P1 SPEC · CASE WORKSPACE 充實

> **文件類型**：架構規格（docs/architecture/）
> **里程碑**：M5 · P1（依 wireframe 展開單案容器）
> **狀態**：規格 → 待實作（P0 已驗收後）
> **最後更新**：2026/07
> **核心命題**：把 Case Workspace（單案容器）依 wireframe 充實——STEP 1 基地診斷 + STEP 2 產品規劃。
> **充實，不重構**：尊重 P0 已建的 STEP 徽章 / JSON 串接 / 案件橫幅，只加內容。呈現 Core，不計算。

---

## 0. 版面（依 wireframe）

```
┌─ Case Workspace（dashboard.html）─────────────┐
│ 案件橫幅（P0 已建：目前案件＋切換＋決策報告入口） │
├───────────────────────────────────────────────┤
│ STEP 1 · Site Analysis                        │
│   ┌─ 視覺資產面板 ─────────┐                    │
│   │ 基地圖說 / 地籍圖       │                    │
│   │ 都市計畫圖 / 街景·照片  │                    │
│   └───────────────────────┘                    │
│   Site Information：FAR / Coverage / 建蔽率      │
│                    / 法規限制                    │
├──────────────────┬────────────────────────────┤
│ STEP 2 · Product │ 即時結果                     │
│ Planning         │                             │
│  建蔽率 / 容積率  │ ← 同步更新                   │
│  地下室 / 戶數    │  （容積 / 坪效 / 共負 / 財務） │
│  車位 / 成本      │                             │
└──────────────────┴────────────────────────────┘
```

---

## 1. STEP 1 · Site Analysis 充實

### 1.1 視覺資產面板（新增）
- 基地圖說、地籍圖、都市計畫圖、街景 / 基地照片。
- 使用者可上傳 / 連結；縮圖顯示，點開放大。

### 1.2 Site Information（呈現 Core Site facts）
- FAR / Coverage / 建蔽率 / 法規限制 —— **逐欄來自 Core，UI 不算**。

### ⚠️ 1.3 紅線：視覺資產是「新資料類型」，且現有掃描抓不到它
```
真實案件的 地籍圖／基地照片／都計圖 含可識別資訊（地號、地址、門牌）。
→ 這是一個新的資料外洩向量。
→ 且 check_no_real_names.sh 掃「文字」，不掃「圖」——圖是它的漏洞。

規則：
  · 真實案件視覺資產 → 本地儲存 only（localStorage／本地目錄，gitignored）
    永不進 repo。
  · demo／合成案 → 用合成占位圖。
  · commit 前確認：無任何真實案件圖檔進版控。
建議：在 runbook / CI 補一條「圖檔不入 repo」的檢查（檔名/路徑白名單）。
```

---

## 2. STEP 2 · Product Planning 充實（Evaluator）

### 2.1 輸入
- 建蔽率 / 容積率 / 地下室 / 戶數 / 車位 / 成本。

### 2.2 即時結果同步更新
```
輸入變更 → RE-DCF Core 重算 → 呈現（容積 / 坪效 / 共負 / 財務）
```
- ⚠️ **UI 不算，RE-DCF Core 算**（沿用既有 SSOT）。
- 即時同步用 **debounce**（如 300ms），避免每次鍵入都觸發重算，顧及效能。

---

## 3. 紀律（沿用）

```
❌ 充實時順手重構 P0 的 STEP 徽章 / JSON 串接
   → ✅ 只加內容，不動已驗收的骨架
❌ UI 自算 Site Information / 即時結果
   → ✅ 一律 Core 產出，可溯源
❌ 真實案件圖檔進 repo
   → ✅ 本地 only；圖是掃描漏洞，另加白名單檢查
```

---

## 4. Definition of Done（P1）

- [ ] STEP 1 視覺資產面板（上傳/連結/縮圖/放大）
- [ ] STEP 1 Site Information 呈現 Core facts（FAR/Coverage/建蔽率/法規）
- [ ] STEP 2 Evaluator 輸入 + 即時結果同步（debounce；Core 重算；UI 不算）
- [ ] 真實案件視覺資產本地 only；補「圖檔不入 repo」檢查
- [ ] 未動 P0 的 STEP 徽章 / JSON 串接 / 案件橫幅
- [ ] 全流程零 error；既有 Gate 全綠

---

## 5. 明確不做（邊界）

- ❌ 不做 STEP 3 逐型對策（= M6 THE STRATEGIST）
- ❌ 不做 Developer Board（= P2）
- ❌ 不改 core/redcf 檔名或既有 schema
- ❌ verdict / 機率 / EV 一律讀引擎輸出，不在 UI 計算
