# Urban Renewal OS 專案狀態報告
### Project Status Report — 都市更新／危老開發評估數位體系（M2 收斂版）

| | |
|---|---|
| **報告對象** | 專案負責人／開發部 |
| **報告日期** | 2026-07-11 |
| **報告範圍** | `jeremy0819/BUILDER`（Urban Renewal OS monorepo）＝已收編 RE-DCF-Tool（計算核心）＋ Urban-Renewal（靜態站與方法論） |
| **基準提交** | `e1fdb64`（`claude/urban-renewal-os-arch-freeze-svoum0`，第 21 次提交） |
| **對照前報** | `docs/methodology/Urban-Renewal-狀態報告-2026-06.md`（2026-06-22，單庫階段） |
| **查證原則** | 法規／稅制沿用 2026-06 前報之網路查證結果（來源見前報附錄 A）；**本週期未新增網路查證**，如需最新條文請重新核對主管機關公告 |
| **資料邊界** | 全庫去識別化；CI Gate 0 + `check_no_real_names.sh` 守衛，段名／姓名／金額零命中（含 commit 訊息） |

---

## 一、執行摘要 Executive Summary

**一句話：** 前報（2026-06）的「可上線知識庫＋互動工具」已升格為一套**有計算真源（SSOT）、有凍結合約、有 CI 守衛、可重算可稽核**的都市更新作業系統（Urban Renewal OS）；本期完成**三庫合併（monorepo）→ M1 基礎建設 → M2 合約基礎**，並把前報點名的「遊戲真實感」與「與計算工具串接」兩大缺口**結構性解決**。

- **里程碑：** M1 完成（`os-v0.1.0-alpha` 已發）；**M2 收斂完成**——schema v2.0 完整可重算合約**已凍結**、Core 四動詞門面成形、UI 綁定圖建立、遊戲介面統一（`os-v0.2.0-beta` 前置就緒）。七項 FINAL REVIEW 全 PASS（見 `M2_CLOSE_REPORT.md`）。
- **前報缺口處置：** G1（釘子戶不夠黏）→ **已解**（關鍵戶 W47 對金錢免疫、僅三次傾聽可攻略）；G3（財務單向、多結局虛設）→ **已解**（規劃 6 方案財務由 Core 重算，共負比直接決定難度與勝負節奏）；與 RE-DCF 串接 →**已從「串接」升級為「合併同源」**（計算核心直接住進 OS，前端零公式、只讀 result）。
- **品質與資安：** 良好。`pytest 33`＋`headless 24`＋**CI Gate 0–6（＋Gate 1.5 套件安裝）**全綠；SSOT 執法（前端一條公式都沒有）；schema 位元組凍結守衛上線。
- **主要風險／缺口：** ① 逐戶**權利變換／找補**與 owners 輸入 UI 尚未實作（排 M3）；② IRR／現金流時間軸尚未建模（排 M4）；③ `os-v0.2.0-beta` 的 Release/tag 需 repo 擁有者於 GitHub UI 建立（環境 egress 擋 tag push）。
- **建議下一步：** 進入 **M3（權利變換/找補＋owners UI）**，並把 `開發模式思維補遺` 的四個洞察（融資閘門燈號、信託信用機制、三態地主＋選屋籌碼、交屋流動性結局）依《整合人手冊》逐項落地。

---

## 二、專案現況與定位 Situation & Positioning

前報的 `Urban-Renewal`（知識層）與 `RE-DCF-Tool`（計算層）為**兩個分離的庫**；本期依 Architecture Freeze 的六大裁決（D1–D6）執行 `MIGRATION_PLAN`，把兩者**合併為單一 monorepo `BUILDER`（→ Urban Renewal OS）**，形成清楚的三層分工：

1. **計算層（SSOT）**：`core/redcf/` — 唯一公式來源（容積查核 §162／坪效／共同負擔 L6／投報／估值）。**任何消費端不得重算**（含 warnings 門檻）。
2. **合約層**：`schemas/` — v1.1（凍結）＋ **v2.0「完整可重算合約」（凍結）**＋三視圖（input/output/metadata）。給 Core 一份 v2 檔即可回放出 result。
3. **消費層**：`apps/web/`（開發評估儀表板＋URBAN STRAND 整合模擬器）＋ `apps/streamlit/`（RE-DCF 精算 Demo）——**只讀 result、只做呈現**。

