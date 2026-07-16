# M4 DECISION ENGINE SPEC · 決策引擎規格（憲法）

> **文件類型**：架構規格（docs/architecture/）
> **里程碑**：M4 · Decision Engine（推論層）
> **狀態**：規格定案 → 待實作
> **前置**：M3 Workflow 完成、B1–B5 收尾、core/redcf 提供權威 result
> **最後更新**：2026/07
> **核心命題**：決策由引擎產生，UI 只呈現。引擎消費 Core + Workflow，產出決策，不反算 Core。

---

## 0. 定位與邊界（先讀）

### 在五層堆疊的位置
```
Core（Facts）           ← core/redcf：唯一計算來源（SSOT）
   │ result JSON
   ▼
Workflow（State）        ← 案件狀態、階段、同意進度
   │ workflow state
   ▼
Decision Engine（Analysis）  ← 【本規格】消費上兩層，產出決策
   │ decision JSON
   ▼
Presentation（Workspace/Sandbox） ← 只呈現 decision JSON
```

### 三條鐵律
1. **只消費，不反算**：Decision Engine 讀 Core `result` + Workflow `state`，**絕不重算容積/共負/財務**（那是 Core 的事）。
2. **產出即權威**：GO/CAUTION/STOP、三方 EV、Exit Signal 一律由本引擎產出；UI **不得自行推導**（違反即回到計算器）。
3. **可溯源**：每份 decision 輸出帶 `input_hash`，指回它消費的 Core result 版本。

---

## 1. 輸入契約（Input Contract）

### 從 Core result 讀（唯讀，verbatim）
```
V         更新後總銷值
c         共負比 → 共同負擔 = V·c
V0        更新前總值（§56 權變分母；來自 PART3 係數 × 逐戶）
mgmt_fee  全案管理費（= V × 管理費率）
profit_impl  實施者利潤（合建模式才有；全案管理模式為 0）
advance   實施者前期代墊（成案前投入）
```
> 若 result 缺任何欄位 → 該項 EV 標記 `insufficient_data`，**不得由引擎補算**。

### 從 Workflow state 讀
```
current_stage   目前階段（決定完工機率起算點）
consent         同意進度（計數 + 門檻）
mode            都更(80%) / 危老(100%) / 防災都更
milestones      里程碑與時點（若 Workflow 已建 milestone/deadline）
```

### Decision Engine 自身 config（可校準參數）
```
r    折現率
g    土地自然增值率（status quo 對照）
role 我方角色（營建管理 / 開發 / 投資）
threshold_return  我方門檻報酬率
```

---

## 2. 完工機率階段樹（資料結構）

存成 config（如 `stage_tree.json`），**存活率為示意預設，須以真實案例校準**：

```json
{
  "stage_tree": [
    {"id":"S1","name":"整合達門檻","p_survival":0.65,"duration_yr":2.0,"risk":"holdout"},
    {"id":"S2","name":"報核(事業+權變)","p_survival":0.85,"duration_yr":0.5,"risk":"文件/選配"},
    {"id":"S3","name":"審議核定","p_survival":0.80,"duration_yr":3.0,"risk":"陳情/訴訟"},
    {"id":"S4","name":"融資到位","p_survival":0.92,"duration_yr":0.5,"risk":"核貸不足"},
    {"id":"S5","name":"建照","p_survival":0.95,"duration_yr":0.5,"risk":"圖審"},
    {"id":"S6","name":"開工","p_survival":0.95,"duration_yr":0.3,"risk":"拆除/騰空"},
    {"id":"S7","name":"完工","p_survival":0.85,"duration_yr":3.5,"risk":"營造/財務/爛尾"},
    {"id":"S8","name":"交屋結算","p_survival":0.95,"duration_yr":0.5,"risk":"找補/登記"}
  ]
}
```

### 計算
```
p_complete = ∏ p_survival（current_stage 起，到 S8）
T_remaining = Σ duration_yr（current_stage 起，到 S8）
df = 1 / (1 + r)^T_remaining
```
> 越早期，p_complete 越低（整合起算 ∏≈0.34；已核定後段 ∏≈0.77）。

---

## 3. 三方 EV 引擎

### 名目層
```
地主名目   = V(1−c) − V0
實施者名目 = (mgmt_fee + profit_impl) − advance − 營運成本
我方名目   = 依 role（營建管理費／開發利潤／投報）
```

### 期望值層
```
地主 EV   = p_complete · df · [V(1−c)] − V0 · (1+g)^T · df
實施者 EV = p_complete · df · (mgmt_fee + profit_impl)
            − (1 − p_complete) · advance − df · 營運成本
我方 EV   = 依 role 套同框架
```

### ⚠️ 建模決策（須校準，不當定論）
- 地主 EV 的 **status quo 基準**（`V0·(1+g)^T·df` = 抱舊房自然增值的 PV）是一個**建模選擇**。
  真實案件請以真實 Excel 校準此基準的形式與 g 值。
- 標記為 `modeling_assumption: status_quo_baseline`，允許之後替換。

### 判讀（寫進輸出）
```
三方 EV 落差 = 整合風險
EV 為負(或≈0)的一方 = breakpoint_stakeholder（破局引爆點）
蛋黃區：V0 高 → 地主 EV ≈ 0/負 → holdout 傾向高
蛋白區：容積算不動 → 實施者 EV 負 → 無人承接
```

---

## 4. 決策判定（Verdict）

```
GO      : 三方 EV 皆 > 0  AND  我方 EV / 我方投入 > threshold_return
CAUTION : 我方 EV > 0  BUT  某方 EV ≤ 0（整合不對稱風險）
STOP    : 我方 EV ≤ 0  OR  地主 EV 顯著為負（整合幾乎不可能）
```
- 輸出必帶 `breakpoint_stakeholder`：指出哪一方是引爆點（EV 為負那方）。
- **核心**：verdict 不只看我方賺不賺，看「有沒有哪一方 EV 為負」。

