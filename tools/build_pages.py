"""Assemble public Pages files; dependencies remain artifacts, never repo blobs."""
import argparse
import json
import shutil
import subprocess
from pathlib import Path

from prepare_spatial_prototype import check, DEST

ROOT = Path(__file__).resolve().parents[1]
LAB_FILES = ("lab.css", "lab.mjs", "fixture.mjs", "core-fixture.json")
VENDOR_FILES = ("three.module.min.js", "three.core.min.js", "OrbitControls.js", "LICENSE")


def build(output):
    output = Path(output).resolve()
    if output.exists():
        raise ValueError("Use a new output directory; existing artifacts are never overwritten")
    check()
    web = ROOT / "apps/web"
    if output.is_relative_to(web.resolve()):
        raise ValueError("Output cannot be inside public source")
    for path in web.rglob("*"):
        if path.is_symlink():
            raise ValueError("Symlink in public web source")
    shutil.copytree(web, output)
    lab = ROOT / "tools/spatial-prototype"
    dest = output / "spatial-prototype"
    (dest / "vendor").mkdir(parents=True)
    shutil.copyfile(lab / "index.html", output / "spatial-prototype.html")
    for name in LAB_FILES:
        shutil.copyfile(lab / name, dest / name)
    for name in VENDOR_FILES:
        shutil.copyfile(DEST / name, dest / "vendor" / name)
    sha = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    (output / "build-info.json").write_text(json.dumps({"commit": sha, "spatial_prototype": "synthetic-only"}), encoding="utf-8")
    size = sum(p.stat().st_size for p in output.rglob("*") if p.is_file())
    print(json.dumps({"output": str(output), "commit": sha, "bytes": size}))
    return output


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    build(parser.parse_args().output)
