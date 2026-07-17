# Urban Renewal OS — 階段節點報告（M1→M4 落地）

> **文件類型**：階段節點報告（docs/releases/）
> **報告日**：2026-07-17　**基準 commit**：`a2c4b8d`（main，單線）
> **座標**：core 0.3.0／schema 凍結 8 檔／CI 八道 Gate 全綠
> **上一份**：`PROGRESS_REPORT-2026-07.md`（M2 關閉時點）

---

## 一、節點總覽（已完成）

| 節點 | 內容 | 狀態 |
|---|---|---|
| **M1 工程地基** | CI 八 Gate、Pages/Streamlit 部署、release 治理、單線 main | ✅ 關閉 |
| **M2 產品地基** | schema v2 家族凍結、Core Interface 四動詞、UI Binding、os-v0.2.0-beta | ✅ 關閉（Final Review 通過） |
| **M3-A 權變核心** | `rights.py` §56 逐戶分回＋找補、`cashflow.py` 結構 v1、schema v2.1 | ✅ |
| **M3-C Workflow OS** | C1 wf-1.0 契約 → C2 工作區骨架 → C3 同意看板（事件重放狀態機）→ C4 任務/決策日誌 → C5 時間軸/多快照/wf 匯出入 → C6 沙盤橋接 | ✅ 閉環 |
| **B1–B5 沙盤深化** | 係數矩陣（含樓層 1F 3.0×）、三滑桿 12–80 戶、三態＋選屋券、匯入開局、結局權變表 | ✅ |
| **M4 決策引擎 v0.1** | `decision.py`：三方 EV／完工機率階段樹／verdict＋引爆點／exit＋沉沒成本防火牆／urgency；decision.schema.v0.1 凍結；三對抗案例入 CI；Workspace 只呈現 | ✅ 落地 |
| **方向校正** | `knowledge/00_FIRST_PRINCIPLES.md`：合作（非土地）＝稀缺標的；四層決策框架 L0–L3；頁面四題關卡 | ✅ 入憲 |

## 二、本節點的三個關鍵躍遷

1. **計算器 → 決策系統**：五層堆疊成形（Knowledge → Core → Workflow → Decision → Presentation），
   每層只消費上一層。Calculator 正式降為 service。
2. **名目財務 → 期望值**：M4 把「算得出多少」升級為「拿得到的機率是多少」——
   三方 EV 揭穿了案例A原型的結構性破局（實施者正、地主負＝引爆點），
   這是 Excel 給不出的診斷。
3. **事實與判斷分層執法**：Workspace 永不自行推論（紅線 6）；decision JSON 以
   input_hash 配對、錯 hash 拒收；沉沒成本進 exit 決策式＝直接 raise。

## 三、品質與紀律（驗證快照）

- pytest **81**（黃金＋合約＋workflow＋valuation 9＋decision 10）；沙盤 headless **69**；workspace **42**
- Gate 6 凍結 **8 檔**（v1.1/v2.0/v2.1/三視圖/wf-1.0/decision v0.1）
- Gate 0 零真名（兩份規格入庫前已去識別化）；`/local_calibration/` gitignored
- Python↔JS 雙鎖：同意狀態機、B1 權值矩陣（LCG 位元對齊）皆以同一組正典序列鎖住不分歧

## 四、誠實註記（未盡與風險）

- **stage_tree 存活率＝示意預設**：未經真實案件校準前，verdict 只能當方向感，不能當投資判斷。
- 實施者/我方 EV 的 mgmt_fee、advance 等＝呼叫端輸入（建模假設），result 尚無此欄。
- S 曲線/IRR、stakeholder_profile（三型分類）、Strategy Engine 均未動（依禁區延後）。
- os-v0.3.0 release tag 需 repo 擁有者在 GitHub UI 手動發（egress 403）。

---

## 五、下一階段與未來規劃（命名）

### 下一階段（立即）：**M4.5「試金石」TOUCHSTONE**
> 引擎從「懂原理」升到「可信賴」的唯一路徑＝真實校準。
- 以 1–2 份真實案件 Excel 在 `/local_calibration/` 本地校準：stage_tree 存活率、
  status_quo 基準與 g、更新前價值係數（只抽公式、數字不進版控）。
- 校準後發布 **os-v0.3.0**（M3+M4 合併節點 release）。
- 產出 `DOMAIN_DEPTH_LEDGER.md`：每道 Gate 配一個領域深度問題（骨架長一寸、肉跟一寸）。

### M5「軍師」THE STRATEGIST — Strategy Engine（建議層）
- 前置：workflow schema 增 `stakeholder_profile`（策略/恐懼/反對，schema 先行）。
- 逐型對策引擎：恐懼型→擔保與資訊、策略型→談判結構、程序質疑型→留痕與透明。
- Workspace 同意看板掛建議動作（仍由引擎產出，UI 只呈現）。

### M6「瞭望塔」WATCHTOWER — Execution Monitor（執行層）
- Workflow 補 milestone→deadline→event window；重大節點 72hr 風險窗提示
  （heuristic，標來源、可被案例推翻）。
- decision_urgency 接上真實時窗（w2 權重生效）。

### M7「停損線」STOP-LOSS — Exit Discipline（退場層）
- 邊際 EV 趨勢追蹤（ev_trajectory 由歷史 decision 序列餵入，w4 生效）。
- 停損劇本化：exit_signal 觸發時產出「止血報告」（現值、可回收、替代路徑）。

### 終點命名：**Urban Renewal Decision System v1.0「整合人 OS」**
> M4.5–M7 收斂後改名定版：從 Urban Renewal OS（工具集）→ Decision System（決策系統）。
> 護城河＝從真實案件累積、可稽核、可校準的決策框架——不是 UI，不是 DCF。

---

*報告完。下一動作建議：M4.5「試金石」——請提供 1–2 份可本地校準的真實案件 Excel（僅本機使用）。*
