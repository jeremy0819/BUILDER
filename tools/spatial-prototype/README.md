# Isolated Spatial Prototype

Synthetic-only Three.js lab for Visualization Foundation 0.7.0.
Not a production Viewer, not a Case Truth source, and not a release tag.

The authorized Pages artifact also publishes `spatial-prototype.html` as a
standalone synthetic demo. It shares the site's origin but never reads or writes
case storage. Local Core diagnostics are hidden on the published route.
Dependencies are assembled by `tools/build_pages.py`, not committed to Git.

## Run

From the repository root:

```powershell
python tools/prepare_spatial_prototype.py
python tools/serve_spatial_prototype.py --port 8767
```

Open `http://127.0.0.1:8767/`. Use another unused port if necessary.
Preparation downloads a pinned package, verifies SHA-512 and per-file SHA-256,
and retains only four files in ignored browser artifacts. It does not modify Pages.
After preparation, the lab works with a local HTTP server and no external requests.

```powershell
python tools/prepare_spatial_prototype.py --check
node tests/web/test_spatial_prototype.mjs
python -m pytest tests/test_spatial_prototype.py -q
node tools/browser/verify_spatial.mjs
```

Browser verification uses the existing `tools/browser` Playwright installation.
For Core coexistence verification, first prepare the existing local Pyodide assets
with `python tools/prepare_pyodide.py`. This step is separate from Three.js preparation.
The server supports `--port 0` for automatically assigned test ports.

## Boundaries

- One explicit synthetic site and building; no inferred footprint, height or units.
- No user import, drawing editor, external cadastral search or household mapping.
- No CaseBus, persistent storage, Activity or production navigation integration.
- The Core coexistence fixture is independent of the display fixture. Its result
  is never used to label the synthetic geometry as a computed building.
- Unknown or missing geometry never receives a generated replacement.
- `fixture.mjs` validation/hash is for the controlled demo, not a general GIS validator.
- Runtime files, screenshots and browser downloads remain outside version control.
- Production dependency approval and formal schema freezing remain separate gates.

See `docs/architecture/VISUALIZATION_FOUNDATION_0_7.md` and
`docs/architecture/ADR_THREEJS_VISUALIZATION.md` for proposals and official sources.
