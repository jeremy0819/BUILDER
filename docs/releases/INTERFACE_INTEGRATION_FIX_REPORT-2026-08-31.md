# BUILDER 介面整合修復報告

日期：2026-08-31  
分支：`codex/interface-integration-fix`  
基準：`origin/claude/m6-kickoff-part-a-xooh6i` (`dbc477f`)

## 主管摘要

本輪修復首頁、Dashboard 與案件資料層之間的三個整合斷點。修復後，首頁即時試算、四步摘要、Dashboard 與新建案件均共用同一份 `CaseBus` 契約及 Core result；既有案件更新不再改變案件 PID，也不會覆蓋地主、任務、清冊或決策等案件事實。

本輪未修改 Core Formula、未修改凍結 Schema、未在 UI 新增權威計算。

## 問題與根因

| 嚴重度 | 問題 | 根因 | 風險 |
|---|---|---|---|
| P1 | 首頁 Core 即時讀數已更新，但四步摘要仍顯示舊值或 `—` | 既有案件時只讀 persisted `view`，未將最新 Core result 套入預覽紀錄 | 同頁數值互相矛盾，使用者無法判斷何者可信 |
| P1 | 更新既有案件可能丟失案件管理資料 | 首頁以 `buildRecord()` 重建空白紀錄後覆蓋舊案 | 地主、同意事件、任務、Decision、roster 可能被清空 |
| P1 | 改一個輸入後案件 PID 跟著 input hash 改變 | 把快照身分 `input_hash` 當成 Project Entity 身分 | Activity、里程碑及其他以 PID 關聯的資料成為孤兒 |
| P1 | Dashboard 新建案件另有一套 engine／record 組裝 | `ncEngine()` 與 `submitNewCase()` 複製公式及資料結構 | 入口分岔；`面積表計入容積` 使容積餘量失真 |
| P2 | Windows 執行 Core bundle 測試時 CP950 解碼失敗 | fixture `read_text()` 未指定 UTF-8 | 本機測試誤紅，阻礙驗收 |

## 工程修正

1. `CaseBus.applyResult()` 保留穩定 PID 與既有案件事實，只更新 engine、Core view、snapshot provenance 及可編輯的案件基本資料。
2. Decision 依 `(input_hash, core_version)` 二元組判斷是否仍有效；任一值不符即卸下並保留於 `detached_decision` 供稽核。
3. `CaseBus.replace()` 固定沿用既有 Project PID；`input_hash` 僅代表計算快照。
4. 首頁四步摘要以 `applyResult()` 產生不落盤的即時預覽；按下更新後才寫回同一案件。
5. Dashboard 新建案件改為只呼叫 `CaseBus.buildEngine()`、`buildRecord()` 與 `upsert()`，移除第二套 UI 計算及 record 組裝。
6. Python 測試讀取 UTF-8 fixture 時明確指定編碼。

## 驗證證據

- Python：`253 passed`。
- Web headless：`461 passed`。
- Gate 0：真實資料列舉式與結構式守衛 PASS。
- Gate 2/3/4：Core isolation、Excel template、Web links PASS。
- Gate 6：20 份凍結 Schema hash 全數相符。
- Gate 8/9/10/16：影像白名單、Core bundle、Web version、Chart contract PASS。
- 實際瀏覽器：首頁 `2,100 -> 2,200 m2` 後，Core 與四步摘要同步由 `8,190 -> 8,580 m2`；未送出前 Dashboard 仍為舊值，送出後 PID 維持 `prj-demo-a` 且新值正確寫回。
- 實際瀏覽器：Dashboard 新建合成案件，預覽與建立後的 Core 數值一致；瀏覽器控制台零錯誤。

## 後續建議

本輪瀏覽器測試另確認：`人行廣場 > 基地面積` 目前仍可送入 Core，會得到負的可建面積與財務結果。這不是本次整合斷點，建議下一小版由 Core／Schema 先裁決跨欄位拒答契約，再由 UI 呈現同一份結構化錯誤；不應只在單一表單私下攔截。
