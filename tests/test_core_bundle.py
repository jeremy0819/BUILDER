# -*- coding: utf-8 -*-
"""tests/test_core_bundle.py — M5.5 B 軌：瀏覽器端 Core＝伺服器端 Core（同一 SSOT）。
把 core-bundle.js 還原成 Pyodide 會用的目錄樹，在封鎖 pandas/jsonschema 的乾淨子行程
（＝Pyodide 的執行條件）import core.redcf 並 recompute，斷言與直接呼叫逐欄一致。
＋Gate 9 同步守衛的 pytest 版。"""
import json
import re
import subprocess
import sys
import pathlib

根 = pathlib.Path(__file__).resolve().parents[1]
BUNDLE = 根 / "apps" / "web" / "core-bundle.js"


def _載入bundle_files():
    js = BUNDLE.read_text(encoding="utf-8")
    m = re.search(r"self\.CORE_FILES = (\{.*\});\s*$", js, re.S)
    assert m, "core-bundle.js 格式異常"
    return json.loads(m.group(1))


def test_bundle_與原始碼同步():
    sys.path.insert(0, str(根 / "tools"))
    import build_core_bundle as B
    assert BUNDLE.read_text(encoding="utf-8") == B.建置(), \
        "core-bundle.js 過期——請跑 python tools/build_core_bundle.py"


def test_bundle_含計算主線_不含pandas模組():
    files = _載入bundle_files()
    for need in ["core/redcf/__init__.py", "core/redcf/recompute.py", "core/redcf/allocation.py",
                 "core/redcf/decision.py", "core/redcf/stage_tree.json", "apps/web/coefficients.json"]:
        assert need in files, f"bundle 缺 {need}"
    assert "core/redcf/io.py" not in files and "core/redcf/templates.py" not in files, \
        "bundle 不應含 pandas 相依模組（io/templates）"


def test_瀏覽器條件下_bundle_Core_與伺服器一致(tmp_path):
    files = _載入bundle_files()
    for rel, content in files.items():
        p = tmp_path / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")
    eng = json.loads((根 / "schemas/examples/v2/v2_1_案例D_權變示範.json").read_text())["engine"]
    # 乾淨子行程：只有 bundle 樹在 path，且封鎖 pandas/jsonschema/referencing＝Pyodide 條件
    code = (
        "import sys, json\n"
        f"sys.path.insert(0, {str(tmp_path)!r})\n"
        "sys.modules['pandas']=None; sys.modules['jsonschema']=None; sys.modules['referencing']=None\n"
        "import core.redcf as r\n"
        f"eng=json.loads({json.dumps(json.dumps(eng, ensure_ascii=False))})\n"
        "out=r.recompute(eng)\n"
        "print(json.dumps({'scr':out['shared_cost_ratio'],'rr':out['return_rate'],"
        "'eff':out['efficiency_ratio'],'n':len(out.get('owner_allocations',[])),'h':r.input_hash(eng)}))\n"
    )
    res = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True, cwd=str(tmp_path))
    assert res.returncode == 0, res.stderr[-800:]
    got = json.loads(res.stdout.strip().splitlines()[-1])

    # 伺服器端（完整環境）直接算
    from core.redcf import recompute, input_hash
    ref = recompute(eng)
    assert abs(got["scr"] - ref["shared_cost_ratio"]) < 1e-9
    assert abs(got["rr"] - ref["return_rate"]) < 1e-9
    assert abs(got["eff"] - ref["efficiency_ratio"]) < 1e-9
    assert got["n"] == len(ref.get("owner_allocations", [])) == 48
    assert got["h"] == input_hash(eng)          # 溯源指紋一致
