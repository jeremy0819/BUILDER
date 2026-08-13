# -*- coding: utf-8 -*-
"""
tools/check_real_data_patterns.py — Gate 0 結構式守衛（資料紀律紅線）
=====================================================================
`check_no_real_names.sh` 原本是**列舉式**守衛：只認清單上的既有段名，
新案子的段名一律放行。實際上就曾發生過——一份含「○○段 809 地號」的文件
通過了 Gate 0，因為那個段名不在清單裡。

本工具補的是那個洞：**不點名任何真實段名**，改以「真實地籍／門牌資料長什麼樣」
的結構特徵攔截。好處是不必為了擋一個案子，就把該案的段名寫進版控。

三條樣式（皆為高辨識度格式，實測對現有 repo 零誤報）：
  R1  地號／建號 緊鄰數字      → `809 地號`、`建號 1234`
  R2  段名＋數字               → `○○段 809`（排除階段／路段／地段等常用詞）
  R3  門牌                     → `○○路 12 號`、`○○巷 3 弄 5 號`

**限制（誠實揭露）**：結構式守衛擋的是「格式」，擋不掉「裸段名」
（例：文中只寫「○○段」而未接地號）。那仍由 `check_no_real_names.sh`
的列舉清單負責。兩者是互補關係，不是替代——單用任一種都有缺口。

用法：
  python tools/check_real_data_patterns.py            # 掃描工作區
  python tools/check_real_data_patterns.py --selftest # 驗守衛自身（真陽性＋假陽性）
"""
import pathlib
import re
import sys

根 = pathlib.Path(__file__).resolve().parents[1]

跳過目錄 = {".git", "__pycache__", "node_modules", ".venv", "venv",
            "local_calibration",          # M4.5 本機校準專區（gitignored，永不進版控）
            ".pytest_cache", ".ruff_cache"}
跳過副檔 = {".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".webp",
            ".docx", ".xlsx", ".pptx", ".pdf", ".zip", ".woff", ".woff2", ".ttf"}
跳過檔名 = {"check_real_data_patterns.py",   # 本檔含樣式與 fixture
            "check_no_real_names.sh",
            "歷史乾淨度報告.md"}

# 「段」的前一字若屬下列，則為常用詞（階段／路段／地段…），非地籍段名
非段名前字 = set("階手路區時身片分地字橋前後中末初上下本該各每整半"
                 "一二三四五六七八九十首尾唱樂音節車航區間")

樣式 = [
    ("R1 地號/建號", re.compile(r"[0-9]{1,6}\s*(?:地號|建號)|(?:地號|建號)\s*[0-9]{1,6}")),
    ("R2 段名+數字", re.compile(r"[一-鿿]{2,3}段\s*[0-9]{1,6}")),
    # 門牌允許路名帶「N段」（民生東路 3 段 45 號）；「路段／區段」因段前無數字而不命中
    ("R3 門牌",      re.compile(r"(?:路|街|大道|巷|弄)\s*"
                                r"(?:[0-9一二三四五六七八九十]{1,3}\s*段\s*)?"
                                r"[0-9]+\s*(?:號|巷|弄)")),
]


def _是常用詞誤報(文字: str, m: re.Match, 標籤: str) -> bool:
    """R2 專用：判斷命中的『段』是否其實是階段／路段之類的常用詞。"""
    if not 標籤.startswith("R2"):
        return False
    seg = 文字[m.start():m.end()]
    i = seg.find("段")
    if i <= 0:
        return True
    return seg[i - 1] in 非段名前字


def 掃描(根目錄: pathlib.Path):
    命中 = []
    for p in sorted(根目錄.rglob("*")):
        if not p.is_file():
            continue
        if any(s in p.parts for s in 跳過目錄):
            continue
        if p.suffix.lower() in 跳過副檔 or p.name in 跳過檔名:
            continue
        try:
            txt = p.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        for 標籤, rx in 樣式:
            for m in rx.finditer(txt):
                if _是常用詞誤報(txt, m, 標籤):
                    continue
                行 = txt[:m.start()].count("\n") + 1
                摘 = txt[max(0, m.start() - 30):m.end() + 20].replace("\n", " ")
                命中.append((標籤, p.relative_to(根目錄), 行, 摘))
    # 檔名本身也掃（真實資料常先出現在檔名）
    for p in sorted(根目錄.rglob("*")):
        if any(s in p.parts for s in 跳過目錄):
            continue
        for 標籤, rx in 樣式:
            m = rx.search(p.name)
            if m and not _是常用詞誤報(p.name, m, 標籤):
                命中.append((標籤 + "（檔名）", p.relative_to(根目錄), 0, p.name))
    return 命中


# ── 守衛的自測：擋得住該擋的，也放得過不該擋的 ──────────────────
真陽性 = [
    "新北市某區廣明段 809 地號等 35 筆土地",
    "地號 1234 之權利範圍",
    "建號 00567 之他項權利",
    "○○段 12 地號",
    "中山路 100 號 3 樓",
    "民生東路 3 段 45 號",
    "文昌街 12 巷 5 弄 3 號",
]
假陽性 = [
    "本案分為三個階段 1 年內完成",          # 階段
    "S1 整合階段 2 年",                      # 階段
    "此路段 3 公里",                          # 路段
    "地段、地號／建號、面積、分區、來源文件",   # 欄位標籤（無數字相鄰）
    "第 5 號會議紀錄",                        # 號但非門牌
    "區段徵收 3 案",                          # 區段
    "時段 2 小時",                            # 時段
    "第三種住宅區",                           # 無地籍格式
    "共同負擔 8 項費目",
]


def selftest() -> int:
    壞 = []
    for s in 真陽性:
        if not any(rx.search(s) and not _是常用詞誤報(s, rx.search(s), 標籤)
                   for 標籤, rx in 樣式):
            壞.append(f"❌ 應攔截卻放行：{s}")
    for s in 假陽性:
        for 標籤, rx in 樣式:
            m = rx.search(s)
            if m and not _是常用詞誤報(s, m, 標籤):
                壞.append(f"❌ 誤報（{標籤}）：{s}　命中「{m.group(0)}」")
    if 壞:
        print("\n".join(壞))
        print(f"\n守衛自測失敗：{len(壞)} 項")
        return 1
    print(f"✓ 守衛自測通過（真陽性 {len(真陽性)} 項全攔、假陽性 {len(假陽性)} 項全放）")
    return 0


def main() -> int:
    if "--selftest" in sys.argv:
        return selftest()
    if selftest() != 0:
        return 1
    命中 = 掃描(根)
    if 命中:
        for 標籤, f, 行, 摘 in 命中:
            print(f"❌ [{標籤}] {f}:{行}  …{摘}…")
        print(f"\nGate0-結構式：發現 {len(命中)} 處疑似真實地籍／門牌資料，需去識別化。")
        print("（若確為誤報，請調整 tools/check_real_data_patterns.py 的樣式或排除清單，"
              "不要把真實資料加進允許清單。）")
        return 1
    print("✅ Gate0-結構式 PASS：無地號／建號／段名＋數字／門牌等地籍格式")
    return 0


if __name__ == "__main__":
    sys.exit(main())
