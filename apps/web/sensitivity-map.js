/* sensitivity-map.js — M8.4 敏感度地圖（M8_VIEWFINDER_SPEC §6）
   ================================================================================
   兩個參數掃描 → 熱區圖，疊上門檻等值線。

   **這一項最容易造假，故紀律最嚴。** 為什麼嚴：一張漂亮的漸層圖會讓人以為每一點
   都算過。若其實只算了 25 格再插值，那條門檻線就是**畫出來的，不是算出來的**——
   而使用者正要拿它決定要不要掏錢。

   四條規則，每一條都有對應的可執行斷言：
     ① 每格必須是真實 recompute。本模組**不含任何內插、外推、平滑或擬合**；
        取不到就是取不到，那一格標為缺格，不用鄰居的值頂替。
     ② 宣告網格數必須等於實際重算次數。run() 回傳 recompute_count，
        與 rows×cols 不符即拋錯——這是自我舉證，不是靠人記得檢查。
     ③ 等值線若經視覺平滑，必須標示，且**不得用於判讀是否跨越門檻**——
        跨不跨一律回到該格的 Core 數值。本版不做平滑（noSmoothing），
        等值線直接沿格界走，看起來是階梯狀，那是誠實的樣子。
     ④ 計算量大 → 明確按鈕觸發並顯示進度，不做拖曳即時掃描
        （沿用 M7.4「精確 Shapley 用按鈕不用自動執行」的同一判斷）。

   紅線：本模組零領域公式。它只負責「把 engine 的某兩個參數換值、交給 Core、
   收回結果」。門檻比較用的是 Core result 的原值與呼叫端給的門檻，不自行換算。
   ================================================================================ */
