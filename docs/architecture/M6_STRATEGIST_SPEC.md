# M6 SPEC · THE STRATEGIST（憲法）

> **文件類型**：架構規格（docs/architecture/）
> **里程碑**：M6「軍師」THE STRATEGIST — Strategy Engine（建議層）
> **狀態**：規格定案 → **前置未達，尚不可動工**（見 §0）
> **前置**：M5.5 全數收尾（B1.5 / A軌傳動軸 / B2 / B3）＋ 部署同步 ＋ 同業複測通過
> **最後更新**：2026/07
> **核心命題**：Decision Engine 回答「這案子行不行」；Strategy Engine 回答「**那我該先做什麼、先談誰**」。
> 建議由引擎產生，UI 只呈現。引擎消費 Decision Engine + Workflow，不反算 Core。

---

## 0. 前置閘門（動工前必須全綠）

```
[ ] 部署站 = 最新程式碼（dashboard 含案件橫幅／決策徽章／傳動軸／圖說四格）
[ ] M5.5-A 軌完成：household_outcome schema 上線
    （逐戶分回權狀坪/室內實坪/可配單元/車位滿足）
[ ] M5.5-B1.5 完成：零步啟動 + 介面收斂至三個表面
[ ] M5.5-B2/B3 完成：同框駕駛艙 + 依賴高亮
[ ] 同業複測：「改公設比有感覺了」「不再覺得流程太多」
[ ] ownership_complexity 已進 Workflow schema（M6 雙軸模型的必要輸入）
```

> **為何要等**：M6 的產出（「這戶是恐懼型，建議上制度性擔保」）顯示在 STEP 3。
> 在一個玩家覺得太複雜、傳動軸未上線的介面上疊更聰明的建議，只會更難用。
> **先讓底層可用，再讓它變聰明。**

---

## 1. 定位與鐵律

### 在五層堆疊的位置
```
Core（Facts）→ Workflow（State）→ Decision Engine（Analysis）
   │                                      │
   │                                      ▼
   └──────────────────────▶ Strategy Engine（Recommendation）【本規格】
                                          │ strategy JSON
                                          ▼
                              Presentation（Workspace / Sandbox）
```

### 三條鐵律
1. **只消費，不反算**：讀 Decision Engine `decision` + Workflow `state` + Core `household_outcome`，
   **絕不重算** EV / verdict / 坪數。
2. **建議即權威**：所有「先談誰／怎麼談」由本引擎產出；UI **不得自行推導**。
3. **可解釋**：每一條建議必須攜帶 `reason` 與 `signals_used`，能回答「你憑什麼這樣建議」。

---

## 2. 雙軸模型（本規格最重要的設計決策）★

### 問題：舊的「三型並列」是錯的
先前討論曾把類型列為「策略型／恐懼型／程序型」。但**「程序型」不是心理類型**——
「願意但簽不了」是**產權事實**（M5.5 的 `ownership_complexity`），與「他心裡想不想」是**兩條正交的軸**。

### 正解：兩軸交叉

```
                    可簽性軸（事實，來自 Workflow）
                    signable              blocked
                 ┌──────────────────┬──────────────────┐
    策略型       │ 談判             │ 談判 + 產權清理   │
    strategic    │                  │                  │
                 ├──────────────────┼──────────────────┤
意  恐懼型       │ 制度性擔保        │ 擔保 + 產權清理   │
願  fearful      │                  │                  │
軸 ├─────────────┼──────────────────┼──────────────────┤
    反對型       │ 法定程序          │ 法定程序          │
    opposed      │                  │（不投說服成本）    │
                 └──────────────────┴──────────────────┘
```

**關鍵推論**：
- 一個**恐懼型 + blocked** 的戶，需要**同時**釋疑與產權清理——兩條平行軌，不是二選一。
- **blocked 的戶不該被算進「說服工作量」**，它是**行政工作量**。混在一起會嚴重誤判整合難度。
- 這解釋了實務上「明明都談好了，同意率就是上不去」的常見現象。

---

## 3. `stakeholder_profile` Schema（Schema First）

```json
{
  "household_id": "H-012",
  "willingness_type": "strategic | fearful | opposed | unknown",
  "signability": "signable | blocked",
  "blocking_reason": "inherited_unregistered | joint_ownership | mortgaged | illegal_structure | null",
  "is_key_household": true,
  "influence_targets": ["H-014", "H-021"],
  "classification_source": "recorded | suggested",
  "classified_by": "integrator | engine",
  "classified_at": "2026-07-24",
  "confidence": "high | medium | low",
  "signals_observed": ["questioned_capital_adequacy", "repeated_same_question"],
  "input_hash": "<溯源>"
}
```

### `classification_source` 紀律（與 M5.5 `willingness_source` 一致）
```
recorded  ← 整合人親自接觸後記錄（權威）
suggested ← 引擎依訊號推測（僅供參考，UI 須明確標示）
```
> **禁止**：引擎的 `suggested` 不得被呈現為既定事實。整合人才是真正見過人的那個。
> 引擎的角色是「提示可能性」，不是「替代判斷」。

