# M5 SPEC · THE WORKFLOW（憲法）

> **文件類型**：架構規格（docs/architecture/）
> **里程碑**：M5「THE WORKFLOW」— 產品外殼 / 決策流程 IA
> **狀態**：規格定案 → 待實作
> **前置**：M4 Decision Engine v0.1 落地、os-v0.3.0 校準版
> **最後更新**：2026/07
> **核心命題**：把六個獨立模組，重組成一條「Site → Product → People → Decision」決策流程。
> 產品賣的是「決策流程」，不是「功能」。**工作流只呈現引擎輸出，永不自行計算。**

---

## 0. 本次定位修訂

| | 舊（工程模組語言） | 新（決策流程語言） |
|---|---|---|
| 心智模型 | Dashboard / Evaluator / Simulator | **Site → Product → People → Decision** |
| 首頁 | 功能展示（像 repo demo） | 開始一個都更案件（三步工作流） |
| 使用者問的 | 「這是什麼工具？」 | 「這塊地值不值得投？蓋什麼？整合機率多少？」 |

> **關鍵紀律**：這是「呈現層重組」，不是新增領域邏輯。每一步「提出問題 + 呈現引擎答案」，不自己算。
> **Strategy Engine（逐型對策）= M6，不在本里程碑**——別讓 IA 外殼吃掉領域肌肉。

---

## 1. 產品語言：Ubiquitous Language

**對外（使用者看到）↔ 對內（工程檔名），一律用映射，不改檔名破壞穩定性：**

| STEP | 產品語言（對外） | 頁面（對內） | 引擎 |
|---|---|---|---|
| 1 | **Site Analysis · 基地診斷** | dashboard.html | Core（Site facts） |
| 2 | **Product Planning · 產品規劃** | evaluator.html | RE-DCF Core（容積/坪效/共負/財務） |
| 3 | **Negotiation Strategy · 整合推演** | simulator.html | Decision Engine（EV/verdict）+ M6 Strategy Engine |
| ✓ | **Decision Report · 決策報告** | （report view） | 組合上述引擎輸出 |

> 核心語言定為 **Site → Product → People → Decision**，取代 Dashboard → Evaluator → Simulator。
> 新增 `docs/STANDARD_WORKFLOW.md` 為最高層級文件；README / MILESTONE_REPORT / 首頁全部改用此語言。

---

## 2. 兩層 IA 釐清（解決命名衝突）

```
Workspace（多案）   = 案件組合，挑/開/匯入案子（C2 已建）
   │  挑一個案
   ▼
Case Workspace（單案） = 該案容器，走三步工作流
   ├── STEP 1  Site Analysis
   ├── STEP 2  Product Planning
   ├── STEP 3  Negotiation Strategy（People）
   └── ✓ Decision Report
```

- **Dashboard = Case Workspace**（單案容器），不是「Step 1」。
- Evaluator 保留，對外改稱 **Product Planning**（對內仍 evaluator.html）。
- 首頁流：Workspace 挑案 → Case Workspace 三步。

---

## 3. 三步工作流（每步 = 提問 + 呈現引擎答案）

### STEP 1 · Site Analysis（基地診斷）
```
提問：這塊地值不值得開發？
輸入：地籍 / 都市計畫 / 土地使用 / 容積率 / 建蔽率 / 法規限制
資產：基地圖說 / 地籍圖 / 都市計畫圖 / 街景照片
呈現：Core 的 Site facts（FAR/Coverage/法規）
輸出：Project JSON（Site）→ 進 STEP 2
狀態：STEP 1 / 3
⚠️「值不值得」的判斷來自 Decision Engine，卡片只呈現，不自己算
```

### STEP 2 · Product Planning（產品規劃）
```
提問：最佳產品配置？
輸入：建築產品 / 樓層 / 坪型 / 停車 / 成本
即時結果：RE-DCF Core 正式計算 容積/坪效/共負/財務，同步更新
輸出：Project JSON（Evaluation）→ 進 STEP 3
狀態：STEP 2 / 3
```

