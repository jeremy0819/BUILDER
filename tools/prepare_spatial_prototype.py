"""Fetch a pinned, integrity-checked Three.js subset into ignored local artifacts."""
import base64
import argparse
import hashlib
import io
import json
import tarfile
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOCK = ROOT / "tools/spatial-prototype/three.lock.json"
DEST = ROOT / "tools/browser/artifacts/spatial-vendor"


def prepare():
    lock = json.loads(LOCK.read_text(encoding="utf-8"))
    with urllib.request.urlopen(lock["url"], timeout=60) as response:
        data = response.read(lock["max_archive_bytes"] + 1)
    if len(data) > lock["max_archive_bytes"]:
        raise ValueError("Archive exceeds prototype budget")
    actual = "sha512-" + base64.b64encode(hashlib.sha512(data).digest()).decode()
    if actual != lock["integrity"]:
        raise ValueError("Three.js integrity mismatch")
    selected = {}
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as archive:
        for source, name in lock["files"].items():
            if Path(name).name != name:
                raise ValueError("Invalid destination name")
            member = archive.getmember(source)
            if not member.isfile() or member.size > lock["max_extracted_bytes"]:
                raise ValueError("Invalid package member")
            selected[name] = archive.extractfile(member).read()
    if sum(map(len, selected.values())) > lock["max_extracted_bytes"]:
        raise ValueError("Runtime exceeds prototype budget")
    for name, content in selected.items():
        if hashlib.sha256(content).hexdigest() != lock["sha256"][name]:
            raise ValueError("Extracted file integrity mismatch")
    DEST.mkdir(parents=True, exist_ok=True)
    for name, content in selected.items():
        (DEST / name).write_bytes(content)
    print(json.dumps({"version": lock["version"], "bytes": sum(map(len, selected.values())),
                      "sha256": {k: hashlib.sha256(v).hexdigest() for k, v in selected.items()}}, indent=2))


def check():
    lock = json.loads(LOCK.read_text(encoding="utf-8"))
    total = 0
    for name, expected in lock["sha256"].items():
        data = (DEST / name).read_bytes()
        if hashlib.sha256(data).hexdigest() != expected:
            raise ValueError("Local Three.js integrity mismatch: " + name)
        total += len(data)
    if total > lock["max_extracted_bytes"]:
        raise ValueError("Runtime exceeds prototype budget")
    print(f"Three.js {lock['version']}: {total} bytes, local integrity PASS")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    check() if args.check else prepare()
