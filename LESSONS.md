# LESSONS — 踩雷教訓（格式見 governance/MAINTENANCE.md §2；超過 100 行時歸併精簡）

## 2026-07-06 改 import 只掃檔頭，漏掉深處延遲 import
症狀：app.py 頂部 import 已改 core.redcf，Streamlit 實開仍炸 `ModuleNotFoundError: calc_engine`。
根因：`app.py:725` 函式內有延遲 `from calc_engine import ...`，sed 只處理了檔頭區塊。
規則：改 import 路徑時，用 `grep -n "舊模組名" 整個檔案` 確認零殘留才算改完；
　　　驗收必須實跑（R2-3），py_compile 與 pytest 都抓不到 UI 路徑上的延遲 import。

## 2026-07-06 pkill 把自己的 shell 一起殺掉
症狀：`pkill -f "streamlit run" && 後續指令` 以 exit 144 中斷，後續 commit/push 沒跑。
根因：`pkill -f` 的 pattern 匹配到當前 shell 的指令字串本身（指令列含同字串）。
規則：kill 背景程序用獨立的一次 Bash 呼叫，不要與重要指令串在同一條 `&&` 鏈；
　　　pattern 儘量用完整啟動指令字串降低誤殺。