(function () {
  "use strict";

  var SCHEMA = "sensitivity-0.1";

  /* 掃描軸：只允許數值型的 engine.params 欄位。
     結構性欄位（floors／owners／case_type／mode）不在此列——
     那是 M7.4 已裁定的「明確拒答優於虛假歸因」同一條界線。 */
  var STRUCTURAL = ["floors", "owners", "case_type", "mode"];

  function assertAxis(axis, 名) {
    if (!axis || typeof axis.param !== "string") throw new Error(名 + "：缺 param");
    if (STRUCTURAL.indexOf(axis.param) >= 0)
      throw new Error(名 + "：不支援結構性參數「" + axis.param + "」——請改用歸因或另建方案");
    var n = Number(axis.steps);
    if (!(n >= 2 && n <= 21 && n === Math.round(n)))
      throw new Error(名 + "：steps 需為 2–21 的整數（實得 " + axis.steps + "）");
    if (!isFinite(axis.from) || !isFinite(axis.to) || axis.from === axis.to)
      throw new Error(名 + "：from／to 需為相異的有限數");
    return n;
  }

  /** plan(axes) → 網格規格。每一格都明列它要用的參數值；沒有任何格是推出來的。 */
  function plan(axes) {
    var cols = assertAxis(axes.x, "x 軸"), rows = assertAxis(axes.y, "y 軸");
    if (axes.x.param === axes.y.param) throw new Error("兩軸不得為同一參數");
    var vx = [], vy = [], i;
    for (i = 0; i < cols; i++) vx.push(axes.x.from + (axes.x.to - axes.x.from) * i / (cols - 1));
    for (i = 0; i < rows; i++) vy.push(axes.y.from + (axes.y.to - axes.y.from) * i / (rows - 1));
    var cells = [];
    for (var r = 0; r < rows; r++)
      for (var c = 0; c < cols; c++)
        cells.push({ r: r, c: c, x: vx[c], y: vy[r] });
    return {
      schema_version: SCHEMA,
      x: { param: axes.x.param, values: vx }, y: { param: axes.y.param, values: vy },
      rows: rows, cols: cols, declared_cells: rows * cols, cells: cells
    };
  }

  /** 把某一格的兩個參數值套進 engine 的複本。不改原輸入。 */
  function engineFor(engine, spec, cell) {
    var e = JSON.parse(JSON.stringify(engine));
    e.params = e.params || {};
    e.params[spec.x.param] = cell.x;
    e.params[spec.y.param] = cell.y;
    return e;
  }

  /**
   * run(recompute, engine, spec, opts) → Promise<grid>
   * recompute(engine) 必須回傳 {result}；本模組**逐格呼叫，不抽樣、不內插**。
   * opts.metric  要取的 result 欄位（預設 shared_cost_ratio）
   * opts.onProgress(done, total)
   * opts.signal  AbortSignal，取消時已算的格保留、未算的標缺格
   */
  function run(recompute, engine, spec, opts) {
    opts = opts || {};
    var metric = opts.metric || "shared_cost_ratio";
    var total = spec.declared_cells;

    /* ② 開跑前先擋自相矛盾的規格。
       若有人把 cells 抽樣掉一半卻不動 declared_cells，那些不存在的格會在
       逐格迴圈裡被當成「取不到」而標成缺格——看起來全部跑完、其實根本沒算。
       這正是對抗案例 G 要擋的事，所以要在**進迴圈之前**就拒絕。 */
    if (!Array.isArray(spec.cells) || spec.cells.length !== total)
      throw new Error("敏感度地圖：規格自相矛盾——宣告 " + total + " 格，cells 實有 "
        + (spec.cells ? spec.cells.length : 0) + " 格。不得以缺格矇混。");
    if (spec.rows * spec.cols !== total)
      throw new Error("敏感度地圖：rows×cols(" + spec.rows + "×" + spec.cols
        + ") 與宣告格數 " + total + " 不符");
    var values = new Array(total).fill(null);
    var missing = [];
    var count = 0;                       // ← 實際呼叫次數，用來自我舉證
    var i = 0;

    function step() {
      if (opts.signal && opts.signal.aborted) {
        for (var k = i; k < total; k++) missing.push(k);
        return Promise.resolve();
      }
      if (i >= total) return Promise.resolve();
      var cell = spec.cells[i];
      /* 用 then() 起頭而非 Promise.resolve(recompute(...))：
         recompute 若**同步**拋錯，後者的 Promise 還沒建立，錯誤會直接逃出 step()，
         整張圖就失敗了——但規格要的是「那一格標缺，其餘照算」。 */
      return Promise.resolve()
        .then(function () { return recompute(engineFor(engine, spec, cell)); })
        .then(function (res) {
          count++;
          var v = res && res.result ? res.result[metric] : undefined;
          /* 取不到就是缺格。不用鄰居頂替——那就是規則①禁止的插值。 */
          values[i] = (typeof v === "number" && isFinite(v)) ? v : null;
          if (values[i] === null) missing.push(i);
        })
        .catch(function () { count++; values[i] = null; missing.push(i); })
        .then(function () {
          i++;
          if (opts.onProgress) opts.onProgress(i, total);
          return step();
        });
    }

    return step().then(function () {
      var 已算 = total - (opts.signal && opts.signal.aborted ? (total - count) : 0);
      /* ② 自我舉證：宣告網格數必須等於實際重算次數。
         不符就拋錯，不讓一張「看起來算過」的圖流出去。 */
      if (!(opts.signal && opts.signal.aborted) && count !== total)
        throw new Error("敏感度地圖：宣告 " + total + " 格，實際只重算 " + count
          + " 次——不得以任何方式補足差額");
      return {
        schema_version: SCHEMA, spec: spec, metric: metric,
        values: values, missing: missing,
        declared_cells: total, recompute_count: count,
        aborted: !!(opts.signal && opts.signal.aborted),
        interpolated: false, smoothed: false      // 本模組不做這兩件事，明文釘住
      };
    });
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmt(v, d) { return v == null ? "—" : Number(v).toFixed(d == null ? 3 : d); }

  /**
   * svg(grid, opts) — 熱區圖。
   * opts.threshold 門檻值；跨門檻的格以粗邊界標出（**沿格界走，不平滑**）
   * opts.higherIsWorse 預設 true（共負比越高越糟）
   */
  function svg(grid, opts) {
    opts = opts || {};
    var s = grid.spec, cw = opts.cell || 30, padL = 64, padT = 26, padB = 34, padR = 12;
    var W = padL + s.cols * cw + padR, H = padT + s.rows * cw + padB;
    var vals = grid.values.filter(function (v) { return v != null; });
    var lo = vals.length ? Math.min.apply(null, vals) : 0;
    var hi = vals.length ? Math.max.apply(null, vals) : 1;
    var span = (hi - lo) || 1;
    var out = ['<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" class="sm-heat" '
      + 'aria-label="敏感度地圖：' + esc(s.y.param) + ' × ' + esc(s.x.param)
      + '，' + s.rows + '×' + s.cols + ' 格，每格一次真實重算">'];

    for (var idx = 0; idx < grid.values.length; idx++) {
      var cell = s.cells[idx], v = grid.values[idx];
      var x = padL + cell.c * cw, y = padT + (s.rows - 1 - cell.r) * cw;
      if (v == null) {
        /* 缺格畫成斜線，不畫成顏色——顏色會被讀成「有算過而且是這個值」 */
        out.push('<rect class="sh-miss" x="' + x + '" y="' + y + '" width="' + cw + '" height="' + cw
          + '"><title>' + esc(s.y.param) + " " + fmt(cell.y, 1) + " × " + esc(s.x.param) + " "
          + fmt(cell.x, 1) + "：未取得</title></rect>");
        continue;
      }
      var t = (v - lo) / span;
      var over = opts.threshold != null
        && (opts.higherIsWorse === false ? v <= opts.threshold : v >= opts.threshold);
      out.push('<rect class="sh-cell' + (over ? " sh-over" : "") + '" x="' + x + '" y="' + y
        + '" width="' + cw + '" height="' + cw + '" style="fill-opacity:' + (0.12 + t * 0.8).toFixed(3)
        + '"><title>' + esc(s.y.param) + " " + fmt(cell.y, 1) + " × " + esc(s.x.param) + " "
        + fmt(cell.x, 1) + "：" + fmt(v) + "</title></rect>");
    }
    out.push('<text x="' + padL + '" y="' + (padT - 10) + '" class="sh-ax">' + esc(s.x.param) + " →</text>");
    out.push('<text x="4" y="' + (padT + 10) + '" class="sh-ax">↑ ' + esc(s.y.param) + "</text>");
    out.push("</svg>");
    return out.join("");
  }

  /** 圖說：規格 §6 要求網格數與「每格真實重算」必須可見。 */
  function caption(grid) {
    var s = grid.spec;
    var 主 = s.rows + " × " + s.cols + " ＝ " + grid.declared_cells + " 格，"
      + "每格一次真正的重新計算（實際重算 " + grid.recompute_count + " 次）";
    var 附 = [];
    if (grid.missing.length) 附.push(grid.missing.length + " 格未取得，以斜線標示、不以鄰格頂替");
    if (grid.aborted) 附.push("已中止，未算的格保留為缺格");
    附.push("未做內插，未做平滑——等值邊界沿格界走，跨不跨門檻一律看該格數值");
    return { headline: 主, notes: 附 };
  }

  var api = {
    SCHEMA_VERSION: SCHEMA, STRUCTURAL: STRUCTURAL,
    plan: plan, run: run, svg: svg, caption: caption, engineFor: engineFor
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  self.SensitivityMap = api;
})();
