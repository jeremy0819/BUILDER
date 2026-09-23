"""Loopback-only lab; separate origin, no case storage, no directory listings."""
import argparse
import base64
import hashlib
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

from serve_web import Handler as WebHandler, WEB, ROOT
from prepare_spatial_prototype import check

LAB = ROOT / "tools/spatial-prototype"
VENDOR = ROOT / "tools/browser/artifacts/spatial-vendor"
IMPORT_MAP = '{"imports":{"three":"./spatial-prototype/vendor/three.module.min.js"}}'
MAP_HASH = base64.b64encode(hashlib.sha256(IMPORT_MAP.encode()).digest()).decode()


class Handler(WebHandler):
    def translate_path(self, path):
        decoded = unquote(urlsplit(path).path)
        if decoded in ("/", "/index.html", "/spatial-prototype.html"):
            return str(LAB / "index.html")
        if decoded.startswith("/spatial-prototype/"):
            prefix, base = ("/spatial-prototype/vendor/", VENDOR) if decoded.startswith("/spatial-prototype/vendor/") else ("/spatial-prototype/", LAB)
            target = (base / decoded[len(prefix):]).resolve()
            if target.is_relative_to(base.resolve()) and target.is_file():
                return str(target)
            return str(LAB / "__missing__")
        return super().translate_path(path)

    def list_directory(self, path):
        self.send_error(403, "Directory listing disabled")
        return None

    def end_headers(self):
        self.send_header("Content-Security-Policy", "default-src 'self'; "
                         f"script-src 'self' 'wasm-unsafe-eval' 'sha256-{MAP_HASH}'; "
                         "style-src 'self'; connect-src 'self'; worker-src 'self'; "
                         "img-src 'self' data:; object-src 'none'; base-uri 'none'; "
                         "frame-ancestors 'none'; form-action 'none'")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8767)
    args = parser.parse_args()
    if not (VENDOR / "three.module.min.js").is_file():
        parser.error("Run python tools/prepare_spatial_prototype.py first")
    check()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print(f"Synthetic spatial lab: http://127.0.0.1:{server.server_port}/", flush=True)
    server.serve_forever()
