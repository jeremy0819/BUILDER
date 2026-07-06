# Architecture Freeze Review — BUILDER Repository（搬遷後複審）

> 日期：2026-07-06（MIGRATION P0 步驟 0–2 驗收通過後）。性質：唯讀 review，零程式變更。
> 證據方法：全部依賴關係與版本字串以 grep/實跑驗證，非憑文件宣告（DIAGNOSIS #3 紀律）。

---

## 一、Repository Architecture

**應保持不動**：
- `core/redcf/` 內部結構（capacity/efficiency/finance/valuation/contract/law_db/templates/io）——單向依賴、職責清楚，`contract.py` 是教科書級的 anti-corruption layer（中文 domain ↔ 英文合約）。
- `schemas/` 單檔＋`$defs` 策略（D4）；`apps/web` 靜態純度；`docs/` 三分法（architecture／methodology／redcf）；`governance/`。
- Clean Architecture 判定：**核心合格**——core 只依賴 stdlib＋pandas（實測 import 清單），零 UI 依賴；依賴箭頭全部由外向內（UI→Core→法規資料）。
- DDD 判定：**計算域合格**——bounded context 明確、ubiquitous language（中文 domain 詞彙）貫穿、合約層隔離。

**仍需整理**（不動程式，記錄於此）：
1. `core.redcf` 不是可安裝 package——靠 app.py 的 sys.path 墊片＋根目錄 conftest.py 撐住。P1 應補 `pyproject.toml` 讓墊片退場。
2. 「Headless 測試法」只存在於文件——`tests/` 只有 `test_golden.py`，Urban-Renewal 宣稱的 Node stub-DOM 測試**沒有可執行腳本實體**（舊庫本來就沒有檔案）。CI（步驟 3）建立前必須把它實體化，否則 CI 第 3 道門是空炮。
3. `tools/` 是雜物抽屜：Excel 產生器、三個簡報產生器、未來 headless 腳本同居。未來拆 `tools/generators/` 與 `tools/qa/`（等 CI 時順手，現在不動）。

**未來易形成技術債**：
- `docs/redcf/`＋`docs/methodology/` 共 30+ 份歷史文件，與 `docs/architecture/` 新權威文件必然漂移——已有權威順序表，但建議 P1 給歷史文件加 `> [ARCHIVED 2026-07]` 頁首標記。
- `apps/web/docs/` 與 `docs/methodology/` 有兩份相同 md（Pages 部署需要）——單源＝methodology，副本＝web/docs，同步規則要進 CI。
- 五個巨檔 HTML（T-3，凍結中）與教學層公式（R-1）——既有裁決維持，不重述。

## 二、Dependency Review（實測，非畫想像圖）

```
apps/web（5 靜態頁）      apps/streamlit/app.py      tests/ · min_example.py · tools/make_template.py
    │                          │                          │                └─► openpyxl（獨立）
    │ 無程式依賴；執行期讀       │ from core.redcf import …  │
    │ 使用者手動匯入的 JSON      ▼                          ▼
    │                    ┌─ core/redcf（公式）──► core/redcf/law_db.py（法規資料）
    │                    │        └─► pandas（core 唯一第三方依賴）
    │                    ▼
    └─（語意相依）─► schemas/project_schema.json（對外合約）
                          ▲ 執法點：tests/test_golden.py 以 jsonschema==4.26.0 驗證 core 輸出
```

- **反向依賴（Core→UI）：零**。grep 實測 core 無 streamlit/plotly 引用（僅 docstring 提及）。
- **循環依賴：零**。core 內部僅單向引用 capacity/law_db 基礎模組。
- **UI→Core：合規方向**。app.py 直接 import `law_db` 常數供顯示——這是「引用資料」不是「複製常數」，符合 SSOT；引用而非落地是正確示範。
- **兩個語意級重複（非 import 依賴，grep 抓不到）**：
  1. `apps/web` 教學層 JS 公式（R-1，已裁決：凍結＋P1 掛示意標示）。
  2. `tools/make_template.py` 在 Excel 內嵌與 `calc_投報全案` 1:1 的公式——**受控重複**（對照範本的存在目的），靠「改 L6 必重跑」規則同步；CI 應加「make_template 重產後 diff 無變化」檢查（P1）。