> 定位轉變：前報是「一套可離線的都更知識與訓練工具」；本期起是「**一套以計算真源為心臟、以凍結合約為血管、以 CI 為免疫系統的都更決策 OS**」。方法論仍在（`docs/methodology/`），但已從「主庫」退位為 OS 的知識層。

本期（合併後工作週期）內，OS 累積 **21 次提交**，交付四層：**核心（Python package）／合約（凍結 schema＋遷移器）／應用（儀表板＋統一版模擬器）／治理（governance＋CI 六道 Gate＋手冊）**。

---

## 三、資產盤點 Asset Inventory

| 交付物 | 類型 | 規模／版本 | 狀態 | 用途 |
|---|---|---|---|---|
| `core/redcf/`（capacity/efficiency/finance/valuation/contract/recompute/migrations/api） | Python 計算核心（SSOT） | 1,311 行 · CORE 0.2.0 | ✅ 凍結門面 | 唯一公式來源；四動詞對外介面 |
| `schemas/project_schema_v2.json` ＋ `schemas/v2/*`（三視圖） | 可重算合約 | v2.0 **已凍結** | ✅ Gate 6 hash 守衛 | input＋result＋provenance；給 Core 即可回放 |
| `apps/web/index.html` 開發評估儀表板 | 互動網頁 | — | ✅ 上線就緒 | 逐層樓板、可重算驗證徽章、provenance、跨案比較 |
| `apps/web/os-simulator.html` URBAN STRAND（統一版） | 互動遊戲 | v2 · 統一版面 | ✅ 上線就緒 | 整合訓練：PLAN PHASE×規模、進度脊、48 戶矩陣、CODEC、家族羈絆 |
| `apps/streamlit/app.py` RE-DCF 精算 | Streamlit Demo | v4.9 | ✅ 上線就緒 | 精確計算、匯出 Project JSON |
| `core/redcf/migrations.py` 遷移器 | 版本相容 | 1.0→1.1→2.0 | ✅ 測試綠 | 舊檔鏈式升級；缺 floors→input_complete=false |
| CI（`.github/workflows/ci.yml`） | 工程守衛 | Gate 0–6 ＋ Gate 1.5 | ✅ 全綠 | 資料紀律／pytest／Core 隔離／範本／連結／遊戲核心／schema 凍結／套件安裝 |
| `docs/handbook/整合人手冊.md` | 方法論手冊 | 本期新增 | ✅ 完成 | 開發模式重整＋新見解＋與 OS 的接點 |
| `docs/handbook/URBAN_STRAND架構手冊.md` | 遊戲架構手冊 | 至 M2 | ✅ 完成 | SIMCORE／SCEN／SSOT 邊界／版面／可測性 |
| `governance/`（MODEL_DISPATCH/JUDGMENT_RUBRICS/VERSION_POLICY…） | 治理制度 | — | ✅ 沿用 | 派工、驗收、版本、維護紅線 |
| `docs/methodology/*`（開發流程架構／投報正典／開發模式補遺／整合總論） | 方法論正典 | 沿用 | ✅ 已收編 | S1–S11、六科目、模式選擇、地方法規 |

**技術一致性：** 前端仍為**單一自含 HTML（inline CSS＋原生 JS，零依賴、零建置、可離線）**；計算核心為**可 pip 安裝的 Python package**（`pyproject.toml`，clean venv import 由 Gate 1.5 守衛）。前端與核心的邊界＝Project JSON 合約，非函式呼叫。

---

## 四、技術與品質評估 Technical & Quality Assessment

### 4.1 架構（本期核心升級）
- **SSOT 執法**：公式只在 `core/redcf/`；`tools/check_core_isolation.py`（Gate 2）封鎖 streamlit/plotly 後核心仍能 import＋計算，證明零 UI 依賴。前端（含遊戲層）**零財務公式**——遊戲的 SCEN 財務值是 Core recompute 烘焙進去的唯讀常數。
- **可重算合約（D3 落地）**：v2.0 把重算所需輸入（逐層 `floors[]`）收進 input，`recompute(engine)` 可回放出 result，`verify()` 逐欄位比對（容差：面積/金額 0.5、比率 1e-6）。稽核鏈從「數字無法回放」變成「檔案自證」。
- **四動詞門面**：`calculate / validate / serialize / deserialize`（`core/redcf/api.py`），消費端只依賴這層。

