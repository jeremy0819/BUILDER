# -*- coding: utf-8 -*-
"""
tools/check_web_version.py — Gate 10：前端版本徽章與 Core／tag 同步守衛。

病灶（實際發生過）：首頁寫 os-v0.2.0-beta、某頁寫 core 0.3.0、程式其實是 0.4.0——
使用者看到互相矛盾的版本，等於 SSOT 在「呈現層」漂移。

守衛規則：
  1. apps/web/version.js 的 core 必須 == core/redcf/_version.py 的 CORE_VERSION。
  2. apps/web/version.js 的 release 必須是「實際存在的 git tag」中最新的 os-v*。
     （取不到 git 資訊時跳過此項，不讓離線環境誤紅。）
  3. 各頁不得再出現與現行 CORE_VERSION 矛盾的「Core vX.Y.Z」硬編字串。
     例外：明確標為快照/歷史溯源者（含「快照」字樣的同一行）＝合法 provenance，不算漂移。
"""
import pathlib
import re
import subprocess
import sys

根 = pathlib.Path(__file__).resolve().parents[1]
VERSION_JS = 根 / "apps" / "web" / "version.js"
CORE_VER_PY = 根 / "core" / "redcf" / "_version.py"
WEB = 根 / "apps" / "web"


def core_version() -> str:
    m = re.search(r'CORE_VERSION\s*=\s*"([^"]+)"', CORE_VER_PY.read_text(encoding="utf-8"))
    if not m:
        raise SystemExit("❌ 讀不到 CORE_VERSION")
    return m.group(1)


def js_field(name: str) -> str:
    m = re.search(name + r'\s*:\s*"([^"]+)"', VERSION_JS.read_text(encoding="utf-8"))
    return m.group(1) if m else ""


def latest_tag() -> str:
    try:
        out = subprocess.run(["git", "tag", "-l", "os-v*"], cwd=str(根),
                             capture_output=True, text=True, timeout=20)
        tags = [t.strip() for t in out.stdout.splitlines() if t.strip()]
    except Exception:
        return ""
    if not tags:
        return ""
    def key(t):
        m = re.match(r"os-v(\d+)\.(\d+)\.(\d+)", t)
        return tuple(int(x) for x in m.groups()) + (0 if "-" in t[5:] else 1,) if m else (0, 0, 0, 0)
    return sorted(tags, key=key)[-1]


def main() -> int:
    壞 = []
    cv = core_version()

    if not VERSION_JS.exists():
        print("❌ Gate10 FAIL：缺 apps/web/version.js（前端版本單一來源）")
        return 1

    if js_field("core") != cv:
        壞.append(f"❌ version.js core={js_field('core')!r} ≠ CORE_VERSION={cv!r}")

    lt = latest_tag()
    if lt and js_field("release") != lt:
        壞.append(f"❌ version.js release={js_field('release')!r} ≠ 最新 tag {lt!r}")

    # 各頁硬編版本：與現行 CORE_VERSION 矛盾且未標「快照」＝漂移
    pat = re.compile(r"[Cc]ore\s+v?(\d+\.\d+\.\d+)")
    for p in sorted(WEB.glob("*.html")):
        for i, line in enumerate(p.read_text(encoding="utf-8").splitlines(), 1):
            if "快照" in line or "snapshot" in line.lower():
                continue                                   # 歷史溯源戳記＝合法
            for ver in pat.findall(line):
                if ver != cv:
                    壞.append(f"❌ {p.relative_to(根)}:{i} 硬編 core {ver}（現行 {cv}，且未標『快照』）")

    if 壞:
        print("\n".join(壞))
        print("\n前端版本漂移：請改用 apps/web/version.js（data-uros-ver）或標明為快照溯源。")
        return 1
    print(f"✅ Gate10 PASS：前端版本一致（core {cv}"
          + (f" · release {lt}" if lt else "") + "）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
