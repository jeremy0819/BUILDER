"""Loopback-only preview with the separately prepared same-origin runtime artifact."""
import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "apps/web"
ARTIFACTS = ROOT / "tools/browser/artifacts"


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, ".wasm": "application/wasm"}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB), **kwargs)

    def translate_path(self, path):
        decoded = unquote(urlsplit(path).path)
        # Mirror the public build's isolated, synthetic-only viewer entry.
        if decoded == "/spatial-prototype.html":
            return str(ROOT / "tools/spatial-prototype/index.html")
        if decoded.startswith("/spatial-prototype/"):
            if decoded.startswith("/spatial-prototype/vendor/"):
                base = ARTIFACTS / "spatial-vendor"
                relative = decoded.removeprefix("/spatial-prototype/vendor/")
                allowed = {"three.module.min.js", "three.core.min.js", "OrbitControls.js", "LICENSE"}
            else:
                base = ROOT / "tools/spatial-prototype"
                relative = decoded.removeprefix("/spatial-prototype/")
                allowed = {"lab.css", "lab.mjs", "fixture.mjs", "core-fixture.json"}
            target = (base / relative).resolve()
            if relative in allowed and target.is_relative_to(base.resolve()):
                return str(target)
            return str(WEB / "__invalid_path__")
        base = ARTIFACTS if decoded.startswith("/runtime/") else WEB
        target = (base / decoded.lstrip("/")).resolve()
        if not target.is_relative_to(base.resolve()):
            return str(WEB / "__invalid_path__")
        return str(target)

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        super().end_headers()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8766)
    args = parser.parse_args()
    print(f"BUILDER preview: http://127.0.0.1:{args.port}/", flush=True)
    ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()
