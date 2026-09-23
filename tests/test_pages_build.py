"""Pages assembly is allowlisted and never brings private workspaces into artifacts."""
import base64
import hashlib
import json
from html.parser import HTMLParser
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


def test_import_map_matches_pages_csp():
    class Parser(HTMLParser):
        def __init__(self):
            super().__init__()
            self.active = False
            self.mapping = ""
            self.csp = ""

        def handle_starttag(self, tag, attrs):
            attrs = dict(attrs)
            if tag == "script" and attrs.get("type") == "importmap":
                self.active = True
            if tag == "meta" and attrs.get("http-equiv") == "Content-Security-Policy":
                self.csp = attrs["content"]

        def handle_endtag(self, tag):
            if tag == "script":
                self.active = False

        def handle_data(self, data):
            if self.active:
                self.mapping += data
    parser = Parser()
    parser.feed((ROOT / "tools/spatial-prototype/index.html").read_text(encoding="utf-8"))
    digest = base64.b64encode(hashlib.sha256(parser.mapping.encode()).digest()).decode()
    assert "'sha256-" + digest + "'" in parser.csp
    assert json.loads(parser.mapping)["imports"]["three"].startswith("./")
    assert "connect-src 'self'" in parser.csp


def test_pages_assembly_and_overwrite_guard(tmp_path, monkeypatch):
    monkeypatch.syspath_prepend(str(ROOT / "tools"))
    import build_pages as builder
    monkeypatch.setattr(builder, "ROOT", tmp_path)
    monkeypatch.setattr(builder, "DEST", tmp_path / "vendor")
    monkeypatch.setattr(builder, "check", lambda: None)
    monkeypatch.setattr(builder.subprocess, "check_output", lambda *a, **k: "a" * 40)
    web = tmp_path / "apps/web"
    web.mkdir(parents=True)
    (web / "index.html").write_text("production", encoding="utf-8")
    lab = tmp_path / "tools/spatial-prototype"
    lab.mkdir(parents=True)
    for name in (*builder.LAB_FILES, "index.html", "private.txt"):
        (lab / name).write_text(name, encoding="utf-8")
    builder.DEST.mkdir()
    for name in builder.VENDOR_FILES:
        (builder.DEST / name).write_text(name, encoding="utf-8")
    output = builder.build(tmp_path / "output")
    assert (output / "index.html").read_text() == "production"
    assert (output / "spatial-prototype.html").is_file()
    assert not (output / "spatial-prototype/private.txt").exists()
    assert json.loads((output / "build-info.json").read_text())["commit"] == "a" * 40
    with pytest.raises(ValueError, match="never overwritten"):
        builder.build(output)
    with pytest.raises(ValueError, match="inside public source"):
        builder.build(web / "nested")
