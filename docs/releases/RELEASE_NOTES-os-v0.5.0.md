# os-v0.5.0 — M7 Case OS

發布日期：2026-08-10

Core：`0.5.0`

計算合約：`v2.1`

## 本版內容

- M7.1：以 IndexedDB 為本地優先儲存層，Activity 為 append-only 事件流。
- M7.2：Watchtower 以法定期限庫與案件事實組合「今天要做什麼」及時間軸。
- M7.3：多方案管理要求完整 input set，並機器守衛恰好一個作準方案。
- M7.4：`attribution.py` 提供 Shapley 歸因、殘差守恆與結構化拒答；Workspace 僅呈現 Core 輸出。
- M7.5：量體／逐層視圖只讀既有 `floors[]`；權威合計缺值顯示「—」，不由 UI 回推。

## 不在本版範圍

- GIS 疊圖暫緩。外部圖磚不符合離線、零依賴的現階段約束。
- 歸因首版不接受 `floors`、`owners`、`case_type`、`mode` 等結構性差異；Core 會帶 `reason_code` 與 `paths` 明確拒答。
- 全案投報率為靜態比率，非 IRR；歸因差異單位為百分點（ppt）。

## 驗收

- GitHub Actions CI：候選程式 `86abae3` 全數通過。
- 本 release commit 僅修正版本顯示、發布紀錄與重複的 changelog 段落，未修改 Core、schema 或 UI 邏輯。
- Workspace 實測：乾淨 session、匯入 v2.1 案例、量體視圖，以及 1440px／390px 視窗均已檢視。
