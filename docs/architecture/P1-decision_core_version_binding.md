# P1 · Decision 契約缺 `core_version`，快照比對只用單鍵

> **狀態**：**已裁決並實作完成**（2026-08）——三個邊界情形使用者裁決一律從嚴；
> 落地＝`schemas/decision.schema.v0.2.json`（新增檔）＋`core.redcf.decision.snapshot_matches()`
> ＋`workspace.html` 二元組比對；回歸見 `tests/test_decision.py`（12 條）與
> `tests/web/test_workspace.mjs`（13 條）。本文保留為決策紀錄。
> **提出**：使用者於 M8.1／M8.2 裁決時另立
> **與 hash 遷移的關係**：**互補，非替代**；兩者必須分開合併與驗收
> **查證日**：2026/08

---

## 1. 缺口（已逐項核對）

| 查核項 | 現況 | 位置 |
|---|---|---|
| Workflow 快照攜帶的身分 | `input_hash` **＋** `core_version` 兩者皆存 | `workspace.html` snapshot 建構 |
| Decision 契約 | 欄位清單**無** `core_version` | `schemas/decision.schema.v0.1.json` |
| 實際比對邏輯 | **只比 `input_hash`** 單鍵 | `workspace.html` `matchDecision()` |

```js
// 現況：單鍵比對
return (wf.project.snapshots || []).some(s => s.input_hash === decision.input_hash);
```

快照的身分定義是 **`input_hash@core_version` 二元組**，但比對只用了前半。
Decision 契約則根本沒有記錄它消費的是哪一版 Core。

---

## 2. 為什麼數值正規化解決不了這個

兩者處理的是**不同軸**的失配，必須分開理解：

| 失配類型 | 成因 | 由誰解決 |
|---|---|---|
| **同一份輸入，跨語言算出不同雜湊** | Python 保留 int／float 型別，JS 沒有 | `input_hash` 數值正規化（已核准） |
| **同一份輸入，跨 Core 版本算出不同結果** | 公式或係數改版 | **本 P1**：二元組比對 |

正規化讓「相同輸入 → 相同雜湊」成立。但它**同時也讓一個新風險浮現**：
一旦雜湊跨邊界穩定了，`input_hash` 單鍵就更像一個可靠的身分鍵——
於是更容易有人拿它當唯一鍵用，而忽略「同一份輸入在 Core 0.5.0 與 0.6.0 下
會算出不同的 verdict」。

> **正規化修好了鍵的穩定性，反而放大了單鍵比對的誤用風險。**
> 這是為什麼兩者要分開做、但必須在同一個 release 前一起收斂。

### 具體誤掛情境

`os-v0.6.0` 上線後（`input_hash` 定義已變、CORE_VERSION 0.6.0）：

1. 使用者手上有一份 Core 0.5.0 產出的 decision JSON。
2. 重新匯入同一份 v2.1 案件 → 以 0.6.0 重算 → 新的 `input_hash`。
3. 若使用者也重算了 decision，兩份 decision 的 `input_hash` 會相同（同輸入同版本）。
4. **但若舊 decision 因某種路徑仍帶著能對上的雜湊**（例如手動保存、或未來加入
   跨版本雜湊相容層），`matchDecision()` 會判定相符——
   實際上那份 verdict 是用**不同的公式**算出來的。

畫面不會報錯，只會顯示「已綁定」。**這正是最危險的失敗形態：靜默的錯誤綁定。**

---

## 3. 規劃方向（待裁決，本文不實作）

### 3.1 Decision v0.2 攜帶 `core_version`

新增契約檔 `schemas/decision.schema.v0.2.json`（**新增檔，不動 v0.1 凍結**）：

- 新增必填 `core_version`：記錄產生本 decision 時所消費的 Core 版本。
- 其餘欄位沿用 v0.1（純新增＝minor）。
- `core/redcf/decision.py` 的 `decide()` 輸出補上該欄位。
- 遷移：v0.1 檔案讀入時 `core_version` 標為 `"unknown"`，**不臆造**——
  舊檔確實不知道自己是哪版算的，硬填等於製造假溯源。

### 3.2 比對改為二元組

```js
// 目標：二元組比對
s.input_hash === d.input_hash && s.core_version === d.core_version
```

**須一併裁決的邊界情形**：

| 情形 | 選項 |
|---|---|
| decision 的 `core_version` 為 `"unknown"`（v0.1 舊檔） | (a) 拒絕綁定並提示重算　(b) 允許綁定但標示「版本不明，判讀僅供參考」 |
| 快照與 decision 版本不同 | (a) 視為不相符　(b) 相符但顯著警示「跨版本」 |
| 只有 patch 版差異（0.6.0 vs 0.6.1） | 是否視為相容？**建議否**——公式相容與否不該由版號字面推定 |

> 我的傾向：**一律從嚴**（不相符即不綁定，並明白告訴使用者要重算）。
> 理由與 M7.4 的「明確拒答優於虛假歸因」同一條：
> 一個標著「僅供參考」的錯誤綁定，比一個乾脆的「請重算」更容易被當真。

### 3.3 影響面

| 項目 | 影響 |
|---|---|
| `decision.schema.v0.1` | **不動**（凍結維持），新增 v0.2 |
| `tests/test_decision.py` | 補二元組比對回歸與 `"unknown"` 邊界案例 |
| `workspace.html` | `matchDecision()` 改二元組；UI 需新增「版本不符」狀態 |
| Project Schema | **零變更** |
| `CORE_VERSION` | 依 VERSION_POLICY「合約結構變動才 bump」——新增契約檔屬純新增，是否 bump 待裁決 |

---

## 4. 排程建議

```
1. input_hash 數值正規化 PR（已核准）      → CORE_VERSION 0.6.0
2. 本 P1 裁決 → Decision v0.2 實作          → 於 os-v0.6.0 發布前完成
3. os-v0.6.0 發布（走 CHECKLIST）
```

順序理由：先修鍵的穩定性，再修鍵的完整性。反過來做的話，
二元組裡的 `input_hash` 那一半仍是跨邊界不穩的，等於在流沙上蓋第二層。

> ⚠️ 本文為規劃紀錄，**不得併入 `input_hash` 遷移 PR**（使用者明示）。


---

## 5. 落地紀錄（2026-08）

| 裁決 | 實作位置 | 回歸 |
|---|---|---|
| ① `unknown` → 拒絕綁定 | `snapshot_matches()` 回 `core_version_unknown` | `test_從嚴一_*`（3 條）＋ headless |
| ② 跨版本 → 視為不相符 | `snapshot_matches()` 回 `core_version_mismatch` | `test_從嚴二_*`（3 條）＋ headless |
| ③ patch 差 → 仍不相符 | 整串相等才算相符，**不拆 semver** | `test_從嚴三_*`（2 條）＋ headless |

**規則歸屬**：比對規則由 **Core** 擁有（`core/redcf/decision.py`），`workspace.html` 只是同規則的
瀏覽器側鏡像，兩側各有一組測試釘住同樣三條斷言。這符合「UI 零推論」——UI 不得自行發明綁定邏輯。

**附帶處置**：四個示範案的 decision 原為 v0.1（無 `core_version`），已依其快照 verbatim 補記
（A/B/C＝0.4.0，D＝0.3.0），故仍可正常綁定。
**未了項**：示範案的 result 快照仍是 Core 0.3.0／0.4.0 產出，與現行 0.6.0 有落差；
以 0.6.0 重新產生示範案是獨立工作，不在本次範圍。
