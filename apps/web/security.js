/* Shared data boundaries: imported text stays text. */
(function (root) {
  "use strict";
  var MAX_BYTES = 5 * 1024 * 1024;
  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function parseJSON(text, limit) {
    if (typeof text !== "string" || text.length > (limit || MAX_BYTES)) throw new Error("JSON 檔案超過容量限制");
    if (new TextEncoder().encode(text).length > (limit || MAX_BYTES)) throw new Error("JSON 檔案超過容量限制");
    var doc = JSON.parse(text), stack = [[doc, 0]], count = 0;
    while (stack.length) {
      var entry = stack.pop(), value = entry[0], depth = entry[1];
      if (++count > 200000 || depth > 64) throw new Error("JSON 結構超過深度或項目限制");
      if (typeof value === "number" && !Number.isFinite(value)) throw new Error("JSON 包含非有限數值");
      if (!value || typeof value !== "object") continue;
      Object.keys(value).forEach(function (key) {
        if (key === "__proto__" || key === "constructor" || key === "prototype") throw new Error("JSON 包含不允許的物件鍵");
        stack.push([value[key], depth + 1]);
      });
    }
    return doc;
  }
  function csvCell(value) {
    var text = String(value == null ? "" : value);
    if (/^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }
  function imageData(value) {
    return typeof value === "string" && value.length <= MAX_BYTES && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value) ? value : "";
  }
  root.UROSSecurity = { esc: esc, parseJSON: parseJSON, csvCell: csvCell, imageData: imageData, MAX_BYTES: MAX_BYTES };
})(typeof self !== "undefined" ? self : this);