## 三、Domain Model Review

使用者清單（Project/Building/Floor/Area/Cost/Valuation/Law）對照凍結版 `DOMAIN_MODEL.md`：

| 你列的 | 凍結版對應 | 狀態 |
|---|---|---|
| Project／Building／Floor | Project／ExistingBuilding／Floor | 已定義 |
| Area | CapacityAccount＋EfficiencyAccount（面積是「帳」不是實體） | 已定義 |
| Cost | SharedCost（L6 六科目）＋FinanceParams | 已定義 |
| Valuation／Law | Valuation／LawRule | 已定義 |
| （你沒列的）Owner／Scenario／RightsExchange／CashFlow／Warning | 凍結版已含 | 已定義 |

**結論：凍結版 11 實體＋5 掛載點（CRM/GIS/Document/Task/AI）已是完整版，不需擴充**——缺的不是實體，是**落地**：
1. 全部實體目前以 dict 傳遞，`models/` dataclass 未存在（裁決：隨 P2 新功能引入，不回頭大改）。
2. Floor 不在 v1.1 合約內（可重算性缺口，schema v2.0 主菜）。
3. Scenario 隱含未顯式（v2.0 補）。
不建議現在加任何新實體——「畫更大的 ER 圖」是本專案最便宜也最無用的動作（D5 裁決維持）。

## 四、Module Boundary Review

| 邊界 | 判定 | 說明 |
|---|---|---|
| core ↔ apps | ✅ 乾淨 | import 單向；公式零外洩（教學層屬 R-1 存量債，非邊界問題） |
| schemas ↔ 全體 | ✅ 乾淨 | 單一合約檔；core 產出、tests 執法、消費端讀取 |
| docs 三分 | ✅ 乾淨 | architecture（權威）／methodology／redcf（歷史）——需補 ARCHIVED 標記 |
| governance | ✅ 乾淨 | 純制度，不含專案內容 |
| tools/ | ⚠️ 混 | 產生器＋範本＋未來 QA 同居；且 make_template 半隻腳踩在「公式」邊界上（受控） |
| 根目錄 | ⚠️ 小混 | min_example.py／conftest.py／requirements.txt 散在根——Python 慣例可接受，pyproject 化時一併收 |
| `shared/`（原提案有） | ✅ 正確地不存在 | 目前無可共享物；預建空層＝YAGNI（凍結裁決維持） |

## 五、Versioning Strategy

現況（實測）：`CORE_VERSION="0.2.0"`／schema_version 1.1（凍結）／`APP_VERSION="v4.9"`（已抽常數）／evaluator v1.3／simulator V4／**repo 級版本不存在**。

建議＝三層版本制＋一個聚合 tag（新增的唯一機制）：

| 層 | 載體 | bump 規則 |
|---|---|---|
| 合約 | `schema_version`（資料檔內） | 照 SCHEMA_STRATEGY：加欄位=minor、破壞=major |
| 計算 | `CORE_VERSION` | 公式/費率/law_db 內容變動才 bump；是消費端追溯依據，**不可斷** |
| 應用 | APP_VERSION、evaluator/simulator 版號 | 各自獨立、cosmetic；廢除「每改必+0.1」硬規則，改為「行為變更才 bump＋BUILD_DATE 恆更新」 |
| **OS 整體** | git tag `os-v0.x.y`（新增） | 每次 release 打 tag；README 附版本對照表（os↔core↔schema↔apps） |

另：`v0.2.0-premerge` tag 仍未在遠端（repo 擁有者待辦）；P1 的 `law_db_version` 進 provenance 後，法規資料變更才有獨立追溯。

## 六、Release Readiness — 能發 v1 Alpha 嗎？

**判定：不能叫 v1，可以在解掉 C 級後發「os-v0.1.0-alpha（內部）」。**
理由：v1 語意＝合約穩定，但 schema v2.0（破壞性）已在計畫中；對外 v1 等 v2.0 合約落地後再談。

