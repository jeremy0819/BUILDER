"""Lab installer and HTTP boundary tests; no network or downloaded dependencies."""
import base64
import hashlib
import importlib.util
import io
import json
import sys
import tarfile
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture
def installer(monkeypatch, tmp_path):
    spec = importlib.util.spec_from_file_location("spatial_installer_test", ROOT / "tools/prepare_spatial_prototype.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    lock = {"url": "https://example.invalid/package", "version": "test", "files": {"package/safe.js": "safe.js"},
            "sha256": {"safe.js": hashlib.sha256(b"safe").hexdigest()}, "max_archive_bytes": 4096,
            "max_extracted_bytes": 256}
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode="w:gz") as archive:
        info = tarfile.TarInfo("package/safe.js")
        info.size = 4
        archive.addfile(info, io.BytesIO(b"safe"))
        ignored = tarfile.TarInfo("../../escape.js")
        ignored.size = 4
        archive.addfile(ignored, io.BytesIO(b"evil"))
    data = buffer.getvalue()
    lock["integrity"] = "sha512-" + base64.b64encode(hashlib.sha512(data).digest()).decode()
    path = tmp_path / "lock.json"
    monkeypatch.setattr(module, "LOCK", path)
    monkeypatch.setattr(module, "DEST", tmp_path / "vendor")
    monkeypatch.setattr(module.urllib.request, "urlopen", lambda *a, **k: io.BytesIO(data))

    def configure(**kwargs):
        lock.update(kwargs)
        path.write_text(json.dumps(lock), encoding="utf-8")
    configure()
    return module, configure


def test_installer_selects_only_allowlisted_members(installer):
    module, _ = installer
    module.prepare()
    assert [p.name for p in module.DEST.iterdir()] == ["safe.js"]
    module.check()


@pytest.mark.parametrize("override", [
    {"integrity": "sha512-invalid"}, {"max_archive_bytes": 4},
    {"max_extracted_bytes": 3}, {"files": {"package/safe.js": "../escape.js"}},
    {"sha256": {"safe.js": "invalid"}},
])
def test_installer_rejects_before_write(installer, override):
    module, configure = installer
    configure(**override)
    with pytest.raises(ValueError):
        module.prepare()
    assert not module.DEST.exists()


def test_installer_detects_local_tampering(installer):
    module, _ = installer
    module.prepare()
    (module.DEST / "safe.js").write_bytes(b"modified")
    with pytest.raises(ValueError, match="integrity"):
        module.check()


def test_lab_routes_cannot_escape(monkeypatch):
    monkeypatch.syspath_prepend(str(ROOT / "tools"))
    import serve_spatial_prototype as server
    handler = object.__new__(server.Handler)
    assert Path(handler.translate_path("/")) == server.LAB / "index.html"
    for path in ("/prototype/../../LICENSE", "/vendor/%2e%2e/%2e%2e/LICENSE", "/prototype/"):
        assert Path(handler.translate_path(path)) == server.LAB / "__missing__"
    assert handler.translate_path("/core-runtime.worker.js") == str(server.WEB / "core-runtime.worker.js")
