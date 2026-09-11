/* Versioned per-case UI/input drafts, separate from immutable workflow schemas. */
(function (root) {
  "use strict";
  function read(pid) {
    if (!pid) return {};
    var raw = localStorage.getItem("uros.case-drafts.v1." + pid);
    if (!raw) return {};
    var doc = root.UROSSecurity.parseJSON(raw);
    if (doc.version !== 1 || doc.project_id !== pid || !doc.values) throw new Error("案件草稿版本或歸屬不符");
    return doc.values;
  }
  function get(pid, field) { return read(pid)[field]; }
  function set(pid, field, value) {
    if (!pid || !["intent", "site_visited", "people_started"].includes(field)) return;
    var values = read(pid); values[field] = value;
    localStorage.setItem("uros.case-drafts.v1." + pid, JSON.stringify({ version: 1, project_id: pid, values: values }));
  }
  // Old global intent has no reliable project identity. Adoption requires an explicit user action.
  function legacyIntent() { return localStorage.getItem("uros.intent") || ""; }
  root.CaseDrafts = { read: read, get: get, set: set, legacyIntent: legacyIntent };
})(typeof self !== "undefined" ? self : this);
