# Urban Renewal OS — 第一性原理與決策框架

> 本檔是 BUILDER 的**知識脊椎**：定義「這個系統到底在優化什麼」。
> 產品、Roadmap、每一個新頁面都對齊這裡。保持精簡（≤150 行）；理論擴充才拆檔。

## 第一性原理

都市更新真正交易的，**不是土地，而是「可履行的合作關係（cooperation）」**；
地主意願是形成合作關係最重要、也最不穩定的因素。

- 土地不是商品，意願也不是商品。
- 真正的商品是「**一個能走到實施的專案**」＝土地＋法律＋建築＋財務＋人＋時間。
- 其中最不可控的是**人的合作**。

∴ Urban Renewal ≠ Land Development ＝ **Cooperation Engineering**。
系統要優化的是**合作的形成與維持**，不是試算表運算。

## 架構反轉

現況是「Core → Calculator → Dashboard」（計算在中心）。目標把它倒過來：

```
Knowledge → Decision Engine → Workflow → Execution → Calculation → Visualization
```

**Calculator 變成一個 service，不是產品的中心。**
Workflow 消費 Core；Core 仍是唯一計算引擎（SSOT 不變）。

## 四層決策框架（產品逐步對齊）

| 層 | 名稱 | 核心問句 | 產出 | 例子 |
|---|---|---|---|---|
| L0 | Diagnosis 診斷 | 這案子**該不該做**？ | GO / CAUTION / STOP | 意願結構、關係人複雜度、EV 失衡、期限地圖 |
| L1 | Structuring 結構化 | 合作**該怎麼設計**？ | 合約/誘因結構建議 | 誘因、合約完整度、風險分配、時程對稱 |
| L2 | Execution 執行 | 專案**該怎麼管**？ | 事件/節點監控 | 同意事件、關係人流程、里程碑、72hr 風險窗 |
| L3 | Exit 退場紀律 | **還值不值得投**？ | 續做 / 停損 | 邊際 EV、沉沒成本防火牆、結算分析 |

Workspace 的分頁（財務快照/同意看板/時程任務/決策紀錄）長期對應 L2；
L0 診斷＝M4 方向、L1 結構化＝M5 方向（見下）。

## 方向（記錄，不是已排程承諾）

版本語彙從「加功能」轉為「補決策層」——實際排程仍以 `docs/architecture/ROADMAP.md` 為準：

- **M3 = Urban Renewal Workflow**（案件管理層，非新計算器）— 進行中（C1 契約完成、C2 Workspace 骨架）。
- **M4 方向 = Decision Engine / L0 診斷**（意願地質、地主/實施者 EV、集中度風險）——不是「財務 IRR」。
- **M5 方向 = Structuring Engine / L1**（如：地主等待成本過低 → 建議限時簽約）。
- **M6 方向 = Execution Monitor / L2**（重大節點 72hr 高風險提示）——不是「完成率」。
- **M7 方向 = Exit Discipline / L3**（EV 下降 → 建議停止投入）——不是「繼續做」。

長期願景：Urban Renewal OS → **Urban Renewal Decision System**。
護城河不是 UI、不是 Streamlit、不是 DCF，而是**從真實案件累積的決策框架**。

## 規則出處紀律（知識體系的嚴謹性）

系統裡每一條規則都要標來源，**不要把經驗當成普遍定律**：

- **法規規則**：都市更新條例／危老條例等法令（硬約束）。
- **財務模型**：DCF、選擇權、賽局理論等成熟方法（可驗證）。
- **實務啟發（heuristic）**：由去識別化案例（案例A/B/C…）歸納——**可持續驗證、可修正**，非定律。
  例：「重大節點前後 72hr 是最高風險窗」「地主因地價上漲背信」「沉默多數比反對者重要」
  ——皆為 heuristic，實作時須標 `source: heuristic` 並允許被案例推翻。

## Decision-OS 頁面關卡（每新增一頁前必答）

在寫任何新 UI 之前，先回答四題，**四題全過才動手**：

1. 它支援哪一層（L0–L3）？
2. 它幫使用者做**哪個決策**？（不是「顯示哪個數字」）
3. 它是否只是 Calculator 的另一種包裝？（是 → 退回重想）
4. 是否仍遵守 SSOT（Core 為唯一計算來源，UI 零計算）？

## 案例知識（紅線：零真實資料進版控）

案例庫是理論的驗證來源，但**段名/姓名/金額不得進版控（含檔名）**（紅線 3、Gate 0）。
因此案例反思採兩條路：

- **合成標籤**：`案例A/B/C`（去識別化）＋每案末章 `Reflection → 對應 L0–L3`。
- **真實案件**：留在本機（同 Workspace localStorage 模式），永不 commit。

閉環：**案例（本機）→ 抽象成 heuristic（本檔）→ 產品（Decision layers）→ 回頭被案例修正**。
