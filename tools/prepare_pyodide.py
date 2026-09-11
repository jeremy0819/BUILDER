"""Prepare a verified, same-origin runtime artifact; never changes Pages configuration.

Normal: python tools/prepare_pyodide.py [--output DIR]
Maintainer-only lock refresh: --update-lock (review the generated digest changes).
Runtime packages retain their embedded license files. Pyodide's license is included.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
VERSION = "0.26.4"
BASE = f"https://cdn.jsdelivr.net/pyodide/v{VERSION}/full/"
LOCK = ROOT / "tools/pyodide-assets.lock.json"
CORE = ["pyodide.js", "pyodide.asm.js", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"]
LICENSE = f"https://raw.githubusercontent.com/pyodide/pyodide/{VERSION}/LICENSE"


def download(url):
    with urllib.request.urlopen(url, timeout=90) as response:
        data = response.read(32 * 1024 * 1024 + 1)
    if len(data) > 32 * 1024 * 1024:
        raise ValueError("Unexpected oversized runtime asset")
    return data


def digest(data):
    return hashlib.sha256(data).hexdigest()


def prepare(output, update=False):
    output.mkdir(parents=True, exist_ok=True)
    if update:
        package_lock = download(BASE + "pyodide-lock.json")
        packages = json.loads(package_lock)["packages"]
        required = set()
        def include(name):
            name = re.sub(r"[-_.]+", "-", name).lower()
            if name in required:
                return
            required.add(name)
            for dep in packages[name]["depends"]:
                include(dep)
        include("jsonschema")
        items = [{"file": name, "url": BASE + name} for name in CORE]
        items += [{"file": packages[name]["file_name"], "url": BASE + packages[name]["file_name"],
                   "sha256": packages[name]["sha256"]} for name in sorted(required)]
        items += [{"file": "LICENSE", "url": LICENSE}]
    else:
        lock = json.loads(LOCK.read_text(encoding="utf-8"))
        if lock["version"] != VERSION:
            raise ValueError("Pyodide version mismatch")
        items = lock["assets"]
    for item in items:
        name = item["file"]
        if Path(name).name != name or not (item["url"].startswith(BASE) or item["url"] == LICENSE):
            raise ValueError("Unexpected runtime asset path or host")
        target = output / name
        expected = item.get("sha256")
        data = target.read_bytes() if target.exists() and expected and digest(target.read_bytes()) == expected else download(item["url"])
        actual = digest(data)
        if expected and expected != actual:
            raise ValueError(f"Integrity check failed: {name}")
        item["sha256"], item["bytes"] = actual, len(data)
        target.write_bytes(data)
        print(f"VERIFIED {name}: {len(data)} bytes")
    if update:
        LOCK.write_text(json.dumps({"version": VERSION, "assets": items}, indent=2) + "\n", encoding="utf-8")
    print(f"READY: {sum(item['bytes'] for item in items)} bytes at {output}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=ROOT / f"tools/browser/artifacts/runtime/pyodide-{VERSION}")
    parser.add_argument("--update-lock", action="store_true")
    args = parser.parse_args()
    prepare(args.output.resolve(), args.update_lock)
