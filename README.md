# BUILDER — Urban Renewal Decision OS

![CI](https://github.com/jeremy0819/BUILDER/actions/workflows/ci.yml/badge.svg)

> 都市更新真正在交易的，不是土地，是**能不能履行的合作關係**。
> BUILDER 幫你判斷一個案子值不值得做，以及**下一步該先找誰談**。

**線上試用**：https://jeremy0819.github.io/BUILDER/ ｜ 打開就有四個合成示範案，免安裝、免匯入。

**0.7.0 開發批次（尚未建立正式版本標籤）**：四步共用案件面板與合成 3D 操作展示已實作；範圍、資料門檻與測試結果見 [實作紀錄](docs/releases/OS_0_7_LOCAL-2026-09-27.md)。

**目前開發方向**：既有 M8 Viewfinder 圖表功能保留原里程碑；下一條 **M9 Evidence & Calibration** 先建立證據紀錄與溯源，再研究法規路徑、同意結構、預測與校準。見 [M9 路線](docs/architecture/M9_EVIDENCE_CALIBRATION_PLAN.md)。

---

## What is BUILDER?

一套判斷**都市更新／危老案該不該做、該怎麼推**的決策系統。

市面上的工具算得出「這案子賺多少」。BUILDER 多回答兩個問題：

| 問題 | 誰在回答 |
|---|---|
| 這案子**行不行**？ | 決策引擎：三方期望值、完工機率、GO/CAUTION/STOP、誰會先翻桌 |
| 那我**先做什麼**？ | 策略引擎：先談誰、怎麼談、**什麼絕對不能說** |

它不是試算表。BUILDER 將名目報酬、時程與整合風險放在同一個決策流程中；
目前完工機率使用**尚未以真實成敗案校準的模型假設**，只能供方向性比較，不能視為實際成功率。

**一個具體例子**：某戶反覆質疑你的財力。系統會判定他是「恐懼型」，建議**上制度性擔保**，
並**主動禁止你加碼**——因為對這型人加錢，只會被解讀成「你果然還有空間」，把他推得更遠。
這條規則寫在程式裡、有回歸測試守著，不是文件上的建議。

---

## Who is it for?

| 你是 | BUILDER 幫你 |
|---|---|
| **開發商／建商評估人員** | 早期篩案：這案子的期望值撐不撐得住，破局風險在哪一方 |
| **都更整合人** | 名冊分型 → 談判順序：先鞏固誰、誰該走法定程序、誰其實是「願意但簽不了」 |
| **建築師／都更顧問** | 規劃決策的財務後果：改公設比、改坪型，地主接受度怎麼變 |
| **機構投資者** | 可稽核的決策軌跡：每個數字都能溯源到同一個計算核心 |

**不適合**：找純試算表的人（那用 Excel 就好）；期待它給投資保證的人（見下方誠實限制）。

---

## Workflow

四步動線，每一步的產出交棒給下一步：

```
① Site 基地與量體  ② Product 產品     ③ People 地主      ④ Decision 決策
   基地輸入與草案 →   財務重算      →     整合紀錄     →    逐型對策
   草圖僅供參考      容積/坪效/財務      同意與任務          先談誰・什麼不能說
```

- **① 基地與量體**：核對基地面積、容積條件與樓層草案；參考草圖不參與 Core 或真實 footprint 計算。
- **② 產品**：承接①的數值草案，調整產品與財務輸入後由 Core 重算。
- **③ 地主整合**：查看逐戶同意紀錄、任務與示意推演；缺少逐戶事實時不分配虛構的同意戶。
- **④ 決策**：拿到 GO/CAUTION/STOP ＋ 一張逐戶行動清單。

---

## 15-minute Demo

不需安裝，開瀏覽器就能走完：

1. **開 [線上站](https://jeremy0819.github.io/BUILDER/)** →「駕駛艙」。四個合成示範案已預載（A 蛋黃區／B 合建／C 危老／D 權變示範）。
2. **① 基地**：用左上切換案件。展開「產權清冊」——這是謄本欄位。
   試著把某戶的「限制登記」改成**繼承未辦**，它會自動變成「簽不了」，落入**產權清理**佇列。
   > 這是 BUILDER 的核心洞察：**「願意但簽不了」是行政工作，不是說服工作。**
   > 混在一起算，會嚴重誤判整合難度——也解釋了「明明都談好了，同意率就是上不去」。
3. **② 產品**：基地條件已自動帶入。拖動滑桿，看共負比與投報率即時重算（在你瀏覽器裡跑同一份計算核心）。
4. **③ 人心**：直接進入整合推演——規劃已在①②定案，不會再問你一次。財務數字是**這個案子的**，不是罐頭範例。
5. **④ 決策報告**：對每戶選「意願型別」與「可簽性」→ 得到**先談誰**清單，每條都帶理由、依據訊號、**禁止動作**。

**判斷成功**：某戶選「恐懼型」→ 他跳到第一位，建議「制度性擔保」，禁止事項寫著**加碼**。

### ⚠️ 誠實限制（請先讀）

- 判讀是**方向性判斷，不是投資結論**。完工機率所依的階段存活率**尚未用真實成敗案校準**。
- 對策庫源自 3 個真實破局案 ＋ 賽局／行為經濟理論，**樣本小**。
- 引擎的分型只是「建議」，**權威永遠是親自見過那個人的整合人**。
- 本庫**零真實案件資料**，所有示範案與清冊皆為程式合成。

---

## Architecture

五層，每層只消費上一層的輸出，不跨層發明：

```
Core（計算・唯一真源）→ Workflow（案件狀態）→ Decision Engine（判讀）
                                              → Strategy Engine（建議）→ Presentation（畫面）
```

三條紅線讓它可信：

1. **公式只有一份**：所有財務數字出自 `core/redcf`，畫面一個數字都不自己算。
2. **畫面零推論**：GO/CAUTION/STOP、期望值、行動清單一律由引擎產出。
3. **零真實資料進版控**：段名／姓名／金額有自動檢查擋著（CI Gate 0）。

細節見 [`ARCHITECTURE.md`](ARCHITECTURE.md)。

---

## Roadmap

| 里程碑 | 內容 | 狀態 |
|---|---|---|
| M1–M3 | 計算地基／產品地基／案件管理 | ✅ |
| M4 | 決策引擎（三方期望值、破局引爆點） | ✅ |
| M4.5 | 財務與係數對真實案校準 | ✅（存活率未校準） |
| M5 / M5.5 | 四步動線／傳動軸即時運算 | ✅ |
| **M6** | **策略引擎：逐型對策** | ✅ 引擎完成，待同業複測 |
| M7 | Case OS：Activity、Watchtower、Scenario、歸因與樓層面積視圖 | ✅ 已出貨 |
| M8 Viewfinder | 圖表契約、歸因瀑布、互動樓層與敏感度地圖 | M8.1–M8.4 已完成；M8.5 本機 GIS 待做 |
| M9 Evidence & Calibration | 證據、適用路徑、同意結構、預測／結果與校準 | M9.0／M9.1 本機候選證據切片已實作；後續階段待做 |

**現在最需要的是可追溯的真實回饋**。示範案不能校準成功率；M9 先分清觀察、推論與假設，後續再以凍結的預測和實際結果檢驗模型。

完整路線見 [`docs/architecture/ROADMAP.md`](docs/architecture/ROADMAP.md)。

---

## Developer Docs

| 想做的事 | 讀哪份 |
|---|---|
| 本機跑起來、跑測試、CI 全部 Gate | [`docs/DEVELOPING.md`](docs/DEVELOPING.md) |
| 驗證機制、請求流程與憑證邊界 | [`docs/architecture/AUTHENTICATION.md`](docs/architecture/AUTHENTICATION.md) |
| 架構裁決與資料流 | [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| 產品第一性原理 | [`knowledge/00_FIRST_PRINCIPLES.md`](knowledge/00_FIRST_PRINCIPLES.md) |
| 決策引擎規格 | [`docs/architecture/DECISION_ENGINE_SPEC.md`](docs/architecture/DECISION_ENGINE_SPEC.md) |
| 策略引擎規格（M6） | [`docs/architecture/M6_STRATEGIST_SPEC.md`](docs/architecture/M6_STRATEGIST_SPEC.md) |
| 版本規則／發布流程 | [`governance/VERSION_POLICY.md`](governance/VERSION_POLICY.md)、[`docs/releases/CHECKLIST.md`](docs/releases/CHECKLIST.md) |
| AI session 接手 | [`CLAUDE.md`](CLAUDE.md) |

---

**授權：Proprietary（保留一切權利）** — 見 [`LICENSE`](LICENSE)。
公開供閱覽，未經書面同意不得使用／重製／散布。
