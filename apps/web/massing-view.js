/* massing-view.js — M7.5 Visualization：量體／樓層視圖（純呈現）
   ============================================================================
   憲章＝docs/architecture/M7_CASE_OS_SPEC.md §9。本檔把**既有的** engine.floors[]
   換一種畫法，資料早就存在，只是從表格變成圖 → 便宜且誠實。

   ★ 鐵律（§9）：
     1. **只讀不寫**：純呈現層，不寫回任何案件資料（不碰 CaseStore／Activity／Scenario）。
     2. **絕不回推容積**：不在圖上拉量體、不由圖反算容積或免計——那會在 Core 之外
        長出第二套計算，直接違反紅線。本檔**零領域公式**。
     3. **權威數字只能來自 Core**：合計（總樓地板、允建容積、計入容積…）一律讀
        `result`；本檔**不自行加總**任何要顯示給使用者的領域數值。
        唯一的算術是「畫多寬」——`樓板 / maxPlate` 的**幾何比例**，那是版面，不是領域量。

   ★ 誠實揭露：`計容積` 逐層值在多數案件為 0（Core 以面積表彙總為準，「圖說為真」）。
     視圖照實呈現，並標示其來源，不得把 0 詮釋成「這層不計容積」。 */
(function () {
  "use strict";

  // 本檔不得顯示的推論／衍生欄位（要顯示請向 Core result 索取）
  var FORBIDDEN = ["允建容積", "計入容積", "銷坪比", "efficiency_ratio",
                   "shared_cost_ratio", "return_rate", "verdict", "ev"];

  var RAW_COLS = ["樓板", "計容積", "梯廳", "安全梯", "陽台"];

  /* 樓層排序權重（純版面：屋突 > 地上 > 地下；B1 在 B2 之上）。
     這是「畫在哪一列」，不是領域判斷。 */
  function levelRank(label) {
    var s = String(label == null ? "" : label).trim().toUpperCase();
    var m;
    if ((m = s.match(/^R(\d*)F?$/))) return 10000 + (parseInt(m[1] || "1", 10));
    if ((m = s.match(/^B(\d+)F?$/))) return -parseInt(m[1], 10);
    if ((m = s.match(/^(\d+)F?$/))) return parseInt(m[1], 10);
    return 0;                                   // 無法解析＝不臆造，排在基準列
  }

  function num(v) { return typeof v === "number" && isFinite(v) ? v : 0; }

  /**
   * buildModel(floors) — 由既有 floors[] 組出**呈現模型**（零領域計算）。
   * 回傳 rows 依樓層由高到低排序，供由上往下堆疊繪製。
   * maxPlate 只用於決定長條寬度（幾何比例），不是可顯示的領域數值。
   */
  function buildModel(floors) {
    if (!Array.isArray(floors)) throw new Error("massing-view 需要 floors 陣列");
    var rows = floors.map(function (f, i) {
      f = f || {};
      var r = {
        index: i,
        label: String(f["樓層"] == null ? "" : f["樓層"]),
        enabled: f["啟用"] !== false,
        rank: levelRank(f["樓層"])
      };
      RAW_COLS.forEach(function (k) { r[k] = num(f[k]); });
      r.below = r.rank < 0;
      return r;
    });
    rows.sort(function (a, b) { return b.rank - a.rank || a.index - b.index; });

    var maxPlate = 0;
    rows.forEach(function (r) { if (r.enabled && r["樓板"] > maxPlate) maxPlate = r["樓板"]; });

    return {
      rows: rows,
      maxPlate: maxPlate,                       // 僅供比例縮放
      aboveGround: rows.filter(function (r) { return r.enabled && r.rank > 0 && r.rank < 10000; }).length,
      belowGround: rows.filter(function (r) { return r.enabled && r.below; }).length,
      rooftop: rows.filter(function (r) { return r.enabled && r.rank >= 10000; }).length,
      disabled: rows.filter(function (r) { return !r.enabled; }).length,
      counted_far_all_zero: rows.every(function (r) { return r["計容積"] === 0; })
    };
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /**
   * svg(model, opts) — 量體視圖：一層一條，寬度 ∝ 樓板（幾何比例）。
   * 地下層以虛線框與不同色調區隔；停用層以低透明度呈現但不隱藏（誠實）。
   */
  function svg(model, opts) {
    opts = opts || {};
    var W = opts.width || 420, rowH = opts.rowH || 16, gap = 2, padL = 46, padR = 8, padT = 8;
    var barMax = W - padL - padR;
    var H = padT * 2 + model.rows.length * (rowH + gap);
    var parts = ['<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" ' +
                 'aria-label="量體視圖：逐層樓地板面積" class="massing-svg">'];
    // 地面線
    var groundY = null;
    model.rows.forEach(function (r, i) {
      var y = padT + i * (rowH + gap);
      var w = model.maxPlate > 0 ? Math.max(1, (r["樓板"] / model.maxPlate) * barMax) : 1;
      var cls = "mv-bar" + (r.below ? " mv-below" : "") + (r.enabled ? "" : " mv-off");
      parts.push('<text x="' + (padL - 6) + '" y="' + (y + rowH - 4) + '" text-anchor="end" class="mv-lbl">'
                 + esc(r.label) + "</text>");
      parts.push('<rect x="' + padL + '" y="' + y + '" width="' + w.toFixed(2) + '" height="' + rowH
                 + '" class="' + cls + '"><title>' + esc(r.label) + "：樓板 "
                 + r["樓板"] + " m²" + (r.enabled ? "" : "（停用）") + "</title></rect>");
      if (groundY === null && r.below) groundY = y - gap / 2;
    });
    if (groundY !== null) {
      parts.push('<line x1="0" y1="' + groundY + '" x2="' + W + '" y2="' + groundY
                 + '" class="mv-ground"><title>地面線</title></line>');
    }
    parts.push("</svg>");
    return parts.join("");
  }

  /** 逐層表：只列原始輸入欄位，不加任何合計列（合計請讀 Core result）。 */
  function table(model) {
    var h = ["<table class='mv-tbl'><thead><tr><th>樓層</th>"];
    RAW_COLS.forEach(function (k) { h.push("<th>" + k + "</th>"); });
    h.push("<th>啟用</th></tr></thead><tbody>");
    model.rows.forEach(function (r) {
      h.push("<tr" + (r.enabled ? "" : " class='mv-off-row'") + "><td>" + esc(r.label) + "</td>");
      RAW_COLS.forEach(function (k) { h.push("<td class='num'>" + r[k] + "</td>"); });
      h.push("<td>" + (r.enabled ? "✓" : "—") + "</td></tr>");
    });
    h.push("</tbody></table>");
    return h.join("");
  }

  /**
   * totalsFrom(result) — 權威合計**只從 Core result 取**，取不到就回 null，
   * 由呼叫端顯示「—」。**絕不在此加總 floors 來湊數字。**
   */
  function totalsFrom(result) {
    if (!result || typeof result !== "object") return null;
    var pick = ["total_floor_area_sqm", "allowed_far_sqm", "counted_far_sqm"];
    var out = {}, got = false;
    pick.forEach(function (k) {
      if (typeof result[k] === "number") { out[k] = result[k]; got = true; }
    });
    return got ? out : null;
  }

  var api = {
    buildModel: buildModel, svg: svg, table: table, totalsFrom: totalsFrom,
    levelRank: levelRank,
    RAW_COLS: RAW_COLS, _FORBIDDEN: FORBIDDEN
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  self.MassingView = api;
})();
