#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""CI Gate 2 — Core 零 UI 依賴驗證。

在 sys.meta_path 裝一個「封鎖器」，讓 streamlit / plotly 一被 import 就炸；
然後 import core.redcf 並跑一筆真實計算。若 core 偷偷相依 UI 套件，這裡會 CI Fail。
（對比：test_golden.py 是「stub 掉」UI 套件讓測試能跑；本檔是「封鎖」以證明根本不需要。）
"""
import sys
import pathlib
import importlib.abc
import importlib.machinery

# 本檔在 tools/ 底下，python 只會把 tools/ 加進 sys.path；補上 repo 根目錄（core/ 所在）
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

封鎖名單 = ("streamlit", "plotly")


class _UI封鎖器(importlib.abc.MetaPathFinder):
    def find_spec(self, 名稱, path, target=None):
        頂層 = 名稱.split(".")[0]
        if 頂層 in 封鎖名單:
            raise ImportError(f"[Gate2] Core 不得依賴 UI 套件，卻嘗試 import {名稱!r}")
        return None  # 其餘交給後續 finder


def main() -> int:
    sys.meta_path.insert(0, _UI封鎖器())
    try:
        import core.redcf as redcf  # noqa: E402
        # 跑一筆最小計算，證明計算路徑上沒有任何 UI import
        import json
        _min = pathlib.Path(__file__).resolve().parents[1] / "schemas/examples/min_input.json"
        案 = json.load(open(_min, encoding="utf-8"))
        P, 樓層 = 案["參數"], 案["樓層"]
        容 = redcf.calc_容積查核(P, 樓層)
        assert 容["允建容積"] > 0, "計算結果異常"
        print(f"✅ Gate2 PASS：import core.redcf 成功（CORE_VERSION={redcf.CORE_VERSION}），"
              f"零 UI 依賴，允建容積={容['允建容積']}")
        return 0
    except ImportError as e:
        print(f"❌ Gate2 FAIL：{e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