---

## 5. Exit Signal（退場訊號）

```
繼續 EV = 邊際投入後的期望回收（forward-looking）
退場 EV = 現在退場可回收的淨值（止血）
exit_signal = (繼續 EV < 退場 EV)
```

### ⚠️ 沉沒成本防火牆（案例B原型教訓）
- **已投入成本不得進入 exit 決策式**。決策式只有「邊際投入 vs 邊際回收」。
- 輸出附 `sunk_cost_excluded: true` 供稽核。

---

## 6. Decision Urgency（排序，M4 才合法）

複合分數（供 Workspace 案件列表排序）：
```
urgency = w1·verdict_severity   (STOP>CAUTION>GO)
        + w2·time_window_proximity  (逼近 deadline/風險窗)
        + w3·consent_gap_to_threshold
        + w4·ev_trajectory  (EV 惡化中?)
```
> 權重 w1–w4 存 config，可調。M4 上線後，Workspace 列表改用此鍵排序（取代 M3 的 Workflow 事實排序）。

---

## 7. 輸出 Schema（版本化）

`decision.schema.v0.1.json`（Backward Compatible，遵 Schema First）：
```json
{
  "decision_engine_version": "0.1.0",
  "input_hash": "<指回 Core result>",
  "verdict": "GO|CAUTION|STOP",
  "breakpoint_stakeholder": "地主|實施者|我方|null",
  "completion_probability": 0.34,
  "T_remaining_yr": 10.8,
  "ev": {
    "地主":   {"nominal": 0, "ev": 0, "status": "ok|insufficient_data"},
    "實施者": {"nominal": 0, "ev": 0, "status": "ok"},
    "我方":   {"nominal": 0, "ev": 0, "status": "ok"}
  },
  "exit_signal": false,
  "sunk_cost_excluded": true,
  "decision_urgency": 0.0,
  "assumptions": {"r": 0.06, "g": 0.03, "status_quo_baseline": "v0*(1+g)^T*df"},
  "modeling_assumption": "status_quo_baseline"
}
```

---

## 8. 三個對抗性案例回歸（CI Gate）

每案 = 一條回歸斷言，模型跑完必須吐出指定診斷：

```
Case A · 內爆型（案例A・蛋黃區內爆原型）
  參數：蛋黃區(V0高)、都更80%、觀望戶多、實施者=全案管理(低資本)
  斷言：地主 EV ≈ 0/負 AND 實施者 EV 正
        → verdict=CAUTION, breakpoint_stakeholder="地主"

Case B · 背信型（案例B・合建背信原型）
  參數：合建、分配未定、前期關係專屬投資高、地價 T0→T1 翻倍
  斷言：地價敏感度極高；地價漲後實施者套牢曝險升高
        → exit_signal 對「地主背信情境」正確觸發

Case C · 攔胡型（案例C・外部攔胡原型）
  參數：簽約前競標、對手「1坪換1坪+車位」、8%→33%公設
  斷言：名目分回 vs 室內實坪淨值落差被標出；
        overpay 對手 p_complete 下降
```
> 三案入 `tests/`，納入 CI 回歸。**通過 = 模型「懂」都更，不只會算術。**

---

## 9. 真實 Excel 本地校準流程（紅線紀律）

> **真實 Excel 含真實案件資料。零真實資料入 repo 是最硬紅線（`check_no_real_names.sh`）。**

```
1. 只抽「公式/邏輯」，不抽「資料」
   反推計算邏輯驗證/加深 Core 與本引擎；公式可入庫，數字禁入庫。

2. 校準放 gitignored 本地目錄（如 /local_calibration/，已在 .gitignore）
   真實 Excel → 預期 result/decision，本地跑，校準：
     · stage_tree 的 p_survival
     · EV 的 status_quo_baseline 形式與 g
     · 更新前價值係數（PART3）
   真實數字留本機，不進版控。

3. 只有「去識別化合成案例」進 repo
   把真實案抽象成 Case A/B/C，改名改數字，才 commit 進 CI。

4. commit 前 check_no_real_names.sh 必須綠。
```

---

## 10. Definition of Done（M4）

- [ ] `decision.schema.v0.1.json` 凍結、Validator 通過
- [ ] Decision Engine 零 Core 反算（只讀 result/state）
- [ ] 三方 EV + p_complete + verdict + exit_signal + urgency 全數輸出
- [ ] 三個對抗性案例回歸綠燈
- [ ] UI/Workspace 改為「呈現 decision JSON」，移除任何 UI 自算
- [ ] 沉沒成本防火牆 + status_quo modeling_assumption 標記到位
- [ ] `check_no_real_names.sh` 綠

---

## 11. 明確不做（邊界）

- ❌ 不反算 Core（容積/共負/財務一律讀 result）
- ❌ 不做 Strategy Engine（逐型建議動作 = M5）
- ❌ 不做 SDK / Plugin（延後，等領域深到值得暴露）
- ❌ 真實 Excel/資料不進 repo（僅本地校準 + 去識別化合成案例）

---

## 附錄 · 為什麼這是「蓋房子」不是「搭鷹架」

- Decision Engine 是**領域肌肉**：三方 EV、完工機率、破局引爆點——這是別人拿不出來的東西。
- 它讓 Core 的「名目財務」升級成「期望值決策」，把你在案例A/B/C 原型學到的血，變成可稽核的引擎。
- SDK/Plugin 是骨架；這個引擎是肉。**先養肉，再鍍框。**
