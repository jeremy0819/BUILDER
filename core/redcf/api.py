# -*- coding: utf-8 -*-
"""
core/redcf/api.py — Urban Renewal Core 對外統一介面（M2 Core Interface）
========================================================================
把散落的 recompute / verify / migrate / build_* 收斂成四個穩定動詞，讓 M3–M6
的消費端（owners UI、新模擬器、AI Copilot）只依賴這層，不必知道內部函式名。

四動詞（穩定合約，簽章往後只增不改）：
  calculate(engine)        從輸入快照重算出 result（唯一計算入口；內部＝recompute）
  validate(doc, view=…)    結構 + 可重算雙重驗證（jsonschema + verify）
  serialize(doc, path=…)   dict → 正規化 JSON 字串（可選寫檔）
  deserialize(data)        JSON 字串/路徑/dict → 正規化到最新 schema（2.1）的 dict

紅線：本模組**不含任何計算公式**——只是既有 core.redcf.* 的門面（facade）。
所有數字仍出自 recompute → build_result_json；validate 的門檻仍讀 result.warnings。
"""

import json
import pathlib

from core.redcf._version import CORE_VERSION
from core.redcf.recompute import recompute, verify, input_hash
from core.redcf.migrations import migrate

__all__ = [
    "calculate", "validate", "serialize", "deserialize",
    "input_hash", "CORE_VERSION", "SCHEMA_V2", "SCHEMA_V2_1", "SCHEMA_VIEWS",
]

_根 = pathlib.Path(__file__).resolve().parents[2]
SCHEMA_V2 = _根 / "schemas" / "project_schema_v2.json"
SCHEMA_V2_1 = _根 / "schemas" / "project_schema_v2_1.json"
SCHEMA_VIEWS = {
    "input":    _根 / "schemas" / "v2" / "input.schema.json",
    "output":   _根 / "schemas" / "v2" / "output.schema.json",
    "metadata": _根 / "schemas" / "v2" / "metadata.schema.json",
}
# doc 內三視圖各自對應的區塊 key（output＝result、metadata＝provenance）
_視圖區塊 = {"input": "input", "output": "result", "metadata": "provenance"}


# ── calculate ──────────────────────────────────────────────────────────────
def calculate(engine: dict, computed_at: str = None) -> dict:
    """從 v2 輸入快照 engine 重算出 result（英文 key 合約）。唯一計算入口。

    engine 結構見 recompute.recompute（params/floors/case_type/mode/owners）。
    回傳 build_result_json 的 result dict。不新增任何公式——委派 recompute。
    """
    return recompute(engine, computed_at)


# ── validate ─────────────────────────────────────────────────────────────
def _load(p):
    return json.load(open(p, encoding="utf-8"))


def _registry(doc: dict = None):
    """建 referencing Registry（註冊 v2.0＋v2.1 權威檔），並依 doc 的
    schema_version 選對應的整檔 canonical（2.1 → v2_1；其餘 → v2.0）。"""
    from referencing import Registry, Resource
    c20, c21 = _load(SCHEMA_V2), _load(SCHEMA_V2_1)
    reg = (Registry()
           .with_resource(c20["$id"], Resource.from_contents(c20))
           .with_resource(c21["$id"], Resource.from_contents(c21)))
    canon = c21 if (doc or {}).get("schema_version") == "2.1" else c20
    return canon, reg


def validate(doc: dict, view: str = None, recompute_check: bool = True) -> tuple:
    """結構 + 可重算雙重驗證。回傳 (ok: bool, errors: list[str])。

    view=None            驗證整份 doc（project_schema_v2.json）
    view='input'|'output'|'metadata'
                         只驗證對應子區塊（schemas/v2/*.schema.json 視圖）
    recompute_check=True 且 doc 帶 engine → 另跑 verify()，確認 result 可由輸入回放。

    需 jsonschema + referencing（requirements 已含）。缺套件時回 (False, [...])。
    """
    errors = []
    try:
        import jsonschema
    except ImportError:
        return (False, ["jsonschema 未安裝，無法驗證"])

    canon, reg = _registry(doc)
    if view is None:
        target, schema = doc, canon
    else:
        if view not in SCHEMA_VIEWS:
            return (False, [f"未知視圖 {view!r}（可用：{', '.join(SCHEMA_VIEWS)}）"])
        target = doc.get(_視圖區塊[view], doc)
        schema = _load(SCHEMA_VIEWS[view])

    v = jsonschema.Draft7Validator(schema, registry=reg)
    for e in sorted(v.iter_errors(target), key=lambda e: list(e.path)):
        路徑 = "/".join(str(x) for x in e.path) or "(root)"
        errors.append(f"[schema:{view or 'full'}] {路徑}: {e.message}")

    # 可重算驗證：帶 engine 的整份 doc 才做（子視圖不含 engine）
    if recompute_check and view is None and "engine" in doc and "result" in doc:
        ok, diffs = verify(doc)
        if not ok:
            errors.append(f"[recompute] result 無法由 engine 回放，{len(diffs)} 欄不符：{diffs}")

    return (len(errors) == 0, errors)


# ── serialize / deserialize ─────────────────────────────────────────────
def serialize(doc: dict, path=None, indent: int = 2) -> str:
    """dict → 正規化 JSON 字串（UTF-8、保留中文）。給 path 則同時寫檔。"""
    s = json.dumps(doc, ensure_ascii=False, indent=indent, sort_keys=False)
    if path is not None:
        pathlib.Path(path).write_text(s + "\n", encoding="utf-8")
    return s


def deserialize(data, to_v2: bool = True) -> dict:
    """JSON 來源（字串／檔案路徑／已解析 dict）→ dict；預設鏈式遷移到最新 schema（2.1）。

    data 可為：dict（原樣）、以 '{' 開頭的 JSON 字串、或存在的檔案路徑字串/Path。
    to_v2=True 時對舊版（1.0/1.1/2.0）自動 migrate；已是最新（2.1）原樣回傳。
    """
    if isinstance(data, dict):
        doc = data
    elif isinstance(data, (str, pathlib.Path)):
        s = str(data)
        if s.lstrip().startswith("{"):
            doc = json.loads(s)
        else:
            doc = _load(data)
    else:
        raise TypeError(f"deserialize 不支援型別 {type(data).__name__}")
    return migrate(doc) if to_v2 else doc
