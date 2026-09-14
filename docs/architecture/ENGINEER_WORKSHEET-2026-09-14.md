# 工程師執行表（2026-09-14）

> **基準**：`main` @ `bf6d80b`。所有數字實測，非估計。
> **前一份**：`ENGINEER_BACKLOG-2026-09.md`（稽核與理由）。本檔只列**還要做什麼**，附驗收指令。
> **設計規格**：`docs/design/UI_UX_PLAN-2026-09.md`。

---

## 0. 現況基準（先跑一次，確認你的環境與這份表一致）

```bash
python -m pytest -q                                   # → 260 passed
for f in tests/web/test_*.mjs; do node $f; done       # → 合計 652 passed, 0 failed
python tools/check_ci_gates.py                        # → PASS
grep -c 'name: "Gate' .github/workflows/ci.yml        # → 26
python tools/check_schema_freeze.py                   # → 20 檔全部相符
```

對不上就先別動手——是環境問題，不是你的程式問題。

---

## 1. 🔴 P0｜Pyodide 階段二：部署

**狀態**：階段一（程式與驗證）已完成並合併。階段二**等使用者授權**，尚未執行。

程式端已備妥：worker 本地優先、僅 404 回退 CDN、`ready` 回報 `runtime_source`
（`same-origin` / `cdn-fallback`），13 資源／15,050,565 bytes 全帶 sha256。

- [ ] **1.1** `pages.yml` 加一步：部署時執行 `python tools/prepare_pyodide.py`，
      把通過 digest 檢查的 `runtime/` 目錄放進 Pages artifact
- [ ] **1.2** **不得 commit 進版控**。repo 現在 `size-pack` 1.33 MiB，
      二進位一旦進 git 歷史就拿不掉，只能重寫歷史
- [ ] **1.3** 部署後**當場確認** `runtime_source === "same-origin"`
      （首頁徽章列已有 `[data-uros-runtime]`，會顯示「本機」或「CDN 備援」）

**驗收**：部署完開站，徽章顯示「本機」；封鎖 `cdn.jsdelivr.net` 後仍能算出數字。

> ⚠️ 這一條的風險是**靜默成功**：本機副本漏一個檔，worker 會安靜回退 CDN，
> 你會以為部署成功。徽章就是為此而存在——**別跳過 1.3**。

---

## 2. 🟠 P1｜`runtime_source` 徽章擴到四步

**現況**：`coreStampRuntimeSource()` 會蓋到任何 `[data-uros-runtime]` 元素，
但只有 `index.html` 掛了一個。

- [ ] 四步頁面的版本列各加一個 `<span data-uros-runtime>—</span>`

**驗收**：四步頁面都能看到來源標示。

**規模**：四行 HTML。

---

## 3. 🟠 P1｜Workspace 面板真正歸位

**現況**：目前是**深連結**，不是面板搬移（工程師報告已如實說明）。
`workspace.html` 仍是與四步平行的第二套案件管理。

依 `UI_UX_PLAN §2.3`：

- [ ] **3.1** 同意看板、任務 → **③ 人心**
- [ ] **3.2** 決策日誌、時間軸 → **④ 決策**
- [ ] **3.3** `workspace.html` 降級為「案件櫃」：只留選案與匯出入
- [ ] **3.4** 抽出共用 panel module，逐個搬遷；**維持舊入口與匯入相容**，
      不要用 iframe，也不要複製事件／儲存邏輯

**驗收**：功能清單逐項對照，零項消失；`grep -ln "新增案件" apps/web/*.html` 只剩 1 頁。

**規模**：搬移不是重寫，約 1–2 天。

---

## 4. 🟠 P1｜建案入口 5 → 1

**現況**：5 個頁面都能建案（`grep -ln "新增案件\|建立案件\|importV21" apps/web/*.html`）。

- [ ] 只有 `index.html` 真正建案；其餘改為跳轉

**驗收**：功能一項不減，要記的概念從 5 個變 1 個。

**規模**：機械性，約半天。

---

## 5. 🟡 P2｜三個全域散鍵收進案件紀錄

**⚠️ 範圍已縮小**：原列六個鍵，其中三個早已分案（是我誤判，工程師糾正無誤）。

| 鍵 | 狀態 |
|---|---|
| `uros.profiles.<pid>` / `uros.analysis.inputs.<pid>` / `uros.milestones.<pid>` | **已分案，不要動** |
| `uros.step.site` / `uros.step.people` / `uros.intent` | **全域，要收** |

