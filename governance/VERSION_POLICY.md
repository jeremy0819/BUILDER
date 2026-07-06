# Version Governance — 版本治理政策（M1 Task 5）

> 依據 FREEZE_REVIEW-2026-07.md 第五節「三層版本制＋聚合 tag」。本檔是版本規則的唯一權威。
> 放置位置：本 repo 的 `governance/`（架構凍結的治理目錄）——M1 PDF 寫 `docs/governance/`，
> 但本專案凍結結構的治理檔統一在根 `governance/`，故置於此以免目錄分裂（權限見 MAINTENANCE §1）。

---

## 1. 四個版本座標（各自獨立、各有 bump 規則）

| 版本 | 載體（真實來源） | 現值 | bump 時機 |
|---|---|---|---|
| **Schema Version** | `schemas/project_schema.json` 內 `schema_version` 欄位 | 1.1（凍結） | 加 optional 欄位＝minor；改名/改型別/刪欄位/改必填＝major（見 SCHEMA_STRATEGY） |
| **CORE_VERSION** | `core/redcf/_version.py` 的 `CORE_VERSION` | 0.2.0 | 計算公式、費率、law_db 內容、合約結構變動才 bump；**消費端追溯依據，不可斷號** |
| **App Version** | `apps/streamlit/app.py` 的 `APP_VERSION`；各 HTML 內版號（evaluator v1.3、simulator V4） | v4.9 / v1.3 / V4 | 純介面/行為變更才 bump（cosmetic）；`BUILD_DATE` 每次部署恆更新 |
| **OS Release** | git tag `os-vX.Y.Z`（聚合版本，**新增機制**） | 未發（首發＝os-v0.1.0-alpha） | 每次正式 release 打 tag，對應一組凍結的上述三者 |

## 2. 三層關係（誰依賴誰）

```
OS Release（os-vX.Y.Z）  ← 聚合，一個 tag 綁定一組下列版本快照
   ├── Schema Version     ← 合約，破壞性變更牽動全部消費端
   ├── CORE_VERSION       ← 計算，寫進每份 Result JSON 的 provenance
   └── App Version × N    ← 各消費端介面，互不影響、cosmetic
```

規則：**上層可獨立於下層發布**（App 改版不必動 OS tag）；但 **Schema 或 CORE major 變更必然觸發新的 OS Release**。

## 3. Tag Strategy

| Tag 樣式 | 意義 | 範例 |
|---|---|---|
| `os-vX.Y.Z-alpha` | 內部測試版，合約可能仍會破壞性變更 | os-v0.1.0-alpha |
| `os-vX.Y.Z-beta` | 合約穩定候選，僅修 bug | os-v0.2.0-beta |
| `os-vX.Y.Z` | 正式版，合約凍結、承諾向下相容至下個 major | os-v1.0.0 |
| `core-vX.Y.Z` | （選用）只標計算核心的獨立里程碑，供私有校準紀錄對照 | core-v0.2.0 |

SemVer 語意：X＝合約破壞性變更；Y＝相容新增；Z＝修正。alpha/beta 期間 X 可為 0。
⚠️ 現況：`v0.2.0-premerge` tag 尚未推上遠端（git 通道曾拒推 tag），遠端替代 ref＝分支
`premerge-v0.2.0`。補推 tag 是 repo 擁有者待辦（見 RE-DCF《歷史乾淨度報告.md》）。

## 4. Release Strategy（何時發哪種版）

- **alpha**：M1 完成（CI 綠＋六道 Gate＋本政策＋Checklist）即可發 os-v0.1.0-alpha。
- **beta**：schema v2.0 落地＋遷移器＋pyproject 完成（M3–M4）→ os-v0.2.0-beta。
- **正式 v1.0**：合約穩定（v2.0 定案不再破壞）＋權變/現金流經真實案驗證＋LICENSE 定案。
- 每次 release 一律走 `docs/releases/CHECKLIST.md`，缺一項不發。

## 5. Migration Rule（版本遷移）

- Schema major 變更 → `core/redcf/migrations.py` 提供 `migrate(doc)`；消費端**不得**各自寫轉換。
- 舊 Result JSON 不重寫：重算＝產新檔新戳（core_version/computed_at/input_hash），舊檔保留。
- 最多同時支援兩個 schema major（2.x 上線後 1.x 只讀不寫；3.0 上線時 1.x 停支援）。
- 每個 major 附 fixture 測試：舊範例 → migrate → 新 schema 驗證通過（進 CI Gate 1）。

## 6. 弱模型操作規則

1. 改任何版本號前，先確認你改的是「真實來源」（表 §1）而非某處硬編字串副本。
2. CORE_VERSION 只增不減、不重用；改它必連帶更新 CHANGELOG。
3. Schema 在凍結期一律不動（位元組 hash 不變），需求記 backlog。
4. 打 OS tag 前必過 CHECKLIST；tag 一經 push 不可移動（要修就發下一個 Z 版）。
