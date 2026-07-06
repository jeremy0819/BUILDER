# Architecture Review — Principal Architect 批判（凍結時的誠實清單）

> 立場：不護短。每條附證據與處置。R＝風險、T＝技術債、L＝未來兩年地雷。

---

## 一、最大的架構風險

### R-1 SSOT 今天就是被違反的（最大風險，沒有之一）
文件全都宣告「Dashboard 不重算」，但 `evaluator.html:312-341`（`pingyaoLayer`/`tobaoLayer`）
與 `simulator.html:404-405`（`makeFin`/`computeFin`）**在前端完整重算容積帳與共負六科目**，
全 repo 零 fetch/API 呼叫——教學試算層就是第二套公式。真正危險的情境：Core 費率經真實案
重新校準後，前端教學層沒跟上，**地主在說明會看到的示意數字與正式評估不同**——信任毀損是
都更整合的最大成本。
**處置**：ARCHITECTURE D2（示意模式標示＋凍結＋交叉核對測試＋P3 API 取代）。不採「立即刪除
前端公式」——教學互動性是該站存在的理由，靜態站也無 Python 可呼叫；先止血、可偵測、後取代。

### R-2 品質門檻全靠人腦與文件，零 CI
pytest、真實段名 grep、schema hash、headless 迴歸——全部要「記得跑」。session 會換模型、
會失憶；v4.8「golden 綠但 UI 崩」就是門檻踩空的實例。**處置**：CI 四道門列 P0（MIGRATION 步驟 3）。

### R-3 合約不可重算（稽核鏈斷裂）
v1.1 Project JSON 缺逐層輸入，result 無法回放驗證。今天單人使用還好；一旦 Dashboard 多案件、
AI 引用數字，「這個數字怎麼來的」答不出來就是系統性風險。**處置**：schema v2.0 列 P1 第一項（D3）。

## 二、最大的技術債

| # | 債 | 證據 | 處置 |
|---|---|---|---|
| T-1 | 前端教學層公式（R-1 的存量債） | evaluator/simulator 內嵌 JS | P1 止血、P3 清償 |
| T-2 | 黃金測試單一函式（`test_golden.py:187` 一個 `test_golden`） | 失敗時弱模型難定位哪案哪值 | P1 參數化 |
| T-3 | 五個巨型單檔 HTML（324–753 行，自含 JS） | 弱模型整讀即爆 context；改一處易壞整頁 | **凍結不整改**：V4 封版紅線維持；新功能開新頁，不長在舊頁上 |
| T-4 | dict 傳遞、無型別（models/ 未建） | core 各 calc_* 以 dict 溝通 | 隨 P2 新實體引入 dataclass，不回頭大改（DOMAIN_MODEL §4-5） |
| T-5 | 舊 Streamlit 部署曾顯示真實案名 | 乾淨度報告殘留風險 #3 | P0 部署切換時下架 |

## 三、未來兩年最可能踩雷的位置

| # | 地雷 | 引信 | 預防 |
|---|---|---|---|
| L-1 | **法規改版**：容獎上限、§162 免計、危老時程獎勵逐年遞減 | law_db 無縣市、無生效日期欄位；改版後舊案重算會用到新法規 | P2 regulation/ 每條帶「來源＋生效日」；result 帶 law_db_version（v2 已規劃） |
| L-2 | **校準費率失真**：費率是 2026 年真實案校準值，營造行情兩年必變 | 弱模型把費率當「普通預設值」隨手改，或反過來永不更新 | 費率＝🔴 級（MAINTENANCE）；每次真實案校準記私有紀錄＋bump core_version |
| L-3 | **免費部署平台變政策**（Streamlit Cloud／GitHub Pages 限額或收費） | 部署綁免費層 | 架構上已無鎖定（純靜態＋單檔 Streamlit），屆時換平台是搬運不是重寫；不預先多做 |
| L-4 | **真實資料再滲入**：權變/找補功能天然吸引真實清冊進場 | P2 owners 功能上線後，測資最方便的來源就是真實清冊 | CI grep 門檻＋「真實資料只進私有紀錄」紅線＋P3 Gate ③ |
| L-5 | **制度腐化**：governance 檔越長越沒人讀，CLAUDE.md 再度膨脹回 337 行 | 每個 session 都想「補充一點」 | MAINTENANCE §3 行數上限＋精簡協議 |

## 四、現在必須改 vs 可以等 V2

**現在（P0–P1）**：monorepo 合併、CI 四道門、教學層降級標示＋交叉核對、schema v2.0、
黃金測試參數化、舊部署下架。
**可以等（P2+）**：dataclass 全面化、regulation 分縣市、IRR/NPV、任何 API/AI、
教學層完全移除、七 schema 拆分（已裁決不做，見 D4）。

## 附錄：已知文件衝突（凍結時裁決）

| 衝突 | 裁決 |
|---|---|
| RE-DCF ROADMAP「永遠獨立 repo」 vs 兩側合併計畫 monorepo | monorepo（ARCHITECTURE D1） |
| RE-DCF CLAUDE.md 開發分支 `claude/claude-md-docs-ls9Bu` | 過時；分支以當前 session 指定為準 |
| RE-DCF CLAUDE.md「app.py 函式目錄 Lines 33–298 計算層」 | 過時（v4.7 已搬入 core/；實測 app.py 無 `def calc_`） |
| 使用者貼文「Repository 架構已定案＝獨立 repo」 vs 同批貼文「不受現有架構限制」 | 依最新指示（從零重審），裁決 monorepo；若使用者否決 D1，回退成本＝保留兩庫照舊執行 MIGRATION 以外各項（governance/CI/schema 策略皆與 repo 拓撲無關） |
