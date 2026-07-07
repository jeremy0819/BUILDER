# Urban Renewal OS — M2–M8 里程碑計畫

> 定位：M1（基礎建設）已完成並發 os-v0.1.0-alpha。以下 M2–M8 依「Architecture First → Domain First
> → Core First → 最後 AI」排序；每個里程碑對應一個可發布版本（os-vX.Y.Z）。
> 鐵律沿用：上一里程碑未達完成標準，下一個不開工；每階段有「不做清單」。
> 對應舊 ROADMAP 的 P1–P3 與 OS 模組（Dashboard/CRM/GIS/Document/AI Copilot）。

---

## M2 — 合約升級 schema v2.0（Contract Foundation）
**Why**：v1.1 合約無逐層 floors[]，「從合約 JSON 重算 result」不可行＝稽核鏈斷、消費端拿不到可回放數字。
**Goal**：Project JSON＝完整可重算文件（input 全備＋result＋provenance）。
**Task**：先寫 fixture＋驗收測試（load→recompute→逐欄位相等）→ 改 schema → `core/redcf/migrations.py`
鏈式遷移（1.0→1.1→2.0）→ examples 以 v2.0 重生 → 消費端（evaluator/儀表板）同 commit 適配。
**Deliverable**：schema v2.0 凍結宣告＋遷移器＋全 examples 通過重算等值。
**驗收**：`pytest` 綠（含新 fixture）；舊檔 migrate 後過 v2.0 驗證；CI Gate1 綠。
**版本**：os-v0.2.0-beta（前置：packaging M2 附帶做 `pyproject.toml`，移除 sys.path 墊片）。
**不做**：新公式、AI、API。

## M3 — Domain 補完：權利變換與找補（Rights & Compensation）
**Why**：owners[] 有 schema 無計算——逐戶分回/找補金無函式可填（RE-DCF 技術債第 1–2）。
**Goal**：從案件總量算到「逐戶」。
**Task**：owners 清冊 CSV 匯入 UI（比照逐層表）→ `calc_rights_exchange()`（更新前價值→權值比例→分回，
填 OwnerAllocation.return_value）→ `calc_compensation()`（找補金→equalization）→ `calc_更新前價值` 補
路寬/分區/建物型態係數。以真實案（私有）校準逐戶分回，版控內用合成資料鎖迴歸。
**Deliverable**：一份 owners JSON → 逐戶分回表＋找補金，數字由 Core 產出。
**驗收**：黃金測試新增逐戶案；`pytest` 綠；evaluator 逐戶表改讀權威 return_value（停用示意攤分）。
**版本**：os-v0.3.0。**不做**：IRR/現金流（M4）、AI。

## M4 — 財務引擎深化：現金流 / IRR / NPV（Finance Engine）
**Why**：目前只有單期報酬率，缺資金時程與時間價值。
**Goal**：從單期補到分期現金流與投資報酬指標。
**Task**：`calc_cashflow()`（規劃→基礎→結構→裝修→交屋分期，在建實案 Excel 私下校準）→ `calc_irr()`/
`calc_npv()` 建於現金流之上 → Loan Engine（建融/土融分期攤還取代單期簡化）→ 敏感度擴充到 IRR/NPV 維度。
**Deliverable**：分期現金流表＋IRR/NPV＋貸款攤還排程。
**驗收**：黃金測試鎖現金流關鍵值；`pytest` 綠。**版本**：os-v0.4.0。**不做**：Monte Carlo（延後）、AI。

## M5 — 法規資料庫分縣市（Regulation as Data）
**Why**：law_db 目前無縣市差異、無生效日期——法規改版（容獎、§162、危老時程遞減）會讓舊案重算用錯規則（ARCH_REVIEW L-1）。
**Goal**：法規資料化、可版本化、帶來源與生效日。
**Task**：拆 `core/redcf/law_db.py` → `regulation/{taipei,newtaipei,taoyuan,...}/`，每條含條文/上限/來源/
更新日期；result.provenance 帶 `law_db_version`；縣市清單由使用者確認。
**Deliverable**：分縣市法規模組＋每筆數字可溯源到法條與生效日。
**驗收**：切換縣市→容獎上限隨之變；黃金測試各縣市案；`pytest` 綠。**版本**：os-v0.5.0。**不做**：AI。

