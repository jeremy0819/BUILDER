# -*- coding: utf-8 -*-
"""
tools/check_image_whitelist.py — 圖檔白名單守衛（Gate 8）
==========================================================
背景（M5-P1 spec §1.3）：真實案件的地籍圖/基地照片/都計圖含可識別資訊（地號、地址、門牌），
而 `check_no_real_names.sh` 只掃文字不掃圖——影像是資料紀律的既有漏洞。

規則：**版控（git 追蹤）內的影像/文件檔，必須逐一列入下方白名單**；
未列名的影像進版控＝FAIL。真實案件視覺資產一律留本機
（Workspace localStorage／/local_calibration/，皆不進版控）。

白名單新增條件：僅限「合成/示意」圖（如 UI 佔位圖、logo），且 commit 訊息須說明用途。
"""
import subprocess
import sys

# 影像與易夾帶可識別資訊的二進位文件副檔名
EXTS = (".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".tif", ".tiff",
        ".svg", ".pdf", ".heic", ".heif")

# 白名單（repo 相對路徑，逐一列名；目前版控內零影像＝空清單）
WHITELIST: set = set()


def main() -> int:
    files = subprocess.run(["git", "ls-files"], capture_output=True, text=True,
                           check=True).stdout.splitlines()
    violations = [f for f in files
                  if f.lower().endswith(EXTS) and f not in WHITELIST]
    if violations:
        print("❌ Gate8 FAIL：發現未列白名單的影像/文件檔進版控（真實圖資風險）：")
        for f in violations:
            print("   ", f)
        print("→ 真實案件圖檔一律本機（localStorage / local_calibration）；"
              "合成示意圖須先列入 tools/check_image_whitelist.py 白名單。")
        return 1
    print(f"✅ Gate8 PASS：版控內影像檔皆在白名單（白名單 {len(WHITELIST)} 筆，違規 0）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
