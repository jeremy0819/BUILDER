# Release Notes — os-v0.6.0（2026-09-09）

> **一句話**：這一版改的是**溯源語意**——「這組數字對應哪一份輸入、由哪一版公式算出」
> 這個問題，從今以後跨瀏覽器邊界、跨 Core 版本都答得準。

| 座標 | 值 |
|---|---|
| CORE_VERSION | 0.6.0 |
| Schema | v1.1／v2.0／v2.1（**皆未變更**，位元組續凍）；新增 `decision.schema.v0.2.json` |
| 凍結 schema | 20 檔 |
| Decision Engine | 0.1.0 → **0.2.0** ｜ Strategy Engine 0.2.0 |
| CI Gate | 22 道全綠（253 pytest ＋ 490 node headless） |
| 前一版 | `os-v0.5.0`（仍在遠端，可回退） |

---

## 1. 溯源鍵跨語言邊界穩定（`input_hash` 數值正規化）

`input_hash` 原本雜湊的是 **Python 的型別表示**而非**數值**——`65.0` 與 `65` 產生不同雜湊。
那是 `json.dumps` 保留 int/float 型別的實作細節洩漏進溯源契約；在本領域，
`65.0` 與 `65` 是同一個單價、同一塊樓板面積。

JavaScript 沒有 int／float 之分，所以任何 engine 一經瀏覽器往返，整數值浮點就永久塌陷為整數，
雜湊隨之改變。自 M5.5 起「同一份 Core 在瀏覽器內執行」是既定架構，這個鍵就必須跨邊界穩定。

紀律：`bool` 先於 `int` 攔截（否則 `True` 會變成 `1`，那是型別竄改）；
NaN／±Infinity **明確拒絕**（非合法 JSON，靜默放行等於製造假溯源）；`-0.0 → 0`；不得就地修改輸入。

## 2. 快照身分改為二元組（Decision v0.2）

快照的身分本來就是「哪一份輸入」×「哪一版公式」兩件事，但比對只用了 `input_hash`。
於是同一份輸入、不同 Core 版本算出的 verdict 會被判定相符——**畫面只顯示「已綁定」，不會報錯**。
第 1 節讓這個鍵更可靠，反而放大了單鍵誤用的風險，因此兩者在同一版一起收斂。

三個邊界情形一律**從嚴**：

| 情形 | 處置 |
|---|---|
| `core_version` 為 `"unknown"`（v0.1 舊檔） | 拒絕綁定，明白要求重算——不提供「僅供參考」的軟綁定 |
| 快照與 decision 版本不同 | 視為不相符 |
| 只有 patch 差（0.6.0 vs 0.6.1） | **仍不相符**；整串比對，不拆 semver |

第三條最容易被日後「優化」掉，因此在測試裡直接釘死：任何「major/minor 相同就放行」的實作都會讓測試變紅。
公式相容與否不該由版號字面推定——patch 版也可能改係數。

`core_version` 一律 **verbatim 取自 `result`**，不得回填執行中的 `CORE_VERSION`：
前者記錄「我消費的這份結果是誰算的」，後者只是「誰在跑這支程式」。取不到標 `"unknown"` 並記入缺欄，不臆造。
比對規則由 **Core** 擁有（`decision.snapshot_matches()`），UI 只是鏡像——UI 不得自行發明綁定邏輯。

## 3. 介面：先講你的地，四步同一份數字

- 起始介面不再以「點選示範案 A～D」開場——那要求使用者先看懂四個沒見過的案子，才輪到自己的地。
  改為先問四個他一定知道的數字，Core 立刻算出允建容積、容積餘量、銷售坪數、全案投報率。
- 新增 `case-bus.js` 作為四步唯一讀寫口：一份輸入、一份 Core 結果，四步逐欄 verbatim 取用。
  來源只有 `core`／`input`／`decision` 三種，沒有第四種；取不到就顯示「—」，**介面不補算**（Gate 18 守）。
- 四步共用 shell／Decision 圖／本機地政邊界（Gate 20 守：官方地政入口不得夾帶案件資料）。

順手修掉一個真的錯誤：舊建案表單把 `面積表計入容積` 設成 `基地×容積率×(1+獎勵)+移轉`，
那是把 Core 的允建容積公式抄進前端，且讓「容積餘量」**永遠等於 0**。現已交回 Core 判斷。

---

## ⚠️ 升級須知（請務必轉達使用者）

> **0.6.0 起 `input_hash` 的定義已變更。** 0.5.0 以前產生的 Result／Decision JSON
> **仍可讀、可稽核**，但其 `input_hash` 是當時的歷史戳記，**不等於**以 0.6.0 重算的值。
> Decision 舊檔（v0.1）沒有 `core_version`，將標為 `unknown` 且**不再自動綁定快照**——請重算。

舊檔依 `VERSION_POLICY §5` **不回填**：重算＝產新檔新戳，舊檔原樣保留。
既有 `os-v0.5.0` tag 不移動、不重打。

## 已知缺陷（本版內，尚未修復）

1. **`jsonschema` 在 Pyodide 缺席**，而 `decide()`／`strategize()`／`allocate()` 都是
   「驗證失敗即 raise」——**這三個進入點在瀏覽器內必定拋錯**。
   且 worker 從未暴露 `decide`，故瀏覽器沒有產生決策的路徑：第四步顯示的判定一律來自
   匯入的 JSON 或烘焙的示範資料。修復進行中（`codex/strategy-security-workspace`）。
2. `tests/test_core_bundle.py` 以「封鎖 jsonschema＝Pyodide 條件」為前提，且只驗 `recompute`
   ——這是缺陷 1 長期未被發現的原因。修復時該測試的前提必須一併更新。
3. 示範案快照仍是 Core 0.2.0／0.3.0／0.4.0 產出，與現行 0.6.0 有落差；畫面已標明為靜態快照。
4. 尚無任何「真正開過瀏覽器」的自動化測試進 CI（Gate 19 保留給 Playwright，實作中）。
5. localStorage／IndexedDB 未加密；無企業身分驗證、RBAC 或伺服器審計。
6. 首次載入仍依賴 Pyodide CDN，離線首次啟動未完成。

## 驗收證據（發布當下實跑）

| 項目 | 結果 |
|---|---|
| pytest | 253 passed |
| node headless（10 檔） | 490 passed, 0 failed |
| Schema 凍結 | 20 檔全部相符 |
| Gate 0 資料紀律（工作區＋commit 訊息） | 零命中 |
| Core 隔離／範本／連結／圖檔／bundle 同步／Chart Contract | 全 PASS |
| 版本一致性（Gate 10） | PASS（本版另補洞：新增 engine／strategy 欄位守衛） |