## M6 — 管理層 Dashboard ＋ 整合模擬器（Consumer Layer / V6 + 新沙盤）
**Why**：把「單案評估」升到「多案管理」；並讓沙盤吃 Core 權威數字（修 R-1 教學層債）。
**Goal**：主管用儀表板管 2–3 併行案件；新模擬器在精確計算之上做賽局。
**Task**：多案件庫（localStorage 匯入多個 Core JSON）＋同意進度看板＋S1–S11 甘特＋KPI 總覽（只讀 result，
一條公式不寫）；**新整合模擬器**（開新頁，不改封版 simulator.html）＝Core 預算 JSON 橋接：evaluator 的
owners[] 一鍵轉開局盤面，談判/情緒/樞紐戶建於權威數字上。
**Deliverable**：3 案併行管理 demo；一份 Core JSON 走完「評估→開局→推演→復盤」。
**驗收**：每個顯示數字可溯源到 result 欄位；headless 測試跑新頁；瀏覽器實開；`check_no_real_names` PASS。
**版本**：os-v0.6.0。**不做**：後端、AI 談判對手（M8）。

## M7 — OS 模組掛載：CRM / Document / GIS（Modules）
**Why**：DOMAIN_MODEL 已定掛載點（project_id 關聯），此時有實際場景可落地。
**Goal**：把「案件」周邊的人、文件、圖資接上，仍不污染計算合約。
**Task**：CRM（整合進度/接觸紀錄，匿名代號，真實 PII 永不進版控）→ Document Center（檔案索引：型別/
階段/路徑）→ GIS（圖資引用，計算合約不含座標）。各模組自帶檔案與自己的 schema_version，只讀 result。
**Deliverable**：案件卡片可掛 CRM 進度、文件清單、圖資連結。
**驗收**：模組資料變更不觸發 project_schema bump；PII 隔離自查；`pytest`＋資料紀律 Gate 綠。
**版本**：os-v0.7.0。**不做**：AI、真實 PII 進版控。

## M8 — 智慧層：AI Copilot / Agent（P3，最後才做）
**Why**：AI 必須建在穩定 Domain Model 之上（Domain 優先於 AI）；前面里程碑穩定後才開工。
**開工 Gate（三者皆須）**：① M2–M7 穩定運轉；② 權變/現金流經真實案驗證；③ 真實清冊 PII 隔離方案定案。
**Goal**：AI 讀 result＋law_db 講人話、可溯源、不心算；計算永遠出自 Core。
**Task**：獨立 repo `Urban-Renewal-Agent`（FastAPI 包 Core，金鑰/認證在服務端）→ AI Copilot（案件摘要／
法規 RAG／財務解讀）→ AI 地主（simulator 訓練模式的 LLM 談判對手）→ 多 Agent 報告（一份 JSON 進、
八段標準報告出）。前端教學層此時由 API 取代並移除。
**Deliverable**：AI 回答引法條號/Core 欄位可溯源；一場完整 AI 談判可玩可復盤。
**驗收**：AI 不繞過 Core 心算（審查）；端點回值＝Core result；資安自查（瀏覽器不持金鑰）。
**版本**：os-v1.0.0（合約穩定＋AI 上線＝正式版）。

---

## 版本對照

| 里程碑 | 主題 | 版本 |
|---|---|---|
| M1 ✅ | 基礎建設（CI/治理/Release） | os-v0.1.0-alpha |
| M2 | schema v2.0＋packaging | os-v0.2.0-beta |
| M3 | 權利變換/找補＋owners UI | os-v0.3.0 |
| M4 | 現金流/IRR/NPV | os-v0.4.0 |
| M5 | 法規分縣市 | os-v0.5.0 |
| M6 | 管理 Dashboard＋新模擬器 | os-v0.6.0 |
| M7 | CRM/Document/GIS 掛載 | os-v0.7.0 |
| M8 | AI Copilot/Agent | os-v1.0.0 |

## 全程不變的紅線
SSOT（公式只在 core/）、schema 破壞性變更走遷移器、零真實資料進版控、封版頁不重寫、
每個里程碑走 `docs/releases/CHECKLIST.md` 才發版。
