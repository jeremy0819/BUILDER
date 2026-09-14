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

  /* ══════════════════════════════════════════════════════════════
     M8.3 互動量體（M8_VIEWFINDER_SPEC §5）
     軸測堆疊 ＋ 點選層 ↔ 明細列雙向對照 ＋ 免計項疊加切換。

     鐵律（M8 憲章）：**可拖曳的只有 Input；Output 永遠唯讀。**
       · 這張圖是 Output。它沒有任何拖曳把手、沒有 draggable、
         不註冊 pointermove/dragstart——不是「拖了沒反應」，是根本沒有那條路徑。
       · 要改量體，回 ① 基地改 floors[] 再讓 Core 重算。中間沒有捷徑。
       · 寬度與深度是**版面幾何**，不是任何領域量。免計項數值一律讀 floors[] 原值。
     ══════════════════════════════════════════════════════════════ */

  var OVERLAY_COLS = ["梯廳", "安全梯", "陽台"];

  /**
   * axon(model, opts) — 軸測量體：逐層堆疊的斜面板。
   * opts.overlay  true 時在每層疊出免計項分段（數值 verbatim 自 floors[]）
   * opts.selected 目前選取的 row.index（-1 為無）
   */
  function axon(model, opts) {
    opts = opts || {};
    var W = opts.width || 460, slabH = opts.slabH || 13, dz = opts.depth || 9;
    var padL = 44, padR = 10, padT = 14, padB = 10;
    var barMax = W - padL - padR - dz;
    var n = model.rows.length;
    var H = padT + padB + n * slabH + dz;
    var parts = ['<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" '
      + 'aria-label="軸測量體視圖：逐層樓地板面積比例" class="mv-axon">'];

    model.rows.forEach(function (r, i) {
      var y = padT + i * slabH;
      var w = model.maxPlate > 0 ? Math.max(2, (r["樓板"] / model.maxPlate) * barMax) : 2;
      var on = opts.selected === r.index;
      var cls = "mv-slab" + (r.below ? " mv-below" : "") + (r.enabled ? "" : " mv-off")
              + (on ? " mv-sel" : "");
      /* 頂面：平行四邊形（軸測的深度感；dz 是畫法，不是樓高） */
      parts.push('<polygon class="' + cls + ' mv-top" points="'
        + padL + "," + y + " " + (padL + w) + "," + y + " "
        + (padL + w + dz) + "," + (y - dz) + " " + (padL + dz) + "," + (y - dz) + '"/>');
      /* 正面 */
      parts.push('<rect class="' + cls + ' mv-face" data-mv-row="' + r.index + '" tabindex="0" '
        + 'role="button" aria-pressed="' + (on ? "true" : "false") + '" '
        + 'x="' + padL + '" y="' + y + '" width="' + w.toFixed(2) + '" height="' + (slabH - 1) + '">'
        + "<title>" + esc(r.label) + "：樓板 " + r["樓板"] + " m²"
        + (r.enabled ? "" : "（停用）") + "</title></rect>");

      if (opts.overlay) {
        /* 免計項分段：自左起依序排開，寬度按同一比例尺。
           取不到就不畫——不補 0，也不把缺值當成「沒有」。 */
        var x = padL;
        OVERLAY_COLS.forEach(function (k, j) {
          var v = r[k];
          if (!(v > 0)) return;
          var ow = Math.max(1, (v / model.maxPlate) * barMax);
          parts.push('<rect class="mv-ov mv-ov-' + j + '" x="' + x.toFixed(2) + '" y="' + (y + 2)
            + '" width="' + ow.toFixed(2) + '" height="' + (slabH - 5) + '">'
            + "<title>" + esc(r.label) + " " + k + "：" + v + " m²</title></rect>");
          x += ow;
        });
      }

      parts.push('<text x="' + (padL - 6) + '" y="' + (y + slabH - 3)
        + '" text-anchor="end" class="mv-lbl">' + esc(r.label) + "</text>");
    });
    parts.push("</svg>");
    return parts.join("");
  }

  /**
   * bind(host, model, opts) — 點選層 ↔ 明細列雙向對照。
   * host 內需同時有 axon() 的 svg 與 table() 的表格。
   * 回傳 { select(index), selected() }；不寫回任何資料。
   */
  function bind(host, model, opts) {
    opts = opts || {};
    var sel = -1;
    function paint() {
      var faces = host.querySelectorAll("[data-mv-row]");
      for (var i = 0; i < faces.length; i++) {
        var idx = Number(faces[i].getAttribute("data-mv-row"));
        var on = idx === sel;
        faces[i].classList.toggle("mv-sel", on);
        faces[i].setAttribute("aria-pressed", on ? "true" : "false");
      }
      var trs = host.querySelectorAll("[data-mv-tr]");
      for (var j = 0; j < trs.length; j++) {
        var k = Number(trs[j].getAttribute("data-mv-tr"));
        trs[j].classList.toggle("mv-sel", k === sel);
        trs[j].setAttribute("aria-selected", k === sel ? "true" : "false");
      }
    }
    function select(index, 來源) {
      sel = (index === sel) ? -1 : index;      // 再點一次取消選取
      paint();
      if (sel >= 0 && 來源 !== "table") {
        var tr = host.querySelector('[data-mv-tr="' + sel + '"]');
        if (tr && tr.scrollIntoView) tr.scrollIntoView({ block: "nearest" });
      }
      if (opts.onSelect) opts.onSelect(sel);
    }
    host.addEventListener("click", function (e) {
      var face = e.target.closest && e.target.closest("[data-mv-row]");
      if (face) return select(Number(face.getAttribute("data-mv-row")), "svg");
      var tr = e.target.closest && e.target.closest("[data-mv-tr]");
      if (tr) return select(Number(tr.getAttribute("data-mv-tr")), "table");
    });
    host.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var t = e.target;
      if (!t || !t.getAttribute) return;
      var idx = t.getAttribute("data-mv-row") || t.getAttribute("data-mv-tr");
      if (idx == null) return;
      e.preventDefault();
      select(Number(idx), t.getAttribute("data-mv-tr") != null ? "table" : "svg");
    });
    paint();
    return { select: select, selected: function () { return sel; } };
  }

  /** 逐層表：只列原始輸入欄位，不加任何合計列（合計請讀 Core result）。 */
  function table(model) {
    var h = ["<table class='mv-tbl'><thead><tr><th>樓層</th>"];
    RAW_COLS.forEach(function (k) { h.push("<th>" + k + "</th>"); });
    h.push("<th>啟用</th></tr></thead><tbody>");
    model.rows.forEach(function (r) {
      /* data-mv-tr 是與軸測圖對照的錨點（M8.3 雙向選取）。
         tabindex 讓鍵盤也能選——互動只切換「看哪一層」，不改任何值。 */
      h.push("<tr data-mv-tr='" + r.index + "' tabindex='0' role='row' aria-selected='false'"
        + (r.enabled ? "" : " class='mv-off-row'") + "><td>" + esc(r.label) + "</td>");
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
    buildModel: buildModel, svg: svg, axon: axon, bind: bind, table: table, totalsFrom: totalsFrom,
    OVERLAY_COLS: OVERLAY_COLS,
    levelRank: levelRank,
    RAW_COLS: RAW_COLS, _FORBIDDEN: FORBIDDEN
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  self.MassingView = api;
})();