- [ ] 前兩個是 UI 狀態（這一步開過沒有），收進案件草稿
- [ ] `uros.intent` **沒有可信的案件歸屬**，不得自動掛給目前案件——那是臆造。
      需使用者明確確認才採用，原鍵保留

**為什麼現在做**：切換案件時它們不會跟著換，是潛在的錯資料來源。現在還沒炸，越晚改越痛。

**規模**：約半天。

---

## 6. 🟡 P2｜80 戶上限的無聲丟棄

**現況**：`case-bus.js` 的 `buildSandboxBridge()` 有 `owners.length <= 80`，
超過就把逐戶事實**直接丟棄且不告知**。

- [ ] 超限時明說「本案 N 戶超過沙盤上限 80，逐戶事實未載入」

**規模**：幾行。

---

## 7. 🟡 P2｜M8.5 GIS 疊圖（M8 最後一項）

**前置建議**：先過 **P3 開工 Gate 第③項（真實清冊 PII 隔離方案）**——
那是一次設計裁決，不必等案例累積，而 GIS 匯入會第一次讓大量真實地籍資料靠近系統邊界。

- [ ] 方案 B：本機匯入，不連外部圖磚服務
- [ ] 匯入流程要在 UI 層就講清楚「這份圖不會進版控」
- [ ] 圖資分層依 `docs/methodology/圖資來源包-縣市模組.md` 的五層

> Gate 0 的結構式守衛（地號／建號、段名＋數字、門牌三條樣式）能攔誤入版控的地籍格式，
> 但**守衛是最後一道，不是流程設計**。

---

## 8. ⬜ P3｜企業能力（等產品／資安裁決，勿先行實作）

實測為零的七項：REST/GraphQL API、伺服器持久化、使用者帳號／多租戶、
稽核軌跡、權限 RBAC、靜態加密、多人協作。

> 都更本質是實施者×地主×建築師×估價師×主管機關，但目前**沒有任何機制讓兩個人看到同一個案子**
> ——連唯讀分享都沒有。這是產品定位問題，不是工程排序問題。

---

## 附錄 A｜本輪已完成（2026-09-14，`bf6d80b`）

| 項 | 證據 |
|---|---|
| 手機規範 | 按鈕／輸入未達 44px **37 → 0**；導覽列捲動收合 **75 → 41px**；① <12px 文字 148 → 88 |
| 錯誤訊息人話化 | 抽到 `core-runtime.js` 共用；① ④ 不再顯示原始例外 |
| `runtime_source` 露出 | `coreStampRuntimeSource()`；首頁徽章 |
| **M8.3 互動量體** | 軸測堆疊、雙向對照、免計項疊加；Gate 14（52 → 80 條） |
| **M8.4 敏感度地圖** | `sensitivity-map.js`；**Gate 23**（38 條，含對抗案例 G） |
| M8 DoD | 7 項勾到 6，僅餘 M8.5 |

---

## 附錄 B｜三條不要犯的錯（本輪踩過）

1. **負面斷言不能只掃字串。**
   M8.3 的「拖不動」既掃原始碼（禁 10 種樣式）**也**在真瀏覽器實拖
   （`mouse.down` → 移 180px → `up`，確認圖面 HTML 與 `floors` 均未變）。
   只掃字串證明不了「拖了沒反應」。

2. **來源掃描會掃到自己的誠實旗標。**
   M8.4 掃 `interpolat|smooth` 時掃到自己的 `interpolated: false`——
   跟守衛腳本的 `FORBIDDEN` 清單必然含它要擋的字是同一個老問題。
   掃描前先剝掉旗標宣告，掃的是**運算**不是**宣告**。

3. **同步拋錯會逃出 per-item catch。**
   `Promise.resolve(fn())` 若 `fn()` 同步拋錯，Promise 還沒建立，錯誤直接逃出迴圈，
   整批失敗。改用 `Promise.resolve().then(() => fn())`。

---

## 附錄 C｜環境限制（不是程式問題）

本稽核環境的 egress 政策封鎖 `cdn.jsdelivr.net`（CONNECT 403），故：

- **本機 Pyodide runtime 實跑未驗**——只驗了程式碼與 lock 檔
- 所有瀏覽器實測都在「Core 不可用」狀態下進行，**降級路徑因此被測得很徹底**，
  但 Core 正常時的完整路徑要靠 CI Gate 19 或你本機確認
