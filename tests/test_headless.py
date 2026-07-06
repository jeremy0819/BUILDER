# -*- coding: utf-8 -*-
"""Headless 測試實體化（M1 Task 2）。

Architecture Freeze Review 指出「Headless 測試法只存在於文件、沒有真正腳本」。
本檔把 README 宣稱的驗收流程變成 pytest 可執行的斷言：
  1. Core 可 import（零 UI 依賴由 tools/check_core_isolation.py 另行把關）
  2. 範例 JSON 可被 Core 計算
  3. Core 輸出通過 schemas/project_schema.json（jsonschema）
  4. 黃金值抽查（與 test_golden.py 互補，這裡只鎖 min_input 的關鍵數字）

注意：這不是新增公式或功能，只是讓既有計算路徑「可被自動驗證」。
"""
import json
import pathlib
import pytest

根 = pathlib.Path(__file__).resolve().parents[1]


def _算min():
    import core.redcf as redcf
    案 = json.load(open(根 / "schemas/examples/min_input.json", encoding="utf-8"))
    P, 樓層 = 案["參數"], 案["樓層"]
    容 = redcf.calc_容積查核(P, 樓層)
    坪 = redcf.calc_坪效(容["允建容積"], 容["陽台免計面積"], P["公設比"])
    proj = redcf.build_project_json(P, 容, 坪, 案件類型=P["案件類型"])
    return redcf, proj, 容


def test_core_可import():
    import core.redcf as redcf
    assert isinstance(redcf.CORE_VERSION, str) and redcf.CORE_VERSION


def test_範例JSON可計算():
    _, proj, 容 = _算min()
    assert 容["允建容積"] > 0
    assert proj["result"]["allow_floor_area"] > 0


def test_輸出通過schema():
    jsonschema = pytest.importorskip("jsonschema")
    _, proj, _ = _算min()
    schema = json.load(open(根 / "schemas/project_schema.json", encoding="utf-8"))
    jsonschema.validate(proj, schema)  # 不符即拋例外＝測試失敗


def test_黃金抽查_min_input():
    # min_input.json 的決定性輸出（純迴歸鎖；改壞公式會抓到）
    _, proj, 容 = _算min()
    assert 容["允建容積"] == pytest.approx(2925.0, abs=0.5)
    assert proj["result"]["saleable_area"] == pytest.approx(1461.5, abs=0.5)
