# -*- coding: utf-8 -*-
"""tests/test_valuation.py — B 系列更新前價值係數矩陣（黃金測試）。
係數讀 apps/web/coefficients.json；本測試鎖住公式、決定性、權值守恆與核准紅線標示。"""
import json
import pathlib
import pytest
from core.redcf.valuation import (load_coefficients, calc_戶價值,
                                   build_owner_matrix, COEFF_PATH)

C = load_coefficients()


def test_係數檔_核准標示存在_不得移除():
    assert C.get("_note"), "coefficients.json 必須有 _note（核准紅線）"
    assert "非估價值" in C["_note"] and "估價師" in C["_note"], "標示須含『非估價值／估價師』語意"


def test_係數檔缺標示_load即報錯(tmp_path):
    bad = tmp_path / "c.json"
    bad.write_text(json.dumps({"road_width": []}), encoding="utf-8")
    with pytest.raises(ValueError):
        load_coefficients(bad)


def test_基準戶價值_全基準係數():
    # 8–15m(1.0) × 住三(1.0) × 無電梯公寓(1.0) × 3F↑住宅(1.0) × 30坪 × 60 = 1800
    戶 = {"road": "8–15m", "zoning": "住三", "building": "無電梯公寓",
          "floor": "3F↑住宅", "area_坪": 30, "base_單價": 60}
    assert calc_戶價值(戶, C) == 1800.0


def test_一樓店面溢價_第四維度樓層():
    """核准新增的樓層係數：1F 店面（3.0×）必須把店面戶價值拉高，否則會被低估。"""
    base = {"road": "8–15m", "zoning": "住三", "building": "無電梯公寓", "area_坪": 30, "base_單價": 60}
    住宅 = calc_戶價值({**base, "floor": "3F↑住宅"}, C)
    店面 = calc_戶價值({**base, "floor": "1F店面"}, C)
    assert 店面 == pytest.approx(住宅 * 3.0), "1F 店面應為住宅樓層的 3 倍（樓層係數）"


def test_矩陣決定性_同seed同結果():
    a = build_owner_matrix(48, seed=7)
    b = build_owner_matrix(48, seed=7)
    assert a == b, "同 (n, seed) 必須產生完全相同矩陣（決定性）"
    c = build_owner_matrix(48, seed=8)
    assert a != c, "不同 seed 應產生不同矩陣"


def test_矩陣權值守恆():
    for n in (12, 24, 48, 80):
        m = build_owner_matrix(n, seed=3)
        assert len(m) == n
        s = sum(x["weight"] for x in m)
        assert s == pytest.approx(1.0, abs=1e-3), f"n={n} 權值總和須≈1，得 {s}"
        assert all(0 < x["weight"] < 1 for x in m)
        assert all(x["pre_value"] > 0 for x in m)


def test_矩陣戶數界限_12到80():
    with pytest.raises(ValueError):
        build_owner_matrix(11)
    with pytest.raises(ValueError):
        build_owner_matrix(81)
    assert len(build_owner_matrix(12)) == 12
    assert len(build_owner_matrix(80)) == 80


def test_係數檔位置_在apps_web供沙盤同源讀取():
    assert COEFF_PATH.name == "coefficients.json"
    assert COEFF_PATH.parent.name == "web", "係數檔須置 apps/web（Pages 根，沙盤同源 fetch）"


def test_矩陣_Python與沙盤JS位元對齊():
    """跨語言 parity：沙盤 SIMCORE.buildOwnerMatrix 必須與 Python build_owner_matrix
    在同 (n, seed, base) 下產生相同矩陣（決定性 LCG 位元對齊）。無 node 則略過。"""
    import re
    import shutil
    import subprocess
    if not shutil.which("node"):
        pytest.skip("node 不存在，略過跨語言 parity")
    root = pathlib.Path(__file__).resolve().parents[1]
    html = (root / "apps" / "web" / "os-simulator.html").read_text(encoding="utf-8")
    sim = re.search(r"/\*SIMCORE-BEGIN\*/([\s\S]*?)/\*SIMCORE-END\*/", html).group(1)
    js = sim + ("\nconst coeff=" + json.dumps(C, ensure_ascii=False) + ";"
                "\nconsole.log(JSON.stringify(SIMCORE.buildOwnerMatrix(24,7,60,coeff)"
                ".map(x=>[x.pre_value,x.weight])));")
    out = subprocess.run(["node", "-e", js], capture_output=True, text=True, timeout=30)
    assert out.returncode == 0, out.stderr
    js_rows = json.loads(out.stdout.strip())
    py = build_owner_matrix(24, seed=7, base_單價=60)
    assert len(js_rows) == len(py) == 24
    for (jpv, jw), p in zip(js_rows, py):
        assert abs(jpv - p["pre_value"]) < 0.01, f"pre_value 分歧 {jpv} vs {p['pre_value']}"
        assert abs(jw - p["weight"]) < 1e-5, f"weight 分歧 {jw} vs {p['weight']}"
