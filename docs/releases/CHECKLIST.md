# Release Checklist — Urban Renewal OS（M1 Task 6）

> 用法：任何 `os-vX.Y.Z` release 前，逐項打勾。**任一項未過＝不發布**。
> 每項都給「怎麼驗」的具體指令，弱模型照做即可，不靠記憶。

---

## A. 自動化門檻（CI 綠）

- [ ] **CI 全綠**：最新 commit 的 GitHub Actions `CI` workflow 全部 Gate（Gate0–Gate6 ＋ Gate1.5 套件安裝）全 pass。
- [ ] **Golden Test PASS**：`python -m pytest -q` → 全 passed（含 test_golden＋test_headless）。
- [ ] **Core 隔離 PASS**：`python tools/check_core_isolation.py` → Gate2 PASS。
- [ ] **Template 迴歸 PASS**：`python tools/check_template.py` → Gate3 PASS。
- [ ] **靜態連結 PASS**：`python tools/check_web_links.py` → Gate4 PASS。

## B. 資料紀律（紅線）

- [ ] **No Real Names（工作區）**：`bash check_no_real_names.sh` → PASS。
- [ ] **No Real Names（commit 訊息）**：把 `check_no_real_names.sh` 內的段名樣式套到
      `git log --all --oneline` 的輸出上檢查 → 零命中（樣式清單以該腳本為唯一來源，勿在此複載）。

## C. 合約與版本

- [ ] **Schema Hash（凍結守衛）**：`python tools/check_schema_freeze.py` → 全數相符。
      基準（唯一來源＝該腳本 `FROZEN` 表，此處抄錄供對照）：
      - v1.1 `schemas/project_schema.json` = `e37e10dbe19f5bbf51234a12fa8e60af34d4c854ac05566aa3e87f7d35bd4a96`
      - v2.0 `schemas/project_schema_v2.json` = `f1c466a3162655634baf19973dcb061a8e64643d08302a1dc3f6cdd0df38e6b1`
      - v2 三視圖 `schemas/v2/{input,output,metadata}.schema.json`（見腳本 FROZEN 表）
      - wf-1.1 `schemas/workflow_schema_v1_1.json` = `39e7e88e9278abdc72fca86415517a1f626b02ca419eddb8e28bf1eae9ba890f`（M5.5-A 可簽性軸；wf-1.0 續凍）
      - stakeholder_profile v0.1 `schemas/stakeholder_profile.schema.v0.1.json` = `d68e5ec52d0cb865cc690073aeada1fd9b319004fb5fe3e0f86d4c694f6f0e2b`（M6 分型輸入）
      - strategy v0.1 `schemas/strategy.schema.v0.1.json` = `8821db932a83fd4ac6d457f6ae1a8f19b691a1f071084a883769895c1c9b0bd1`（M6 策略輸出）
      要改凍結檔＝走版本升級流程（新版本＋遷移器＋更新 FROZEN 基準），不得直接改檔。
- [ ] **Version Updated**：依 `governance/VERSION_POLICY.md` 確認 CORE_VERSION / schema_version /
      APP_VERSION 該動的已動、不該動的沒動；本次 release 對應版本已填入下方發布紀錄。
- [ ] **Migration Updated**：若 schema major 變更，`core/redcf/migrations.py` 的 `migrate()`
      已涵蓋新版，且舊範例 migrate 後通過新 schema（fixture 測試綠）。
- [ ] **CHANGELOG Updated**：本次變更已記入 CHANGELOG（CORE_VERSION 有動時必記）。

## D. 部署與文件

- [ ] **README Updated**：CI badge 正常、啟動指令（Streamlit＋靜態站）與現況相符。
- [ ] **Deployment Ready**：依 `docs/architecture/DEPLOYMENT_MIGRATION.md` 確認
      目標部署（Pages＝apps/web、Streamlit Cloud＝apps/streamlit/app.py）指向正確；
      舊庫部署已依計畫下架/轉址（首發 alpha 時此項為「計畫已產出」即可）。
- [ ] **Docs 一致**：ARCHITECTURE / ROADMAP / 本次變更無互相矛盾（衝突則先修再發）。

## E. Tag 與發布

- [ ] **Tag Ready**：`git tag -l os-vX.Y.Z` 尚未存在（不重用版號）；打 tag 指令備妥。
- [ ] **前一版可回溯**：上一個 release tag 仍在遠端，必要時可 checkout 回退。
- [ ] 全部勾完 → 打 tag → push → 在下方登記。

---

## 發布紀錄（每次 release 追加一列）

| OS Tag | 日期 | CORE_VERSION | schema_version | 備註 |
|---|---|---|---|---|
| _(os-v0.1.0-alpha)_ | _待 M1 收尾_ | 0.2.0 | 1.1 | 首發；合約仍會於 v2.0 破壞性變更，故僅 alpha/內部 |

---

## 給弱模型的三條鐵律

1. 這份清單是「發布」的唯一入口——不要繞過任何一項「先發了再補」。
2. 勾「PASS」前必須**實際跑過該指令看到 PASS**，不可憑印象打勾（見 JUDGMENT_RUBRICS R2）。
3. 任何一項卡住且無法自行解決 → 停下問使用者，不要降低標準讓它「看起來過」。