---

## 4. 三型判定訊號（領域知識，來自三個真實案例）

| 類型 | 典型訊號 | 誤判成本 |
|---|---|---|
| **策略型**<br>strategic | · 在**關鍵時點**發難（簽約當天／前夜／核定次日）<br>· 提出**具體條件**要求<br>· 已在比較其他建商<br>· 態度隨條件變化而軟化 | 當成恐懼型 → 給擔保沒用，他要的是條件 |
| **恐懼型**<br>fearful | · 反覆問**同樣**的問題<br>· 關心「會不會拿不到房」「你們會不會跑」<br>· 質疑對方**財務實力／資本額／履約能力**<br>· **加碼後反而更懷疑** ★最強訊號 | 當成策略型 → **加碼會加深恐懼**，把他推得更遠 |
| **反對型**<br>opposed | · 情感因素、房子有特殊意義<br>· **拒絕討論條件本身**（不是嫌條件差）<br>· 時間偏好極長，無急迫性<br>· 蛋黃區、V₀ 高、status quo 對他很好 | 持續說服 = 沉沒成本，應走法定程序 |

> **判定紀律**：訊號只產生 `suggested`。最終 `willingness_type` 應由整合人 `recorded`。
> 引擎在缺乏訊號時輸出 `unknown`，**不得猜測**。

---

## 5. 對策庫（逐型 × 逐軸）

### 5.1 策略型 → 談判
```
建議動作：
  · 提出限時條件（移除「最後一個簽的優勢」→ 破解 holdout 均衡）
  · 引入第三方估價（讓「最終條件」變得可信）
  · 讓等待變貴（獎勵落日、時程壓力，客觀陳述非恐嚇）
禁止：
  · 顯露急迫（對方會判讀為還有空間）
```

### 5.2 恐懼型 → 制度性擔保 ★最重要
```
建議動作：
  · 續建機制（信託接管、指定第三人續建）
  · 母公司／關係企業連帶保證書（把口頭財力變成法律義務）
  · 履約保證、增資「到位後」提出證明（非「預計增資」）
  · 第三方估價、財務模型關鍵數字揭露
禁止（引擎必須主動示警）：
  · ❌ 加碼／提高分配比例 —— 會被解讀為「你還有空間」，加深懷疑
  · ❌ 口頭保證、以集團財力暗示（集團有錢 ≠ 簽約主體有擔保能力）
  · ❌ 用權威說法／AI 背書代替白紙黑字擔保
原則：用「制度的信用」取代「公司的信用」。
```

### 5.3 反對型 → 法定程序
```
建議動作：
  · 停止投入說服成本，轉向門檻策略（需要的是 80%，不是 100%）
  · 走法定程序（權變、多數決）
  · 確認是否可用不參與者補償路徑
禁止：
  · 持續加碼說服（ROI 極低）
```

### 5.4 blocked → 產權清理（平行軌，與意願無關）
```
inherited_unregistered → 協助辦理繼承登記
joint_ownership        → 共有人協議、公同共有處理
mortgaged              → 抵押權處理/塗銷路徑
illegal_structure      → 增建部分權益認定
關鍵：這是「行政工作量」，不是「說服工作量」，須分開計算與排程。
```

---

## 6. 「先談誰」優先序引擎（M6 招牌功能）

### 排序因子
```
priority_score =
    w1 · leverage          （權值比例；高權值 = 對門檻影響大）
  + w2 · key_household     （關鍵戶旗標；影響網絡）
  + w3 · convertibility    （可轉化性：恐懼型 > 策略型 > 反對型）
  + w4 · threshold_gap     （距門檻多遠；越接近越該衝）
  + w5 · cascade_risk      （反向雪崩風險，見 §7）
  − w6 · blocked_penalty   （blocked 戶不進說服佇列，改進行政佇列）
```
- 權重 `w1–w6` 存 `strategy_config.json`，可調（幅度歸調校、方向歸領域）。
- 輸出**兩條佇列**：`persuasion_queue`（說服）與 `administrative_queue`（產權清理）。

### 輸出必附解釋
每一條建議必須帶：
```json
{
  "household_id": "H-012",
  "rank": 1,
  "queue": "persuasion",
  "recommended_action": "institutional_guarantee",
  "reason": "恐懼型（已記錄）＋權值比例前 10%＋關鍵戶；加碼將反效果",
  "signals_used": ["questioned_capital_adequacy", "value_share_top_decile", "key_household"],
  "forbidden_actions": ["increase_allocation"]
}
```

---

## 7. 反向雪崩偵測（中正段那一課，寫進引擎）

```
觸發條件：
  · 關鍵戶（is_key_household）意願翻轉為 opposed / 觀望
  · 且其 influence_targets 中有 ≥2 戶在其後短期內同向變動
→ 輸出 cascade_risk = high

建議對策（引擎輸出）：
  1. 不加碼、不與發難者正面對抗
  2. 盤點「真實支持者」（意願高且已 recorded）→ 建議促其公開表態
     （偏好偽裝是雙向的：支持者也在沉默）
  3. 投放硬資訊（第三方估價、財務模型），讓跟風者能獨立判斷
     → 資訊瀑布是脆弱的：兩個真實聲音即可打斷
  4. 逐條公開回應質疑 —— 對象是旁觀的中間派，不是發難者
```

