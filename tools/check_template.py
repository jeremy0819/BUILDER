#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""CI Gate 3 — Excel 對照範本迴歸檢查（內容比對，非 raw bytes）。

背景：xlsx 是 zip、內嵌時間戳，重產的位元組不穩定，直接 `git diff` 會永遠非零。
所以本檔用 openpyxl 逐格比對「版控內範本」與「重新產生的範本」的儲存格值——
值一致就 PASS（防止有人手動竄改範本數字，使它與 make_template.py 的公式輸出不符）。
"""
import sys
import tempfile
import os
import runpy
import openpyxl

版控範本 = "tools/都更全案投報_對照範本.xlsx"


def 讀所有格(路徑):
    wb = openpyxl.load_workbook(路徑, data_only=False)
    快照 = {}
    for ws in wb.worksheets:
        for row in ws.iter_rows():
            for c in row:
                if c.value is not None:
                    快照[(ws.title, c.coordinate)] = c.value
    return 快照


def main() -> int:
    if not os.path.exists(版控範本):
        print(f"❌ Gate3 FAIL：找不到版控範本 {版控範本}")
        return 1
    版控快照 = 讀所有格(版控範本)

    # 重新產生到暫存目錄（make_template.py 輸出固定在自己所在的 tools/，先備份再還原）
    備份 = 版控範本 + ".ci_bak"
    os.replace(版控範本, 備份)
    try:
        runpy.run_path("tools/make_template.py", run_name="__main__")
        新快照 = 讀所有格(版控範本)
    finally:
        os.replace(備份, 版控範本)  # 一律還原版控版本，CI 不留副作用

    差異 = [k for k in set(版控快照) | set(新快照)
            if 版控快照.get(k) != 新快照.get(k)]
    if 差異:
        print(f"❌ Gate3 FAIL：範本內容與 make_template.py 輸出不符，{len(差異)} 格有差異：")
        for k in 差異[:10]:
            print(f"   {k}: 版控={版控快照.get(k)!r} vs 重產={新快照.get(k)!r}")
        return 1
    print(f"✅ Gate3 PASS：範本 {len(版控快照)} 格內容與 make_template.py 輸出完全一致")
    return 0


if __name__ == "__main__":
    sys.exit(main())
