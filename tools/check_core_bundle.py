# -*- coding: utf-8 -*-
"""
tools/check_core_bundle.py — Gate 9：core-bundle.js 與 core/redcf 同步守衛。
重建 bundle，比對現存檔位元組；不一致＝原始碼改了卻沒重跑 build_core_bundle.py。
→ 保證瀏覽器端跑的就是 SSOT 那一份 Core（不會出現第二真源/版本漂移）。
"""
import pathlib
import sys

根 = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(根 / "tools"))
import build_core_bundle as B   # noqa: E402

OUT = 根 / "apps" / "web" / "core-bundle.js"


def main() -> int:
    if not OUT.exists():
        print("❌ Gate9 FAIL：apps/web/core-bundle.js 不存在，請跑 python tools/build_core_bundle.py")
        return 1
    現存 = OUT.read_text(encoding="utf-8")
    重建 = B.建置()
    if 現存 != 重建:
        print("❌ Gate9 FAIL：core-bundle.js 與 core/redcf 不同步"
              "（原始碼改了但未重建 bundle）。請跑：python tools/build_core_bundle.py")
        return 1
    ver = 重建.split('CORE_BUNDLE_VERSION = "', 1)[1].split('"', 1)[0]
    print(f"✅ Gate9 PASS：core-bundle.js 與 core/redcf 同步（bundle {ver}）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
