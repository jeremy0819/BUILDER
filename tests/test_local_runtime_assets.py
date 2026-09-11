"""Runtime artifact integrity, without network access or WebAssembly emulation."""
import hashlib
import importlib.util
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("prepare_pyodide", ROOT / "tools/prepare_pyodide.py")
runtime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)


def test_pinned_manifest_includes_validator_and_license():
    lock = json.loads(runtime.LOCK.read_text(encoding="utf-8"))
    assert lock["version"] == "0.26.4"
    names = {a["file"] for a in lock["assets"]}
    assert set(runtime.CORE) | {"LICENSE"} <= names
    assert any(name.startswith("jsonschema-") for name in names)
    assert any(name.startswith("referencing-") for name in names)
    assert any(name.startswith("rpds_py-") for name in names)
    assert all(len(a["sha256"]) == 64 and a["bytes"] > 0 for a in lock["assets"])


def fixture_lock(tmp_path, monkeypatch):
    data = b"synthetic verified runtime"
    lock = tmp_path / "lock.json"
    lock.write_text(json.dumps({"version": runtime.VERSION, "assets": [
        {"file": "pyodide.js", "url": runtime.BASE + "pyodide.js", "bytes": len(data),
         "sha256": hashlib.sha256(data).hexdigest()}]}), encoding="utf-8")
    monkeypatch.setattr(runtime, "LOCK", lock)
    return data


def test_bad_download_never_written(tmp_path, monkeypatch):
    fixture_lock(tmp_path, monkeypatch)
    monkeypatch.setattr(runtime, "download", lambda url: b"corrupted")
    with pytest.raises(ValueError, match="Integrity"):
        runtime.prepare(tmp_path / "runtime")
    assert not (tmp_path / "runtime/pyodide.js").exists()


def test_verified_cached_artifact_needs_no_network(tmp_path, monkeypatch):
    data = fixture_lock(tmp_path, monkeypatch)
    output = tmp_path / "runtime"
    output.mkdir()
    (output / "pyodide.js").write_bytes(data)
    def forbidden(url):
        raise AssertionError("Cached runtime must not access network")
    monkeypatch.setattr(runtime, "download", forbidden)
    runtime.prepare(output)
