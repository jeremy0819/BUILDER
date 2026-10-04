/* Input-only massing comparison. Core owns every capacity and financial result. */
(function (root) {
  "use strict";
  function generate(engine, values) {
    if (!Number.isInteger(values.levels) || values.levels < 1 || values.levels > 60 || !Number.isFinite(values.plate) || values.plate <= 0 || values.plate > 10000) throw new Error("樓層須為 1–60，樓板面積須大於 0 且不超過 10,000 平方公尺");
    var copy = JSON.parse(JSON.stringify(engine)), defaults = root.CaseBus.defaults();
    defaults.地上樓層 = values.levels; defaults.標準樓板 = values.plate;
    copy.floors = root.CaseBus.buildEngine(defaults).floors;
    delete copy.params.面積表計入容積;
    return copy;
  }
  function esc(value) { return root.UROSSecurity.esc(value); }
  function fmt(value) { return typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("zh-TW", {maximumFractionDigits:2}) : "—"; }

  /* A shared drawing scale keeps a wider/taller draft visibly different from the baseline.
     Rectangles are area-proportional diagram marks, not inferred footprints or heights. */
  function comparison(before, after, selected, overlay, width) {
    var models = [root.MassingView.buildModel(before), root.MassingView.buildModel(after)];
    var maxPlate = Math.max(models[0].maxPlate, models[1].maxPlate, 1);
    var ranks = Array.from(new Set(models[0].rows.concat(models[1].rows).map(function (r) { return r.rank; }))).sort(function (a,b) { return b-a; });
    var W=Math.max(300,Math.min(760,width||760)), column=W/2, barMax=column-74;
    var H = Math.max(220, 76 + ranks.length * 20), parts = [];
    parts.push('<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMin meet" role="group" aria-label="案件快照與本次草案，同尺度樓層比較" class="sm-comparison">');
    models.forEach(function (model, side) {
      var left = side * column + 48;
      parts.push('<text x="'+(side * column + column/2)+'" y="24" text-anchor="middle" class="sm-caption">'+(side ? "本次草案" : "案件快照")+'</text>');
      model.rows.forEach(function (row) {
        var y = 50 + ranks.indexOf(row.rank) * 20;
        var width = Math.max(2, row.樓板 / maxPlate * barMax);
        var cls = "sm-floor " + (side ? "sm-proposed" : "sm-baseline") + (row.below ? " sm-basement" : "") + (!row.enabled ? " sm-disabled" : "") + (side && row.index === selected ? " sm-selected" : "");
        parts.push('<text x="'+(left-7)+'" y="'+(y+15)+'" text-anchor="end" class="sm-floor-label">'+esc(row.label)+'</text>');
        parts.push('<rect x="'+left+'" y="'+y+'" width="'+width.toFixed(2)+'" height="18" class="'+cls+'"'
          +(side ? ' data-mv-row="'+row.index+'" role="button" tabindex="0" aria-pressed="'+(row.index===selected)+'" aria-label="'+esc(row.label)+' 樓板 '+fmt(row.樓板)+' 平方公尺'+(!row.enabled?' 停用':'')+'"' : '')
          +'><title>'+esc(row.label)+' · '+fmt(row.樓板)+' ㎡'+(!row.enabled?' · 停用':'')+'</title></rect>');
        if (overlay && side) {
          var x = left;
          ["梯廳","安全梯","陽台"].forEach(function (k, i) {
            if (!(row[k]>0)) return;
            var w = Math.min(row[k] / maxPlate * barMax, Math.max(0, left+width-x));
            parts.push('<rect x="'+x.toFixed(2)+'" y="'+(y+15)+'" width="'+w.toFixed(2)+'" height="5" class="sm-overlay-mark sm-overlay-'+i+'"/>');
            x += w;
          });
        }
      });
    });
    parts.push('</svg>');
    return parts.join("");
  }
  function mount(host, rec, getRuntime) {
    var draft = JSON.parse(JSON.stringify(rec.engine)), selected = 0, overlay = false, session, disposed = false;
    var above = draft.floors.findIndex(function (f) { return /^1F$/.test(f.樓層); }); if (above >= 0) selected = above;
    host.innerHTML = `<section class="site-massing" aria-label="基地、量體與 Core 結果">
      <div class="sm-heading"><div><h1>本案基地與量體</h1><p>先核對基地輸入，再調整樓層草案；圖形與數字各有其資料來源。</p></div><button type="button" data-sm="reset" title="還原案件樓層">還原案件</button></div>
      <section class="sm-layer sm-layer-site" aria-labelledby="sm-site-title"><div class="sm-layer-heading"><span>A / 基地</span><h2 id="sm-site-title">基地輸入與參考草圖</h2></div><div class="sm-intake"></div></section>
      <section class="sm-layer sm-layer-massing" aria-labelledby="sm-massing-title"><div class="sm-layer-heading"><span>B / 量體</span><h2 id="sm-massing-title">樓層與標準樓板</h2></div>
        <p class="sm-geometry-boundary">可建 footprint：未建立。現階段沒有正式基地 Geometry 與退縮規則；下列樓板是面積輸入，不是建築平面或高度。3D 操作展示收在下方，且不代表本案。</p>
        <div class="sm-controls"><form class="sm-generate"><label>地上層數<input name="levels" type="number" min="1" max="60" step="1" required></label><label>標準樓板（㎡）<input name="plate" type="number" min="0.01" max="10000" step="0.01" required></label><p class="sm-note">調整後只產生本次草案；重算與採用前不修改案件快照。</p></form></div>
        <details class="sm-diagram"><summary>逐層面積比較 · 非 footprint／樓高</summary><div class="sm-visual"><div class="sm-visual-toolbar"><b>案件快照／本次草案</b><label class="sm-overlay"><input type="checkbox" data-sm="overlay">梯廳／安全梯／陽台</label></div><div class="sm-drawing"></div><p class="sm-origin"></p><div class="sm-legend"><span>灰：案件快照</span><span>綠：本次草案</span><span>框線：選取樓層</span><span>虛線：地下層</span></div></div></details>
        <details class="sm-floor-detail"><summary>逐層編輯</summary><div class="sm-floor-select"><label>編輯樓層<select aria-label="編輯樓層"></select></label></div><div class="sm-floor-editor"></div></details>
        <details class="sm-site-inputs"><summary>進階容積條件</summary><div></div></details>
      </section>
      <section class="sm-layer sm-layer-result" aria-labelledby="sm-result-title"><div class="sm-layer-heading"><span>C / 結果</span><h2 id="sm-result-title">Core 容積結果</h2></div>
        <div class="sm-result-heading"><p class="sm-note">允建、已用、剩餘容積與銷售坪數由 Core 重算；未重算的草案顯示「—」。</p><button type="button" data-sm="run">Core 重算</button></div>
        <details class="sm-calc-options"><summary>重算設定</summary><label class="sm-auto"><input type="checkbox" data-sm="auto" checked>輸入變更後自動重算</label></details>
        <p class="sm-snapshot-stale" hidden></p><div class="sm-status" role="status" aria-live="polite"></div><div class="sm-results"></div><div class="sm-warnings" role="status"></div>
        <details class="sm-provenance"><summary>計算溯源</summary><p></p></details>
        <div class="sm-next"><span data-sm="saved">本次草案尚未採用</span><button type="button" data-sm="apply" disabled>採用草案，前往②產品</button><a href="evaluator.html" data-sm="skip">沿用案件快照，前往②</a></div>
      </section></section>`;
    var q = function (s) { return host.querySelector(s); };
    var provenance=root.CaseBus.provenance(rec),stale=q(".sm-snapshot-stale");
    stale.hidden=!provenance.stale;
    if(provenance.stale)stale.textContent=provenance.stale_note+"；請以現行 Core 重算後再採用。";
    q(".sm-provenance p").textContent="Core "+(provenance.core_version||"—")+" · input_hash "+(provenance.input_hash||"—")+(provenance.computed_at?" · 計算時間 "+provenance.computed_at:"");
    var intake = root.SiteIntake ? root.SiteIntake.mount(q('.sm-intake'),rec,function(coverage){
      var inputs=root.CaseBus.defaults();inputs.基地面積=draft.params.基地面積;inputs.人行廣場=draft.params.人行廣場;inputs.建蔽率=coverage;
      q('[name="plate"]').value=root.CaseBus.buildEngine(inputs).floors.find(function(f){return f.樓層==='1F';}).樓板;
      generateDraft();
    }) : null;
    function show(s) {
      q(".sm-status").textContent = s.message;
      q(".sm-status").dataset.phase = s.phase;
      q('[data-sm="apply"]').disabled = s.phase !== "ready";
      q('[data-sm="run"]').disabled = s.phase === "running" || s.phase === "invalid";
      q('[data-sm="saved"]').textContent = s.dirty ? "本次草案尚未採用" : "目前案件樓層";
      var result = s.response && s.response.result;
      var keys = [["allow_floor_area","允建容積（㎡）"],["used_floor_area","計入容積（㎡）"],["remaining_floor_area","剩餘容積（㎡）"],["saleable_area","銷售坪數（坪）"]];
      q(".sm-results").innerHTML = '<table><thead><tr><th>Core 指標</th><th>案件快照</th><th>本次草案</th></tr></thead><tbody>'
        + keys.map(function (p) { return '<tr><th>'+p[1]+'</th><td>'+fmt(rec.view && rec.view[p[0]])+'</td><td>'+fmt(result && result[p[0]])+'</td></tr>'; }).join("") + '</tbody></table>';
      q(".sm-warnings").textContent = result ? (result.warnings || []).map(function (w) { return typeof w === "string" ? w : w.message || w.msg || w.code || ""; }).join("；") : "";
    }
    session = root.PlanningSession.create(rec, getRuntime, show);
    function changed(valid) {
      session.update(draft, valid);
      if (valid !== false && q('[data-sm="auto"]').checked) session.schedule();
    }
    function draw() {
      q(".sm-drawing").innerHTML = comparison(rec.engine.floors || [], draft.floors || [], selected, overlay, q(".sm-drawing").clientWidth);
      q(".sm-origin").textContent = draft.params.面積表計入容積 > 0
        ? "原案採面積表彙總；逐層 0 不代表免計容積。此圖非地籍形狀或法規核准圖。"
        : "兩圖使用同一面積比例與樓層間距；不代表真實平面、樓高或法規核准量體。";
      q(".sm-floor-select select").innerHTML = root.MassingView.buildModel(draft.floors).rows.map(function (r) {
        return '<option value="'+r.index+'"'+(r.index === selected ? " selected" : "")+'>'+esc(r.label)+(r.enabled ? "" : "（停用）")+'</option>';
      }).join("");
    }
    function edit() {
      var floor = draft.floors[selected], panel = q(".sm-floor-editor"); panel.replaceChildren(); if (!floor) return;
      ["樓板","計容積","梯廳","安全梯","陽台"].forEach(function (key) {
        var label = document.createElement("label"); label.textContent = key + "（㎡）";
        var input = document.createElement("input"); input.type = "number"; input.min = "0"; input.max = "100000"; input.step = "0.01"; input.required = true;
        input.value = floor[key] == null ? "" : floor[key];
        input.addEventListener("input", function () {
          if (input.validity.valid) floor[key] = input.valueAsNumber;
          changed(valid()); draw();
        });
        label.appendChild(input); panel.appendChild(label);
      });
    }
    function valid() { return Array.from(host.querySelectorAll("input[type=number]")).every(function (i) { return i.validity.valid; }); }
    function choose(index, focus) {
      if (!valid()) { host.querySelector("input:invalid").reportValidity(); return; }
      selected = index; q(".sm-floor-detail").open=true; draw(); edit();
      if (focus) { var face = q('[data-mv-row="'+selected+'"]'); if (face) face.focus({preventScroll:true}); }
    }
    q(".sm-drawing").addEventListener("click", function (e) { var target = e.target.closest("[data-mv-row]"); if (target) choose(Number(target.dataset.mvRow), true); });
    q(".sm-drawing").addEventListener("keydown", function (e) {
      var target = e.target.closest("[data-mv-row]"); if (!target || !["Enter"," ","ArrowUp","ArrowDown"].includes(e.key)) return;
      e.preventDefault(); var rows = root.MassingView.buildModel(draft.floors).rows, index = rows.findIndex(function (r) { return r.index === Number(target.dataset.mvRow); });
      if (e.key === "ArrowUp") index = Math.max(0,index-1); if (e.key === "ArrowDown") index = Math.min(rows.length-1,index+1);
      choose(rows[index].index, true);
    });
    q(".sm-floor-select select").addEventListener("change", function (e) { choose(Number(e.target.value), false); });
    function syncForm() {
      var first = draft.floors.find(function (f) { return /^\d+F$/.test(f.樓層); });
      q('[name="plate"]').value = first ? first.樓板 : 400;
      q('[name="levels"]').value = Math.max(1,draft.floors.filter(function (f) { return /^\d+F$/.test(f.樓層); }).length);
    }
    function generateDraft(e) {
      if (e) e.preventDefault();
      var form = q(".sm-generate");
      if (!form.checkValidity()) { changed(false); return; }
      try {
        var label=draft.floors[selected] && draft.floors[selected].樓層;
        draft = generate(draft,{levels:form.elements.levels.valueAsNumber,plate:form.elements.plate.valueAsNumber});
        selected=draft.floors.findIndex(function (floor) {return floor.樓層===label;});if(selected<0)selected=1;
        draw(); edit(); changed(valid());
      } catch (err) { q(".sm-status").textContent = err.message; }
    }
    q(".sm-generate").addEventListener("submit",generateDraft);
    q(".sm-generate").addEventListener("input",generateDraft);
    [["基地面積","基地面積（㎡）",0.01,10000000],["容積率","容積率（倍數）",0,20],["獎勵率","獎勵率（倍數）",0,20],["容積移轉","容積移轉（㎡）",0,10000000]].forEach(function (field) {
      var label = document.createElement("label"); label.textContent = field[1]; var input = document.createElement("input");
      input.type="number"; input.min=field[2]; input.max=field[3]; input.step="any"; input.required=true; input.value=draft.params[field[0]] == null ? "" : draft.params[field[0]];
      input.dataset.param=field[0]; input.addEventListener("input",function () { if(input.validity.valid) draft.params[field[0]]=input.valueAsNumber; changed(valid()); });
      label.appendChild(input); (intake && (field[0]==="基地面積"||field[0]==="容積率") ? intake.fields : q(".sm-site-inputs div")).appendChild(label);
    });
    q('[data-sm="overlay"]').addEventListener("change",function (e) { overlay=e.target.checked; draw(); });
    q('[data-sm="auto"]').addEventListener("change",function (e) { if (e.target.checked) session.schedule(0); else session.cancelScheduled(); });
    q('[data-sm="run"]').addEventListener("click",function () { if(valid()) session.retry(); });
    q('[data-sm="reset"]').addEventListener("click",function () {
      draft=JSON.parse(JSON.stringify(rec.engine)); selected=above>=0?above:0; syncForm(); draw(); edit();
      host.querySelectorAll("[data-param]").forEach(function (i) { i.value=draft.params[i.dataset.param] == null ? "" : draft.params[i.dataset.param]; });
      session.reset();
    });
    q('[data-sm="skip"]').addEventListener("click",function (e) {
      if (session.state().dirty && !root.confirm("本次草案尚未採用。捨棄草案，沿用案件快照？")) e.preventDefault();
      else session.dispose();
    });
    q('[data-sm="apply"]').addEventListener("click",function () {
      try { session.accept(); root.location.href="evaluator.html"; }
      catch (err) { q(".sm-status").textContent=root.PlanningSession.saveError(err); }
    });
    syncForm(); draw(); edit(); show(session.state()); session.schedule(0);
    root.addEventListener("resize",draw);
    return {dispose:function () { if (!disposed) { disposed=true; session.dispose(); if(intake)intake.dispose(); root.removeEventListener("resize",draw); } }};
  }
  root.SiteMassing = {generate:generate, comparison:comparison, mount:mount};
})(typeof self !== "undefined" ? self : this);