### 4.2 資安與資料紀律（2026-07）
| 項目 | 結果 |
|---|---|
| 真實案名／段名／金額／人名（工作區＋commit 訊息） | ✅ 零命中（Gate 0 + `check_no_real_names.sh`） |
| 對外資料傳輸／密鑰／token | ✅ 無（純前端＋本地 Python，零外送） |
| schema 位元組凍結 | ✅ Gate 6 守衛 v1.1＋v2.0＋三視圖 sha256 |
| 遊戲 `localStorage`／PII | ✅ 無落地（狀態在記憶體） |
| 供py/（真實案夾） | ✅ `.gitignore` 排除，絕不進版控 |
| 殘留（低風險） | 🟡 前端字型走系統 fallback（不影響功能）；Artifacts/Pages 皆無外連字型 |

### 4.3 品質驗證（實測，非臆測）
- **自動化**：`pytest 33 passed`（黃金＋合約＋schema v2 可重算＋API 四動詞＋凍結守衛）；`node headless 24 passed`（遊戲機制＋可贏性 8–24 週）；CI **Gate 0–6＋Gate 1.5 全綠**。
- **可重算實測**：4 個 v2 範例 `verify()` 逐欄位相符；竄改 result 數字後 `validate()` 能抓出「無法回放」。
- **遊戲實測**（Chromium 實開一局：危老×積極拉滿）：統一版面渲染零 console error；進度脊（S1–S6 流程＋逐戶旅程軌）、48 戶矩陣、Core 試算情報欄一體呈現。

---

## 五、法規與市場查證 Regulatory & Market Verification

> **本期未新增網路查證**；下表為前報（2026-06-22，來源見前報附錄 A）與 `CLAUDE.md`／方法論正典之**已查證基準的濃縮**，供對照。實務適用請以查證日之後的現行條文為準。

| 主題 | 查證結論（基準：2026-06／方法論正典） |
|---|---|
| 都更同意門檻（§37） | 自劃更新單元 3/4、政府劃定 1/2；面積逾 9/10 同意者人數不計 |
| 都更容積獎勵（§65 ＋辦法） | 上限約基準容積 **1.5 倍** |
| 危老容積獎勵（§6） | 上限法定 1.3 倍 或 原建築 1.15 倍；**時程獎勵已於 2025/5 遞減歸零落日** |
| §162 免計容積 | 陽台 ≤10%／梯廳 ≤10%／合計 ≤15%／機電 ≤15%（逐層）——本 OS 於 `core/redcf/capacity` 實作 |
| 房地合一 2.0／囤房稅 2.0 | 分回建物適用新制、土地視身分別；囤房稅全國歸戶（見《整合人手冊》§稅制分裂） |
| 共同負擔比＝融資閘門 | 開發成本占總銷 **<70%** 為 100% 土建融的實務門檻（[CASE]，見手冊） |
| 2026 房市 | 「價緩跌、量盤整」；素地難求＋限貸 → 開發火力集中都更危老 |

---

## 六、關鍵發現 Key Findings（對照前報缺口）

### 強項 Strengths
1. **計算有真源、合約可凍結、稽核可回放**——從「工具」升級為「系統」，數字全程可溯源到 `result` 與 `input_hash`。
2. **SSOT 由 CI 強制**：不是靠自律，是 Gate 2 隔離＋前端零公式＋Gate 6 凍結三道機制頂著。
3. **遊戲＝方法論的可玩化**：PLAN PHASE 讓「建築規模×模式 → 共負比 → 整合難度」的因果鏈變成可操作的宇宙關聯。
4. **介面已統一**：顧問回饋的「亂」以單一設計語彙＋進度脊（流程＋整合一體）＋矩陣復位為 hero 解決。