| 級別 | Blocking Issue | 說明 |
|---|---|---|
| **Critical** | C1 零 CI | 四道門全靠人記；alpha 前必建（MIGRATION 步驟 3） |
| **Critical** | C2 舊部署未下架＋部署未切換 | 舊 Streamlit URL 曾顯示真實案名——這是資料紀律問題，不只是部署問題（使用者操作） |
| **High** | H1 headless 測試無實體 | 文件宣稱的驗收法沒有可執行腳本；CI 第 3 道門的前置 |
| **High** | H2 教學層未掛示意標示 | SSOT 止血（P1 第 2 項）未做，對外發布前必須有 |
| **High** | H3 LICENSE 不存在 | 發布＝分發；授權未定不能對外（法律決定，使用者拍板） |
| Medium | M1 無 pyproject（sys.path 墊片）；M2 web/docs 副本漂移無檢查；M3 premerge tag 未補推；M4 黃金測試單一函式未參數化 | |
| Low | L1 tools/ 分類；L2 三份 README 內容重疊；L3 歷史文件無 ARCHIVED 標記 | |

## 七、Architecture Roadmap（半年，零功能）

| 月 | 主題 | 內容（全部是架構/制度，無功能） |
|---|---|---|
| M1 | **P0 收尾** | CI 四道門上線（pytest／check_no_real_names／headless／schema hash）；部署切換＋舊庫封存＋舊 URL 下架；LICENSE 拍板；premerge tag 補推；打 `os-v0.1.0-alpha` |
| M2 | **測試地基** | headless 測試實體化進 `tests/web/`；黃金測試參數化（逐案逐值報錯）；make_template 重產 diff 檢查進 CI；教學層掛「示意模式」標示（H2） |
| M3–M4 | **合約升級** | schema v2.0（floors/scenario/input_hash/law_db_version）＋`migrations.py`＋fixture；examples 重生；消費端同 commit 適配；交叉核對測試 spike（30 分鐘可行性驗證，不行就降級） |
| M4 | **Packaging** | `pyproject.toml`（core.redcf 可安裝）；移除 sys.path 墊片與根目錄散件；`os-v0.2.0-beta`＋版本對照表 |
| M5 | **文件收斂** | docs/redcf＋methodology 歷史文件加 ARCHIVED 標記；三份 README 去重；governance 季度 read-back（防制度腐化，LETTER §二-3） |
| M6 | **P2 Gate 審查** | 對照 ROADMAP P2 開工條件複審；更新 ARCH_REVIEW 風險清單；決定 dataclass 引入切入點 |

## 八、Architecture Score（誠實評分，不灌水）

| 維度 | 分數 | 扣分原因 |
|---|---|---|
| Repository | ★★★★☆ | 結構乾淨、方向單一；扣：sys.path 墊片、tools 雜、根目錄散件 |
| Maintainability | ★★★★☆ | 索引化文件＋LESSONS＋權限矩陣是強項；扣：五巨檔 HTML、dict 無型別 |
| Extensibility | ★★★★☆ | 掛載點與 schema 策略設計好；扣：v1.1 合約不可重算，限制新消費端 |
| Domain Model | ★★★☆☆ | ER 已凍結且完整；扣：程式層零落地（無 dataclass）、Floor 不在合約 |
| Documentation | ★★★★☆ | 權威順序＋路由表完備；扣：三處歷史文件重疊漂移風險、無 ARCHIVED 標記 |
| Deployment | ★★☆☆☆ | 兩條部署線設計清楚；扣：**切換尚未執行、舊部署（含真實案名）仍在線** |
| CI | ★☆☆☆☆ | 設計已寫進 MIGRATION 步驟 3；扣：**pipeline 實體＝零**，全部門檻靠人記 |
| Security | ★★★☆☆ | 資料紀律工具鏈強（check 腳本＋私有隔離＋.gitignore）；扣：舊 URL 殘留、無 secret 掃描、LICENSE 缺 |
| Law Compliance（法規資料） | ★★★☆☆ | 條號有依據、黃金測試鎖定、warnings 權威化；扣：未分縣市、無生效日期欄位、無法規改版偵測機制（ARCH_REVIEW L-1） |

**總評**：核心（core/schemas/合約紀律）是 4–5 星水準；整體被「還沒接電的部分」拉低——CI 與部署切換不是程式問題，是**執行待辦**。M1 做完，Deployment/CI/Security 三項會直接跳兩星，屆時 os-v0.1.0-alpha 名正言順。
