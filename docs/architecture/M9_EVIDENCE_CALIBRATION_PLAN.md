# M9 · Evidence & Calibration

狀態：**M9.0／M9.1 本機候選證據切片已實作，未發布正式 M9 tag**。日期：2026-10-06。此路線取自使用者提供的 M8 優化材料，並依使用者裁決保留既有 **M8 Viewfinder** 名稱與已發布的 M8.1–M8.4 歷史。M8.5 本機 GIS 仍是原路線的待辦；Evidence & Calibration 使用下一個里程碑 **M9**，不把兩組 M8.1 寫成同一成果。

## 產品目標與權威邊界

M9 讓案件判斷從「目前相信什麼」走到「當時根據什麼、後來發生什麼、模型錯在哪裡」。順序是 Evidence → 適用路徑／階段 → Agreement Structure → Holdout Exposure → Prediction → Outcome → Calibration。缺少來源、合法路徑或校準樣本時，系統應明示不足，不產出精確完成機率或投資結論。

- RE-DCF Core 繼續擁有容積、財務、權變等權威數值。Evidence 層不修改既有 Core 或 Project Schema。
- Workflow 保存可追溯事件與使用者紀錄；未驗證的紀錄不得變成已驗證來源。Dashboard 只消費正式模型輸出，不能自行計算 Holdout／EV。
- 既有 Decision 存活率參數尚未經真實成敗案校準。M9 初期只能提供資料涵蓋、候選證據與方向性提示；不得把 ordinal 等級或主觀信心標成失敗機率。
- Site Geometry 另走 [獨立提案 PR #41](https://github.com/jeremy0819/BUILDER/pull/41)，不混入 M9 證據切片；合成 3D 仍不能代表本案。

## M9.0／M9.1：已定義的第一個切片

`schemas/evidence_fact.schema.v0.1.json` 是候選事實的版本化契約。每筆須有 case/subject、field/value、`evidence_type`、來源版本、觀察／有效／登錄日期、質性信心與 `verification_status`。四種 evidence type 的語義不可合併：

| 類型 | 含義 | v0.1 條件 |
|---|---|---|
| `observed` | 使用者記錄的文件、接觸或已發生事件 | 需來源與觀察日期；**仍標未核驗** |
| `assumed` | 分析者明示的假設 | 不得附觀察日期或冒充模型輸出 |
| `inferred` | 模型從既有證據推論 | 需模型版本與先前 fact ID；手動表單不提供此選項 |
| `calibrated` | 由歷史資料估計 | 需模型、參數版本、證據快照 hash 與先前 fact ID；手動表單不提供此選項 |

本機 `evidence_facts` 只在案件總覽的收合面板手動新增 observed／assumed。介面只追加，不提供修改或刪除；這是**介面行為**，不是對使用者可編輯的瀏覽器儲存或匯入 JSON 的防竄改保證。寫入前會重讀案件並檢查舊清單未改，格式異常則保留原資料並拒寫。每筆上限與總筆數上限控制瀏覽器儲存量。登錄後不自動改 `engine`、Data Status 的「待查核」、法規結論或 Decision 輸出；來源文字也不等於外部核驗。

本切片不把私人來源文件、姓名或真實案件放進版控。使用者本機紀錄會隨既有案件備份匯出；公開報告不應自動引用原始來源文字。`confidence` 是人工質性註記，不是統計置信度。未來如需正式核驗，另訂驗證者、方法、版本、有效期和撤銷／更正契約，不能直接把 v0.1 的 `unverified` 改字。

## 後續施工與開工門檻

| 階段 | 核心交付 | 開工／顯示門檻 |
|---|---|---|
| M9.2 Legal／Route State | 適用城市、法律路徑、程序階段與法源版本 | 先核對當期官方條文、適用範圍與案例類型；附件中的門檻數字只是待查提議，不能直接寫成程式常數 |
| M9.3 Agreement Structure | 人數、土地／建物面積、權屬複雜度與門檻距離 | 逐戶權利與同意事件完整，依已確認路徑的計數基礎；只得彙總已知資料 |
| M9.4 Stage-aware Holdout v0 | Veto／Outside Option／Wait Ability／Our Commitment 的序等級及來源 | 已知路徑、階段、證據；不以固定乘積冒充機率，不推斷心理 |
| M9.5 Exposure | 延誤／重談／法律與失敗損失的情境範圍 | 成本假設與事件邊界可追溯；未校準不顯示 Expected Holdout Loss 點估計 |
| M9.6 Prediction Ledger | 凍結預測目標、時間、證據快照、模型與參數版本 | 先有可定義且可觀測的目標；建立後只能新增更正紀錄，不能覆寫原預測 |
| M9.7 Outcome Ledger | 按預定 horizon 記錄實際結果與觀察證據 | Outcome 不得改 Prediction；失訪與未知不能當失敗 |
| M9.8 Calibration | 可靠度圖、分群、Brier／Log Loss 與樣本揭露 | 樣本、版本與預測期一致；先人工審核，不自動調參；分數不單獨代表校準良好 |
| M9.9 Stability v1 | 可解釋的整合、財務與時程風險摘要 | 各上游資料達門檻；完成機率需獨立外部驗證，否則只示方向與缺口 |

Dashboard 將逐步呈現**有來源的** Legal Route、Agreement Structure、關鍵阻塞、財務快照與趨勢；沒資料的格子顯示缺口。3D 留在基地／量體工作區。Counterfactual 與 Multi-Agent 研究排在 M9 校準門檻之後，不以模擬次數替代真實驗證。

## CI 與資料品質門檻

1. `assumed`／`inferred` 不得渲染成 `observed`；所有 v0.1 人工紀錄一律 `unverified`。
2. 推論、校準需具模型與證據 lineage；未校準風險分數不得顯示為機率。
3. 預測一旦建立不可原地改寫；Outcome 只能引用 Prediction。不同模型版本不可靜默混算校準指標。
4. 法規路徑、同意結構與 Veto 必須依已核對的適用條款及程序階段；缺路徑不作可行性結論。
5. 真實個資不入測試 fixture、公開頁或版控；匯入損壞不得清空既有本機資料。

本輪僅實作第 1 項的候選證據部分，並為其加入 schema、純函式和真瀏覽器測試。其餘門檻在對應功能 PR 施工時逐一落入 CI，不以本文件自稱已完成。
