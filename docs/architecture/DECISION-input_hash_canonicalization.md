# 決策紀錄 · `input_hash` 數值正規化（P1）

> **狀態**：待使用者裁決
> **提出**：M8.1／M8.2 交接時由主管標記為 P1
> **影響層級**：溯源契約（Core）；牽動 5 個黃金範例檔與 2 個測試常數
> **查證日**：2026/08

---

## 1. 問題（已實測確認，非臆測）

`input_hash()` 雜湊的是 **Python 的型別表示**，不是**數值**：

```
Python 原生      {"住宅單價":65.0,"戶數":112.0}  → sha256:2810f618…
經 JS 往返後     {"住宅單價":65,"戶數":112}      → sha256:02def0be…
                                                   ^^^ 不同
```

JavaScript **沒有 int／float 之分**——`65.0` 在 JS 裡就是 `65`。因此任何 engine
一旦經過瀏覽器（postMessage、localStorage、IndexedDB、`JSON.stringify`），
整數值浮點就永久塌陷為整數，雜湊必然改變。

這不是瀏覽器的怪癖，而是**契約定義的瑕疵**：`65.0` 與 `65` 在本領域是同一個數
（同一個單價、同一塊樓板面積）。現行實作把它們視為不同輸入，純粹是
Python `json.dumps` 保留型別的實作細節洩漏進了契約。

### 1.1 為什麼是 P1 而不是 P3

`input_hash` 不只用於顯示，它被當作**等值比對鍵**：

```js
// apps/web/workspace.html:437  matchDecision()
return (wf.project.snapshots || []).some(s => s.input_hash === decision.input_hash);
```

目前兩側都是 Python 產出的雜湊，故相符。但 M5.5 B1 起，同一份 Core 已經在
瀏覽器內執行（Pyodide）——**只要有人拿瀏覽器算出的雜湊去比對匯入檔的雜湊，
就會靜默失配**：decision 綁不上 snapshot，而畫面不會報錯，只會顯示「查無對應」。

M8.2 目前僅**顯示**雜湊（`attribution-waterfall.js:169-170`），未做比對，
所以尚未咬到人。這是潛伏缺陷，不是已爆的 bug——但它會在下一個拿雜湊當鍵的功能上爆。

---

## 2. 為什麼不能在 UI 或 Worker 端修

主管的判斷正確：**不宜在 UI 偷換**。理由不只是紀律，而是技術上做不到：

JS 已經**遺失**了 int／float 的區別，邊界層無從還原「原本是 65.0 還是 65」。
邊界正規化能做的，只是讓兩側用同一種方式塌陷——那本質上就是方案 A，
只是放錯了地方（放在邊界＝每個消費端各自實作一次，遲早分岔）。

**正規化必須發生在雜湊的定義處，也就是 Core。**

---

## 3. 方案

### A. Core 端數值正規化（建議）

在 `input_hash()` 序列化前，把整數值浮點正規化為整數：

```python
def _canon(o):
    if isinstance(o, bool): return o
    if isinstance(o, float) and o.is_integer(): return int(o)
    if isinstance(o, dict): return {k: _canon(v) for k, v in o.items()}
    if isinstance(o, list): return [_canon(v) for v in o]
    return o
```

**實測結果**：正規化後 JS 往返雜湊**穩定**（現行為不穩定）。

| 項目 | 影響 |
|---|---|
| 黃金範例檔 | **5 檔** `provenance.input_hash` 需重新產生 |
| 測試常數 | `tests/test_allocation.py` 的 `HASH`、`tests/test_decision.py` 的 `HASH` |
| 自洽型測試 | `test_api`／`test_core_bundle` 比對的是「現算 vs 現算」，不受影響 |
| Schema | **零變更**——`input_hash` 是值不是欄位，凍結檔位元組不動 |
| CORE_VERSION | 依 VERSION_POLICY「合約結構變動才 bump」→ 溯源語意變更，建議 **0.5.0 → 0.6.0** |

**風險**：既有已發出的 result JSON，其 `provenance.input_hash` 將與新版重算值不符。
依 VERSION_POLICY §5「舊 Result JSON 不重寫：重算＝產新戳，舊檔保留」，
這是**預期內**的版本行為，非資料損毀；但需在 CHANGELOG 明文記載，
並保留舊檔以供稽核。

### B. 維持現狀，明文限制比對範圍

不改實作，改在文件與 UI 註明「雜湊僅在同一產生端內可比對」。

- 成本最低，但把責任推給每個消費端記得這條限制。
- 與本專案「守衛要用機器擋，不靠人記得」的一貫做法相悖。
- **不建議**——這正是 M8 規格說的「誤讀的防線要進契約，不能只靠設計師記得」。

### C. 另立 `canonical_input_hash`，兩個雜湊並存

保留舊雜湊向下相容，新增一個跨邊界穩定的雜湊。

- 不破壞既有範例與測試。
- 但**兩個雜湊必然造成混淆**：哪個該存進 provenance？哪個該拿來比對？
  消費端選錯就回到原問題，而且更難察覺。
- 不建議，除非有無法重算的歷史資料必須保住原雜湊。

---

## 4. 建議

採 **方案 A**，理由三點：

1. **它修的是定義，不是症狀**。`65.0` 與 `65` 是同一個數；現行行為是實作細節洩漏。
2. **架構要求它**。M5.5 B1 起「同一份 Core 在瀏覽器內執行」是既定架構，
   溯源鍵就必須跨邊界穩定，否則 Pyodide 這條路上的所有溯源都是脆的。
3. **成本已量化且可控**：5 個範例檔＋2 個測試常數，schema 零變更。

### 執行順序（若核准）

1. `input_hash()` 加入正規化，補跨邊界穩定性回歸（JS 往返 fixture）
2. 重新產生 5 個範例檔的 `provenance.input_hash`，舊檔以 git 歷史保留
3. 更新 `test_allocation` / `test_decision` 的 HASH 常數
4. `CORE_VERSION` 0.5.0 → 0.6.0；CHANGELOG 記明「溯源語意變更，舊 result 不回填」
5. 重建 `core-bundle.js`（Gate 9）
6. 全套 Gate 複驗

> ⚠️ 未經核准前不執行。這會改動已發布 os-v0.5.0 的黃金範例溯源值，
> 屬不易回復的變更，依專案慣例須由 repo 擁有者裁定。
