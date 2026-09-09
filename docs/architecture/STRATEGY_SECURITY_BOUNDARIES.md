# Strategy Workspace Security Boundaries

## Trust Model

The static application is a local-first decision aid, not a multi-tenant security boundary.
Imported JSON, browser storage, case identifiers, owner observations, filenames and worker errors are untrusted.
Core calculations stay in core/redcf. UI controllers transport complete inputs and display returned outputs.

## Presentation And Persistence

- security.js supplies bounded JSON parsing, HTML escaping, CSV cell encoding and raster data URL allowlisting.
- report.html uses an explicit CSP with self-only scripts, no inline handlers, no forms to remote origins and no objects.
- Strategy views use DOM text nodes for imported fields.
- Local observations and assumptions are user input; they may be stored locally.
- Calculated strategy/decision output and generated massing drafts are ephemeral. Export is an explicit user action.
- A changed source or input invalidates pending presentation. Worker failure rejects all queued promises.
- Storage corruption must not trigger replacement with an empty case collection.

## Runtime Dependency

Pyodide is pinned at 0.26.4. Its jsonschema package is required because the existing Core Decision and Strategy
functions validate frozen schemas. The adapter does not skip these validators or duplicate their contracts.
These runtime downloads happen before analysis; no case payload is intentionally sent with them.
A future offline distribution must package and verify the runtime plus its transitive dependencies.

## New UI Contracts

Strategy profiles use the existing stakeholder_profile v0.2 schema.
Core, schema and release versions are unchanged.

Site massing reads existing floors through MassingView and generates temporary floor inputs through
CaseBus.buildEngine. New generation explicitly removes the imported aggregate counted-area override only
from the temporary engine. Every displayed capacity total comes from recompute result fields.

A run token protects each controller against stale async results. A source fingerprint additionally protects
strategy analysis against a case/input change in another view. There is no drag-to-recalculate output path.

## Deployment Gate

Before real company data is used on a shared service:

1. Select data classification and authorized storage locations.
2. Add authenticated access, minimum roles and auditable changes if collaboration is required.
3. Review backup, recovery, device policy and browser extensions.
4. Externalize legacy inline scripts before applying restrictive CSP to all pages.
5. Serve HTTPS with security headers including a reviewed CSP, frame-ancestors, nosniff and Referrer-Policy.
   frame-ancestors requires an HTTP response header; the report meta policy is not a substitute.
6. Review repository history separately. Working-tree scanning does not erase historical exposure.
7. Run independent penetration testing; passing local tests is not a security certification.

## Evidence

See ../releases/STRATEGY_SECURITY_SITE_MASSING_REPORT-2026-09-09.md.
Threat patterns follow OWASP DOM XSS Prevention, XSS Prevention and HTML5 Security Cheat Sheets.
Browser tests use synthetic data and remain separate from production code.