### 缺口 Gaps（依影響排序，指向 M3–M4）
| # | 發現 | 現況 | 影響／去處 |
|---|---|---|---|
| G-a | **逐戶權利變換／找補未建模** | Core 只到總量投報；owners[] 僅一致性自檢 | 無法算「誰分回幾坪、誰找補多少」→ **M3** |
| G-b | **owners 輸入 UI 缺席** | 儀表板可顯示 owners，無輸入介面 | 地主清冊只能靠匯入 → **M3** |
| G-c | **時間軸（IRR/現金流）未建模** | 投報為單期靜態 | 融資利息、交屋流動性無法量化 → **M4** |
| G-d | **開發模式洞察未落地為機制** | 已寫進《整合人手冊》 | 融資閘門燈號／信託信用／三態地主／交屋結局待實作 → M3–M6 |

---

## 七、建議與執行展望 Recommendations & Roadmap

### 7.1 即刻優先 — 進入 M3（Rights & Compensation）
- 在 `core/redcf/` 新增**權利變換／找補**公式（`calc_權利變換`），走 **schema v2.x 升級流程**（新 `schema_version` ＋遷移器＋更新 `check_schema_freeze.py` 基準）——**不得直接改凍結檔**。
- 新增 **owners 輸入 UI**，輸出綁定已於 `UI_BINDING_MAP.md §3` 預先固定（`input.owners[]` ＋ `OWNERS_*` warnings）。

### 7.2 把《整合人手冊》的洞察落地（跨 M3–M6）
| 洞察 | 落地形式 | 里程碑 |
|---|---|---|
| 共同負擔比＝**融資閘門** | 儀表板/evaluator 加「<70% 綠燈」號誌 | M3 |
| **信託＋建經三方查核**＝制度信用 | 遊戲「信託信用卡」：非加錢的信任籌碼 | M5–M6 |
| 地主**三態＋選屋籌碼** | 矩陣狀態擴為「同意選屋／同意未選→抽籤／不同意→補償」 | M3（接權變） |
| **交屋流動性結局** | 遊戲結局分支：賣房 or 背貸 | M6 |

### 7.3 版本與發布 Outlook
- **`os-v0.2.0-beta`**：marker 分支 `release/os-v0.2.0-beta` 已推；請 repo 擁有者於 GitHub UI 建立 Release（tag on publish、Target 選該分支、貼 `RELEASE_NOTES-os-v0.2.0-beta.md`、勾 pre-release）。
- **建議 KPI**：M3 權變公式黃金測試覆蓋、owners UI 可用性、可重算合約在真實（本地）案件的回放通過率。
- **風險守則**：真實案件資料一律本地、絕不入庫；schema 變更一律走版本升級、不動凍結檔；公式只在 `core/`。

---

## 附錄 A — 本期稽核摘要 Repo Audit

- 提交數：**21**（最新 `e1fdb64`，分支 `claude/urban-renewal-os-arch-freeze-svoum0`）。
- 測試：`pytest 33 passed` ＋ `headless 24 passed`；CI **Gate 0–6 ＋ Gate 1.5** 全綠。
- 合約：schema **v1.1 ＋ v2.0 ＋三視圖** 皆凍結（sha256 基準見 `tools/check_schema_freeze.py`）。
- 程式：`core/redcf` 1,311 行（Python）；`apps/web` 3,725 行（自含 HTML）。
- 資料紀律：Gate 0 + `check_no_real_names.sh` 零命中。

## 附錄 B — 與前報（2026-06）的差異總覽

| 面向 | 2026-06（前報） | 2026-07（本報） |
|---|---|---|
| 形態 | Urban-Renewal 單庫（知識層）＋ RE-DCF 分離 | **Urban Renewal OS monorepo**（三層合一） |
| 計算 | evaluator 教學層＋RE-DCF 分離 | **SSOT `core/redcf/`，前端零公式，CI 強制** |
| 合約 | 無正式合約 | **schema v2.0 可重算合約，已凍結** |
| 稽核 | 靜態檢查 | **可重算 verify＋凍結 hash＋六道 Gate** |
| 遊戲 | simulator v4（難度偏易） | **URBAN STRAND 統一版**（Core 驅動難度、可測可贏） |
| 缺口 | 真實感／串接 | 已結；轉為**權變/找補/現金流**（M3–M4） |

---

*免責：本報告之法規／稅率／市場數據以前報查證日（2026-06-22）之公開資料為基準，本週期未重新查證；實務適用須以現行條文、主管機關核定與專業查證為據。本專案為通用方法論與計算工具，非正式財務／法律／稅務意見。*
