#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""CI Gate 4 — 靜態站本地連結檢查（404 直接 Fail）。

掃描 apps/web/ 下每個 .html 的 href/src，凡指向本地檔案者，驗證目標存在。
外部連結（http/https/mailto）、data: URI、純錨點 #、javascript: 一律略過。
"""
import sys
import re
import os
from urllib.parse import unquote

WEB = "apps/web"
連結樣式 = re.compile(r'(?:href|src)\s*=\s*["\']([^"\']+)["\']', re.IGNORECASE)


def 該略過(目標: str) -> bool:
    低 = 目標.strip().lower()
    # 網站根相對路徑（/foo.html）在 Pages 部署時的根未必＝apps/web，本地檔案系統無法可靠解析，
    # os.path.join 遇 "/" 開頭還會丟棄基準目錄退化成絕對路徑（假陽/假陰）——一律略過並警示。
    if 低.startswith("/") and not 低.startswith("//"):
        print(f"⚠️ 略過網站根相對連結（本檢查無法解析）：{目標}")
        return True
    return (低.startswith(("http://", "https://", "//", "data:", "mailto:",
                           "javascript:", "tel:", "#")) or 低 == "")


def main() -> int:
    if not os.path.isdir(WEB):
        print(f"❌ Gate4 FAIL：找不到 {WEB}/")
        return 1
    壞連結 = []
    檢查數 = 0
    for 根, _, 檔案s in os.walk(WEB):
        for 檔 in 檔案s:
            if not 檔.endswith(".html"):
                continue
            頁路徑 = os.path.join(根, 檔)
            with open(頁路徑, encoding="utf-8") as f:
                內容 = f.read()
            for 目標 in 連結樣式.findall(內容):
                if 該略過(目標):
                    continue
                相對 = unquote(目標.split("#")[0].split("?")[0])
                if not 相對:
                    continue
                目標路徑 = os.path.normpath(os.path.join(根, 相對))
                檢查數 += 1
                if not os.path.exists(目標路徑):
                    壞連結.append(f"{頁路徑} → {目標}（找不到 {目標路徑}）")
    if 壞連結:
        print(f"❌ Gate4 FAIL：{len(壞連結)} 個死連結：")
        for b in 壞連結:
            print(f"   {b}")
        return 1
    print(f"✅ Gate4 PASS：apps/web 本地連結 {檢查數} 條全部可達")
    return 0


if __name__ == "__main__":
    sys.exit(main())
