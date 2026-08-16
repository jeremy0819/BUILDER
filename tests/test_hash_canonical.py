# -*- coding: utf-8 -*-
"""tests/test_hash_canonical.py — `input_hash` 數值正規化驗收（CORE_VERSION 0.6.0）

憲章＝docs/architecture/DECISION-input_hash_canonicalization.md（方案 A）。

問題：`input_hash` 原本雜湊的是 **Python 的型別表示**而非**數值**——
`65.0` 與 `65` 產生不同雜湊。JavaScript 沒有 int／float 之分，故任何 engine
一經瀏覽器往返，整數值浮點即塌陷為整數，雜湊必然改變。M5.5 B1 起
「同一份 Core 在瀏覽器內執行」是既定架構，溯源鍵就必須跨邊界穩定。

本檔覆蓋使用者核定的八項驗收。
"""
import copy
import json
import pathlib

import pytest

from core.redcf import input_hash, CORE_VERSION
from core.redcf.recompute import _canonical_number

根 = pathlib.Path(__file__).resolve().parents[1]


def _engine(**params):
    base = {"住宅單價": 65.0, "車位數": 78, "獎勵率": 0.5}
    base.update(params)
    return {"params": base, "floors": [{"樓板": 1300.0}],
            "case_type": "危老", "mode": "合建"}


# ── ① 65 == 65.0 ────────────────────────────────────────────────

def test_整數值浮點與整數同雜湊():
    assert input_hash(_engine(住宅單價=65.0)) == input_hash(_engine(住宅單價=65))


def test_非整數值浮點不受影響():
    """0.5 不是整數值，必須原樣保留——正規化只收整數值浮點，不做精度裁切。"""
    assert _canonical_number(0.5) == 0.5
    assert input_hash(_engine(獎勵率=0.5)) != input_hash(_engine(獎勵率=0.50001))


def test_不同數值仍產生不同雜湊():
    """正規化不得把不同的數字混為一談。"""
    assert input_hash(_engine(住宅單價=65)) != input_hash(_engine(住宅單價=66))


# ── ② 巢狀 dict／list 正規化 ────────────────────────────────────

def test_巢狀dict正規化():
    a = _engine(); a["params"]["財務覆寫"] = {"管理費率": 6.0, "深": {"層": 3.0}}
    b = _engine(); b["params"]["財務覆寫"] = {"管理費率": 6, "深": {"層": 3}}
    assert input_hash(a) == input_hash(b)


def test_巢狀list正規化():
    a = _engine(); a["floors"] = [{"樓板": 1300.0}, {"樓板": 500.0}]
    b = _engine(); b["floors"] = [{"樓板": 1300}, {"樓板": 500}]
    assert input_hash(a) == input_hash(b)


def test_list中的純數值也正規化():
    assert _canonical_number([1.0, 2.5, [3.0, {"a": 4.0}]]) == [1, 2.5, [3, {"a": 4}]]


def test_tuple轉為list後正規化():
    """JSON 無 tuple；轉 list 是序列化的既有行為，正規化須一致處理。"""
    assert _canonical_number((1.0, 2.0)) == [1, 2]


# ── ③ bool 不得被當成 int ★（最容易寫錯的一行）──────────────────

def test_bool不得被轉為int():
    """Python 的 isinstance(True, int) 為真——不先攔 bool 會把 True 變成 1，
    那是型別竄改，不是正規化。"""
    assert _canonical_number(True) is True
    assert _canonical_number(False) is False
    assert isinstance(_canonical_number(True), bool)


def test_bool與數值不得互相塌陷():
    a = _engine(); a["params"]["啟用"] = True
    b = _engine(); b["params"]["啟用"] = 1
    assert input_hash(a) != input_hash(b), "True 與 1 是不同的輸入，雜湊必須不同"
    c = _engine(); c["params"]["啟用"] = False
    d = _engine(); d["params"]["啟用"] = 0
    assert input_hash(c) != input_hash(d)


def test_巢狀bool同樣不被轉換():
    assert _canonical_number({"a": [True, False, 1.0]}) == {"a": [True, False, 1]}


# ── ④ -0.0 == 0 ────────────────────────────────────────────────

def test_負零與零同雜湊():
    """(-0.0).is_integer() 為真 → int(-0.0) == 0，與 JS 的 -0 行為一致。"""
    assert _canonical_number(-0.0) == 0
    assert input_hash(_engine(車位數=-0.0)) == input_hash(_engine(車位數=0))


def test_負零正規化後型別為int():
    v = _canonical_number(-0.0)
    assert isinstance(v, int) and v == 0


# ── ⑤ 非有限數值明確拒絕 ────────────────────────────────────────

@pytest.mark.parametrize("壞值", [float("nan"), float("inf"), float("-inf")])
def test_非有限數值明確拒絕(壞值):
    """NaN／±Infinity 不是合法 JSON，序列化後其他語言無法解析。
    靜默放行等於製造假溯源，故明確拋錯。"""
    with pytest.raises(ValueError, match="非有限數值"):
        input_hash(_engine(住宅單價=壞值))


