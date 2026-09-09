# -*- coding: utf-8 -*-
"""tests/test_core_bundle.py — M5.5 B 軌：瀏覽器端 Core＝伺服器端 Core（同一 SSOT）。
還原 bundle，在無 pandas、具備 jsonschema 及相依套件的子行程驗證四條運算路徑。
缺少驗證器另列為負向故障測試，不能再把 recompute 單獨可跑稱為完整瀏覽器條件。
此為 Python 相依隔離測試；真正 Pyodide/WASM 由 Gate 19 的瀏覽器測試負責。
＋Gate 9 同步守衛的 pytest 版。"""
import json
import re
import subprocess
import sys
import pathlib
import pytest

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


@pytest.fixture
def bundle_tree(tmp_path):
    files = _載入bundle_files()
    for rel, content in files.items():
        p = tmp_path / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")
    return tmp_path


def test_瀏覽器條件下_bundle_Core_與伺服器一致(bundle_tree):
    tmp_path = bundle_tree
    eng = json.loads((根 / "schemas/examples/v2/v2_1_案例D_權變示範.json").read_text(encoding="utf-8"))["engine"]
    # Bundle-first import path, no pandas, with the validator dependency loaded by Worker.
    code = (
        "import sys, json\n"
        f"sys.path.insert(0, {str(tmp_path)!r})\n"
        "sys.modules['pandas']=None\n"
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


def _full_pipeline(engine):
    from core.redcf import (recompute, input_hash, decide, strategize,
                            calc_選配映射, validate_decision,
                            validate_strategy, validate_household_outcome)
    result = recompute(engine)
    fingerprint = input_hash(engine)
    workflow = {"stage": "S2", "input_hash": fingerprint,
                "consent": {"agreed": 1, "total": 2, "threshold": 0.8},
                "stakeholders": [{"stakeholder_id": "W01", "role": "owner", "land_share": 0.5}]}
    decision = decide(result, workflow, {})
    strategy = strategize(decision, workflow, [
        {"household_id": "W01", "classification_source": "recorded", "willingness_type": "anchored"}])
    product = {"每坪均價": 74.0, "公設比": 0.34, "車位數": 2,
               "坪型組合": [{"id": "A", "area_坪": 25, "count": 10}]}
    allocation = calc_選配映射(result["owner_allocations"], product, fingerprint)
    assert validate_decision(decision)[0]
    assert validate_strategy(strategy)[0]
    assert validate_household_outcome(allocation)[0]
    return {"decision": decision, "strategy": strategy, "allocation": allocation}


def test_bundle_完整驗證器條件下三種推論與伺服器一致(bundle_tree):
    import inspect
    engine = json.loads((根 / "schemas/examples/v2/v2_1_案例D_權變示範.json").read_text(encoding="utf-8"))["engine"]
    code = ("import sys,json\n"
            f"sys.path.insert(0, {str(bundle_tree)!r})\n"
            "sys.modules['pandas']=None\n"
            "import jsonschema, referencing\n"
            + inspect.getsource(_full_pipeline)
            + "\nprint(json.dumps(_full_pipeline(json.load(sys.stdin))))\n")
    completed = subprocess.run([sys.executable, "-c", code], input=json.dumps(engine),
                               capture_output=True, text=True, encoding="utf-8", cwd=bundle_tree)
    assert completed.returncode == 0, completed.stderr
    output = json.loads(completed.stdout)
    assert output == _full_pipeline(engine)
    assert len(output["allocation"]) == 48


@pytest.mark.parametrize("operation", ["decide", "strategize", "allocate"])
def test_bundle_缺驗證器必須拒絕而非假成功(bundle_tree, operation):
    calls = {
        "decide": "r.decide(result, workflow, {})",
        "strategize": "r.strategize({'input_hash': h}, workflow, [])",
        "allocate": "r.calc_選配映射(result['owner_allocations'], {'每坪均價':74,'公設比':0.34}, h)",
    }
    engine = json.loads((根 / "schemas/examples/v2/v2_1_案例D_權變示範.json").read_text(encoding="utf-8"))["engine"]
    code = ("import sys,json\n"
            f"sys.path.insert(0, {str(bundle_tree)!r})\n"
            "sys.modules['pandas']=None;sys.modules['jsonschema']=None;sys.modules['referencing']=None\n"
            "import core.redcf as r\n"
            "engine=json.load(sys.stdin);result=r.recompute(engine);h=r.input_hash(engine)\n"
            "workflow={'stage':'S2','input_hash':h,'consent':{'agreed':1,'total':2,'threshold':0.8}}\n"
            "try:\n"
            f"    {calls[operation]}\n"
            "except ValueError as exc:\n"
            "    assert 'jsonschema' in str(exc), str(exc)\n"
            "else:\n"
            "    raise AssertionError('missing validator was silently accepted')\n")
    completed = subprocess.run([sys.executable, "-c", code], input=json.dumps(engine),
                               capture_output=True, text=True, encoding="utf-8", cwd=bundle_tree)
    assert completed.returncode == 0, completed.stderr
