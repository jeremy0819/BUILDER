#!/usr/bin/env bash
# 真實案件段名檢查（資料紀律紅線）。PASS=exit 0，FAIL=exit 1。
# 唯一允許含這些字串的檔案：本腳本、歷史乾淨度報告.md（稽核紀錄，僅 RE-DCF/docs 保存）。
# /local_calibration/ 為 M4.5 憲章明定的本機校準專區（.gitignore 排除、永不進版控），
# 本守衛的保護對象是「版控」，故該目錄不在掃描範圍（CI 的乾淨 checkout 本來就沒有它）。
# 用法：在 repo 根目錄執行  bash check_no_real_names.sh
set -u
FAIL=0
if grep -rnE "竹蓮|安和|安民|中正|龜山|永盛" \
     --exclude-dir=.git --exclude-dir=__pycache__ --exclude-dir=node_modules \
     --exclude-dir=local_calibration \
     --exclude=check_no_real_names.sh --exclude=歷史乾淨度報告.md . ; then
  FAIL=1
fi
if find . -path ./.git -prune -o -path ./local_calibration -prune -o -print \
     | grep -E "竹蓮|安和|安民|中正|龜山|永盛" ; then
  FAIL=1
fi
# ── 結構式守衛（補列舉式的洞）──────────────────────────────────
# 上面的清單只認「已知」段名，新案子一律放行——曾有含「○○段 809 地號」的文件
# 因此通過 Gate 0。下面改以地籍／門牌的**格式特徵**攔截，不必把真實段名寫進版控。
# 兩者互補：列舉式擋裸段名，結構式擋帶數字的地籍格式。
if ! python3 tools/check_real_data_patterns.py ; then
  FAIL=1
fi

if [ "$FAIL" -eq 1 ]; then
  echo "FAIL：發現疑似真實案件資料（上列命中處需去識別化）"; exit 1
else
  echo "PASS：零命中"; exit 0
fi