### STEP 3 · Negotiation Strategy（整合推演）★匯流點
```
提問：整合成功機率多少？先談誰？
這一步是三股領域工作的匯流：
  · C3 逐戶意願地質圖（人：地主分布/家族/意願/關鍵戶）
  · Decision Engine 三方 EV（誰 EV 為負 = 破局引爆點）
  · M6 Strategy Engine 逐型對策（先談誰/優先戶/是否調產品）← M6 才填
模擬：地主/家族/時間/成本/同意率/競爭建商
輸出：Decision Report
狀態：STEP 3 / 3
⚠️ M5 先呈現「M4 已產出的 EV/verdict + 現有 simulator」；
   逐型建議是 M6 Strategy Engine 的事，本里程碑不做
```

### ✓ Decision Report（決策報告）= 產品 payoff
```
不是遊戲結束畫面，而是「開發商下一步該做什麼」。
組合（非計算）三引擎輸出：
  Core（財務：IRR/現金流/時程）
  + Decision Engine（三方 EV / verdict / 完工機率 / breakpoint）
  + Strategy Engine（建議動作，M6 後填）
  → 下一步行動
```

---

## 4. 分層紀律（沿用 C2/M4 鐵律）

```
❌ 工作流卡片自己算「值不值得/機率/verdict」
   → ✅ 一律呈現 Decision Engine 輸出（input_hash 溯源）
❌ 為了流程順，在 UI 塞領域邏輯
   → ✅ UI 只組合與呈現引擎輸出
判準：這一步在「呈現引擎答案」，還是在「自己推論」？
```

---

## 5. M5 內部優先序

| P | 內容 | 層 |
|---|---|---|
| **P0** | **Three-Step Workflow 外殼**：首頁三步卡為唯一主入口；每步 STEP n/3 狀態；Project JSON 串接；Decision Report scaffold | 呈現 |
| **P1** | **Dashboard = Case Workspace**：基地圖說/地籍/都計/街景 + 即時規劃結果 + 案件狀態（依附圖 wireframe） | 呈現 |
| **P2** | **Developer Board**：整合人工作台——戶別/接觸紀錄/整合率/風險/下一步（呈現 Workflow + Decision Engine 輸出） | 呈現 |

> P0–P2 全是呈現層重組。**新領域智慧（Strategy Engine）= M6，不在此。**

---

## 6. Definition of Done（M5）

- [ ] 首頁以 STEP 1→2→3 為唯一主要入口（不再以模組名主導）
- [ ] STEP 1/2/3 各有 `STEP n/3` 狀態，完成可直接前往下一步
- [ ] Project JSON 在三步間正確串接
- [ ] Decision Report 產出（組合 Core + Decision Engine 輸出；Strategy 待 M6）
- [ ] `docs/STANDARD_WORKFLOW.md` 建立；README / MILESTONE_REPORT / 首頁統一產品語言
- [ ] 兩層 IA（Workspace 多案 / Case Workspace 單案）落地
- [ ] 分層紀律：工作流零推論，verdict 皆來自 Decision Engine（可 input_hash 溯源）

---

## 7. 明確不做（邊界）

- ❌ 工作流不自行計算任何 verdict/機率/EV（一律讀引擎輸出）
- ❌ **不做 Strategy Engine 逐型對策（= M6 THE STRATEGIST）**
- ❌ 不做 milestone→deadline→72hr 風險窗（= M7 WATCHTOWER）
- ❌ 不改 core/redcf 檔名或既有 schema（僅加產品語言映射層）
- ❌ 不做 SDK / Plugin

---

## 附錄 · 為什麼先做外殼（且它不是鷹架）

- 現在的領域深度（Core、Decision Engine）被切成六個模組，使用者無法當「一條決策流程」用。
- 外殼讓**已有的肌肉變好用**——像引擎已裝好，這是駕駛艙與方向盤。**不是無人用的 SDK 鷹架，是承重的產品控制層。**
- 但外殼滿足感強，**別讓它無限延後 M6 Strategy Engine**——那才是 STEP 3 真正的差異化肌肉。
- 順序：**先出骨架（M5 外殼）→ 再長肌肉（M6 Strategy Engine）**。