---

## 8. 輸出 Schema（版本化）

`strategy.schema.v0.1.json`
```json
{
  "strategy_engine_version": "0.1.0",
  "input_hash": "<指回 decision + workflow>",
  "case_id": "…",
  "persuasion_queue": [ { /* §6 建議物件 */ } ],
  "administrative_queue": [ { "household_id": "…", "blocking_reason": "…", "action": "…" } ],
  "cascade_risk": "low | medium | high",
  "cascade_countermeasures": ["surface_silent_supporters", "publish_hard_information"],
  "workload_split": { "persuasion_count": 12, "administrative_count": 5 },
  "assumptions": { "weights": { "w1": 0.3, "…": 0 } },
  "provenance_note": "對策庫源自 3 個實案 + 賽局/行為經濟理論；樣本有限，屬方向性建議"
}
```

---

## 9. 對抗性案例回歸（CI Gate）

```
Case A · 內爆型（中正段原型）
  輸入：全案管理低資本、地主質疑資本額、蛋黃區、關鍵戶發難
  斷言：
    ✓ 該戶分類 suggested = fearful（訊號：questioned_capital_adequacy）
    ✓ recommended_action = institutional_guarantee
    ✓ forbidden_actions 含 increase_allocation ★必須主動禁止加碼
    ✓ cascade_risk = high，且輸出 surface_silent_supporters

Case B · 背信型（桃園原型）
  輸入：合建、分配比例未定、地價翻倍、前期關係專屬投資高
  斷言：
    ✓ 標出 hold-up 曝險
    ✓ 建議含「分配比例封閉化」「估價基準日鎖定」「配合義務綁違約金」
    ✓ 不得建議「加碼換簽約」

Case C · 攔胡型（蘆洲原型）
  輸入：簽約前競爭報價「1坪換1坪＋車位」、8%→33% 公設
  斷言：
    ✓ 建議「以室內實坪／房地總價值對比」，非權狀坪對打
    ✓ 建議要求對手方 corporate substance 證明
    ✓ 不得建議無條件加碼跟進
```

---

## 10. 誠實限制（必須寫進 UI 與輸出）

```
· 對策庫源自 3 個真實案例 + 理論框架，樣本小 → 方向性建議，非保證
· willingness_type 的 suggested 僅為訊號推測，權威來源是整合人的 recorded
· 本引擎不預測結果，只建議下一步
· 與 stage_tree 相同：未經 portfolio 級校準前，不得呈現為決策保證
```

**Sandbox vs Workspace**
```
Sandbox（訓練）：profile 由劇本指派，classification_source = "simulated"
Workspace（實戰）：profile 由整合人記錄，classification_source = "recorded"
兩者不得共用欄位而不標來源。
```

---

## 11. Definition of Done

- [ ] `stakeholder_profile` schema 凍結、Validator 通過
- [ ] 雙軸模型落地（意願軸 × 可簽性軸，blocked 分流至行政佇列）
- [ ] 三型判定訊號表實作，缺訊號時輸出 `unknown`（不猜測）
- [ ] `classification_source` 標示正確（recorded / suggested / simulated）
- [ ] 對策庫含 `forbidden_actions`（尤其「恐懼型禁止加碼」）
- [ ] 先談誰優先序引擎輸出雙佇列，每條建議帶 `reason` + `signals_used`
- [ ] 反向雪崩偵測 + 對策輸出
- [ ] `strategy.schema.v0.1.json` 凍結
- [ ] 三個對抗性案例回歸全綠
- [ ] STEP 3 與 Decision Report 的「行動」空槽接上（UI 零推論）
- [ ] `check_no_real_names.sh` 綠

---

## 12. 明確不做（邊界）

- ❌ 不反算 Core / Decision Engine（EV、verdict、坪數一律讀上游）
- ❌ 不做 milestone→deadline→72hr 風險窗（= M7 WATCHTOWER）
- ❌ 不做 AI 談判 NPC（須先有本 schema；且 NPC 行為必須被 schema 綁定，
      不得是自由發揮的 chatbot）
- ❌ 不自動執行任何對外行動（引擎只建議，人決定）
- ❌ 真實地主分類資料不入 repo（僅本機；合成案例才進 tests/）

---

## 附錄 · 為什麼 M6 是護城河

- Core 會算 → 市面上很多工具會算
- Decision Engine 會判斷 → 少數機構做得到
- **Strategy Engine 會建議「先談誰、怎麼談、什麼絕對不能做」→ 幾乎沒有人做**
- 而它的知識來源，是三個真實破局案的第一現場：
  內爆（偏好雪崩）／背信（hold-up）／攔胡（外部競標）。
  **這不是抄得到的東西。**
