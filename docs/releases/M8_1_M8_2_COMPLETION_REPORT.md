# M8.1／M8.2 完成回報

> 日期：2026/08/13
> 分支：`codex/m8-viewfinder-1-2`
> 範圍：Chart Contract＋Attribution Waterfall
> 版本裁定：Presentation 純新增；`CORE_VERSION` 維持 `0.5.0`，Project Schema 不變

## 主管摘要

M8.1／M8.2 已把 M7.4 的歸因數字升級為可質詢的決策圖像。使用者可直接看見
「全案投報率為何改變」，並點選每個因素查看原始輸入、Core 版本、兩端雜湊、歸因方法
與實際重算次數。圖表不允許拖曳或編輯 Output，也不新增任何財務公式。

本輪的價值不是增加計算功能，而是降低會議中的解讀成本：正負影響、交互作用殘差、
顯示進位對帳與精確／近似狀態都在同一畫面，不再由 PM 口頭補充或另開 Excel 對帳。

## 工程交付

| 項目 | 交付內容 | 驗收 |
|---|---|---|
| M8.1 Chart Contract | `chart-contract-0.1`、registry、產生器、schema freeze、UI Binding Map | Gate 16 PASS |
| M8.2 Waterfall | Core presentation verbatim 瀑布圖、證據抽屜、桌機／窄版 | Gate 17：45 PASS |
| 非同步狀態 | Core ready 前禁用按鈕並顯示載入狀態 | 瀏覽器實測 PASS |
| 跨平台治理 | schema hash 正規化 CRLF／LF；既有內容不變 | 19 個 frozen schema PASS |
| 測試 fixture | 公開 CaseStore API 建立兩個去識別合成方案 | 實際 Workspace 流程 PASS |

主要檔案：

- `schemas/chart_contract.schema.v0.1.json`
- `apps/web/chart-contracts.json`／`chart-contracts.js`
- `apps/web/attribution-waterfall.js`
- `apps/web/workspace.html`
- `tools/check_chart_contracts.py`／`build_chart_contracts.py`
- `tests/web/test_viewfinder_waterfall.mjs`

## 不變式

1. 每個可見領域數值都讀 `attribution-0.1` 的 `presentation` 或證據欄位。
2. UI 只計算 CSS 座標與寬度；不計算 delta、貢獻、殘差、守恆或進位。
3. `target.higher_is_better` 決定改善／不利，不硬編碼正值為好。
4. 殘差永遠獨立；非零 `rounding_reconciliation` 另成一列。
5. Output 只可選取，沒有 input、select 或 draggable 路徑。
6. `attribution-0.1` 未提供法源，證據抽屜明示「未提供」，不得由 UI 推論。

## 驗證紀錄

- Python：`208 passed`
- Web headless：`379 passed`（含 Gate 17 新增 45 項）
- Gate 0 結構守衛：真陽性 7／7、假陽性 9／9，repo 零命中
- Gate 4：本地連結 84 條可達
- Gate 6：19 份凍結 schema 相符
- Gate 8／9／10：影像白名單、Core bundle、前端版本全綠
- 實際瀏覽器：1280px 與 390px；無水平溢位、無 console error
- 實際互動：案件匯入 → Scenario 選取 → Core ready → Shapley 4 次重算 →
  瀑布圖 → 證據切換 → 改選擇器使舊報告失效

## 風險與後續

**P1：瀏覽器 JSON 數值型別與原始 Python hash。** JSON 進入 JavaScript 後無法保留
`1500` 與 `1500.0` 的型別差異，Scenario 登錄的原始 hash 可能與瀏覽器送回 Pyodide
重播後的 hash 不同。本輪證據抽屜只採 Core 重播回報的 `before.input_hash`／
`after.input_hash`，不混用 Scenario 選擇器的登錄 hash。下一輪應獨立裁定跨執行期
canonicalization，不能在 UI 偷換 hash，也不應在未遷移前直接改既有 `input_hash()`。

**M8.3 建議下一站：互動量體。** 沿用同一 Chart Contract，加入樓層與明細列雙向選取，
仍維持 Output 不可拖曳。M8.5 已定案方案 B：本機 GeoJSON、EPSG:4326、零外部圖磚、
零地理編碼、案件圖資不進版控。
