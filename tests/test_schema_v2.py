# -*- coding: utf-8 -*-
"""
tests/test_schema_v2.py — schema v2.0「完整可重算」驗收（M2-A）
================================================================
黃金判準（SCHEMA_STRATEGY §2）：load(v2 檔) → recompute(engine) → 與檔內 result 逐欄位相等。
另驗：v2 範例通過 project_schema_v2.json；v1.1 範例可鏈式遷移到 2.0 形狀。
"""
import glob
import json
import pathlib

import pytest

根 = pathlib.Path(__file__).resolve().parents[1]
V2_DIR = 根 / "schemas" / "examples" / "v2"
V2_FILES = sorted(glob.glob(str(V2_DIR / "*.json")))


def _load(p):
    return json.load(open(p, encoding="utf-8"))


@pytest.mark.parametrize("path", V2_FILES, ids=[pathlib.Path(p).stem for p in V2_FILES])
def test_v2_可重算_逐欄位相等(path):
    """核心：從 engine 重算，與檔內 result 逐欄位相符（＝合約真正可回放）。"""
    from core.redcf.recompute import verify
    doc = _load(path)
    ok, diffs = verify(doc)
    assert ok, f"{pathlib.Path(path).name} 重算與存檔 result 不符：{diffs}"


@pytest.mark.parametrize("path", V2_FILES, ids=[pathlib.Path(p).stem for p in V2_FILES])
def test_v2_通過schema(path):
    """依 doc 的 schema_version 選對應權威檔（2.0 → v2、2.1 → v2_1）驗證。"""
    jsonschema = pytest.importorskip("jsonschema")
    doc = _load(path)
    檔名 = "project_schema_v2_1.json" if doc["schema_version"] == "2.1" else "project_schema_v2.json"
    jsonschema.validate(doc, _load(根 / "schemas" / 檔名))


@pytest.mark.parametrize("path", V2_FILES, ids=[pathlib.Path(p).stem for p in V2_FILES])
def test_v2_provenance_input_hash穩定(path):
    """input_hash 應可由 engine 重算得到同值（溯源指紋穩定）。"""
    from core.redcf.recompute import input_hash
    doc = _load(path)
    assert doc["provenance"]["input_hash"] == input_hash(doc["engine"])


def test_v1_1_遷移到最新():
    """v1.1 範例 → migrate → 最新（2.1）形狀；缺 floors 故 input_complete=false、不可回放。"""
    from core.redcf.migrations import migrate
    v1 = _load(根 / "schemas" / "examples" / "合成案例C_防災都更_容積超出.json")
    assert v1["schema_version"] == "1.1"
    v2 = migrate(v1)
    assert v2["schema_version"] == "2.1"
    assert v2["input"]["input_complete"] is False
    assert v2["input"]["site"]["far"] == v1["land"]["far"]      # 輸入有搬對
    assert v2["result"] == v1["result"]                          # result 原樣保留
    assert v2["provenance"]["input_hash"].startswith("sha256:")


def test_遷移具冪等性():
    """任何 v2 檔 migrate 後皆為最新（2.1）；已是 2.1 者原樣回傳。"""
    from core.redcf.migrations import migrate
    for p in V2_FILES:
        assert migrate(_load(p))["schema_version"] == "2.1"