def test_巢狀非有限數值亦被拒絕():
    e = _engine(); e["floors"] = [{"樓板": float("nan")}]
    with pytest.raises(ValueError, match="非有限數值"):
        input_hash(e)


# ── ⑥ Python 與 JS JSON 往返 hash 相同 ★（本次遷移的目的）────────

def _js_roundtrip(engine):
    """模擬瀏覽器路徑：JS 的 JSON.stringify 會讓整數值浮點塌陷為整數，
    再經 postMessage → Python json.loads。"""
    s = json.dumps(engine)
    # JS 端 1300.0 序列化為 1300；以字面替換模擬該塌陷
    for f in ("65.0", "1300.0", "78.0", "112.0", "500.0"):
        s = s.replace(f, f[:-2])
    return json.loads(s)


def test_JS往返後雜湊不變():
    e = _engine()
    assert input_hash(e) == input_hash(_js_roundtrip(e)), \
        "跨 Python／JS 邊界雜湊必須穩定——這是本次遷移的唯一目的"


def test_JS往返_含巢狀結構():
    e = _engine()
    e["params"]["財務覆寫"] = {"管理費率": 6.0}
    e["floors"] = [{"樓板": 1300.0}, {"樓板": 500.0}]
    assert input_hash(e) == input_hash(_js_roundtrip(e))


def test_真實範例經JS往返後雜湊不變():
    eng = json.loads((根 / "schemas/examples/v2/v2_1_案例D_權變示範.json")
                     .read_text(encoding="utf-8"))["engine"]
    rt = json.loads(json.dumps(eng))          # 完整往返（含 float→JSON→float）
    assert input_hash(eng) == input_hash(rt)


# ── ⑦ 輸入 engine 不得被正規化函式修改 ★───────────────────────

def test_正規化不改動輸入():
    e = _engine()
    e["params"]["財務覆寫"] = {"管理費率": 6.0}
    快照 = json.dumps(e, sort_keys=True, default=str)
    _canonical_number(e)
    input_hash(e)
    assert json.dumps(e, sort_keys=True, default=str) == 快照, "正規化必須回傳新結構"


def test_正規化回傳的是新物件():
    e = {"a": {"b": [1.0]}}
    out = _canonical_number(e)
    assert out is not e and out["a"] is not e["a"] and out["a"]["b"] is not e["a"]["b"]


def test_正規化後修改輸出不影響輸入():
    e = _engine()
    out = _canonical_number(e)
    out["params"]["住宅單價"] = 999
    assert e["params"]["住宅單價"] == 65.0


# ── ⑧ 舊版 Result 可讀可稽核，但不得宣稱與新版 hash 相同 ★────────

def test_舊版雜湊與新版不同_且不得被宣稱相同():
    """0.5.0 以前的雜湊未做數值正規化。舊 Result JSON 依 VERSION_POLICY §5
    保留不回填，其 provenance.input_hash 是**當時**的歷史戳記。
    本測試釘住「兩者確實不同」這個事實，避免日後有人加相容層假裝相同。"""
    import hashlib
    eng = json.loads((根 / "schemas/examples/v2/v2_1_案例D_權變示範.json")
                     .read_text(encoding="utf-8"))["engine"]
    舊式 = "sha256:" + hashlib.sha256(
        json.dumps(eng, sort_keys=True, ensure_ascii=False,
                   separators=(",", ":"), default=str).encode("utf-8")).hexdigest()
    新式 = input_hash(eng)
    assert 舊式 != 新式, "本範例含整數值浮點，新舊雜湊理應不同"


def test_舊版Result仍可讀可重算():
    """遷移不得讓舊檔變成不可讀——verify 比對的是數值欄位，不是 input_hash。"""
    from core.redcf import recompute
    doc = json.loads((根 / "schemas/examples/v2/v2_1_案例D_權變示範.json")
                     .read_text(encoding="utf-8"))
    out = recompute(doc["engine"])
    assert out["return_rate"] == pytest.approx(doc["result"]["return_rate"])
    assert out["shared_cost_ratio"] == pytest.approx(doc["result"]["shared_cost_ratio"])


def test_範例檔的provenance已更新為新式雜湊():
    """本 PR 已重新產生 5 個黃金範例的 provenance.input_hash。"""
    import glob
    n = 0
    for f in sorted(glob.glob(str(根 / "schemas/examples/**/*.json"), recursive=True)):
        doc = json.loads(pathlib.Path(f).read_text(encoding="utf-8"))
        if "engine" not in doc or "provenance" not in doc:
            continue
        stored = doc["provenance"].get("input_hash")
        if not stored:
            continue
        assert stored == input_hash(doc["engine"]), f"{f} 的 provenance 未更新"
        n += 1
    assert n >= 5, f"應涵蓋至少 5 個範例，實得 {n}"


# ── 版本治理 ────────────────────────────────────────────────────

def test_CORE_VERSION已bump為0_6_0():
    assert CORE_VERSION == "0.6.0", "溯源語意變更須 bump（VERSION_POLICY）"
