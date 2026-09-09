/* Input-only massing sketch. Core owns all capacity and financial results. */
(function (root) {
  "use strict";
  function generate(engine, values) {
    if (!Number.isInteger(values.levels) || values.levels < 1 || values.levels > 60 || !Number.isFinite(values.plate) || values.plate <= 0 || values.plate > 10000) throw new Error("樓層須為 1–60，樓板面積須大於 0 且不超過 10,000 平方公尺");
    var copy = JSON.parse(JSON.stringify(engine));
    var defaults = root.CaseBus.defaults();
    defaults.地上樓層 = values.levels; defaults.標準樓板 = values.plate;
    copy.floors = root.CaseBus.buildEngine(defaults).floors;
    // Explicitly switch this temporary sketch from imported area-table totals to floor inputs.
    delete copy.params.面積表計入容積;
    return copy;
  }
  function mount(host, rec, getRuntime) {
    var draft = JSON.parse(JSON.stringify(rec.engine)), result = null, seq = 0, disposed = false, selected = 0;
    var fmt = function (v) { return typeof v === "number" && Number.isFinite(v) ? v.toLocaleString("zh-TW", {maximumFractionDigits:2}) : "—"; };
    host.innerHTML = '<section class="site-massing" aria-label="量體生成與容積模擬"><div class="sm-heading"><div><h2>量體生成與容積模擬</h2><p>本次草案 · 未寫回案件</p></div><div><button type="button" data-sm="reset">還原案件</button> <button type="button" data-sm="run">Core 重算</button></div></div>'
      + '<div class="sm-grid"><div><form class="sm-generate"><label>地上層數<input name="levels" type="number" min="1" max="60" step="1" value="7" required></label><label>標準樓板（㎡）<input name="plate" type="number" min="1" max="10000" step="0.01" value="400" required></label><button type="submit">生成規則量體</button></form>'
      + '<p class="sm-note">規則草案沿用案件基地與財務參數；樓層依既有預設模板生成，改採逐層計容積，含一層地下室。這不是地籍形狀、建築高度或法規核准圖。</p>'
      + '<div class="sm-floor-editor"></div></div><div><div class="sm-drawing"></div><p class="sm-origin"></p></div></div>'
      + '<div class="sm-status" role="status" aria-live="polite">既有樓層輸入 · 尚未重算</div><div class="sm-results"></div><div class="sm-warnings"></div></section>';
    var q = function (s) { return host.querySelector(s); }, status = q('.sm-status');
    function clear() { seq++; result = null; q('.sm-results').replaceChildren(); q('.sm-warnings').replaceChildren(); status.textContent = "量體輸入已變更，請交由 Core 重算。"; q('[data-sm="run"]').disabled = false; }
    function draw() {
      var model = root.MassingView.buildModel(draft.floors || []);
      q('.sm-drawing').innerHTML = root.MassingView.svg(model, {width:460, rowH:22});
      var svg = q('.sm-drawing svg'); if (svg) svg.setAttribute('role', 'group');
      host.querySelectorAll('.sm-drawing rect').forEach(function (rect, i) {
        var row = model.rows[i]; rect.setAttribute('role','button'); rect.setAttribute('tabindex','0'); rect.setAttribute('aria-label', row.label + ' 樓層輸入'); rect.setAttribute('aria-pressed', String(row.index === selected));
        function choose() { selected = row.index; draw(); edit(); }
        rect.addEventListener('click', choose); rect.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); } });
      });
      q('.sm-origin').textContent = draft.params.面積表計入容積 > 0 ? "原案採面積表彙總；逐層 0 不代表該層免計容積。" : "長條寬度表示樓板面積比例，不表示真實平面或高度。";
    }
    function edit() {
      var floor = draft.floors[selected], panel = q('.sm-floor-editor'); panel.replaceChildren(); if (!floor) return;
      var title = document.createElement('h3'); title.textContent = floor.樓層 + ' · 輸入'; panel.appendChild(title);
      ['樓板','計容積','梯廳','安全梯','陽台'].forEach(function (key) {
        var label = document.createElement('label'); label.textContent = key + '（㎡）'; var input = document.createElement('input'); input.type = 'number'; input.min = '0'; input.max = '100000'; input.step = '0.01'; input.required = true; input.value = floor[key] == null ? 0 : floor[key];
        input.addEventListener('input', function () { clear(); if (input.validity.valid) { floor[key] = input.valueAsNumber; draw(); } }); label.appendChild(input); panel.appendChild(label);
      });
    }
    q('.sm-generate').addEventListener('submit', function (e) {
      e.preventDefault(); var form = e.currentTarget; if (!form.reportValidity()) return;
      try { draft = generate(rec.engine, {levels:form.elements.levels.valueAsNumber, plate:form.elements.plate.valueAsNumber}); selected = 1; clear(); draw(); edit(); } catch (err) { status.textContent = err.message; }
    });
    q('[data-sm="reset"]').addEventListener('click', function () { draft = JSON.parse(JSON.stringify(rec.engine)); selected = 0; clear(); draw(); edit(); });
    q('[data-sm="run"]').addEventListener('click', async function () {
      if (Array.from(host.querySelectorAll('.sm-floor-editor input')).some(function (x) { return !x.reportValidity(); })) return;
      var rt = getRuntime(); if (!rt || !rt.ready) { status.textContent = "Core 尚未就緒，請稍後重試；草案仍保留。"; return; }
      var token = ++seq; q('[data-sm="run"]').disabled = true; status.textContent = "Core 容積與財務重算中";
      try {
        var response = await rt.recompute(draft); if (disposed || token !== seq) return;
        result = response.result; var keys = [['allow_floor_area','允建容積（㎡）'],['used_floor_area','計入容積（㎡）'],['remaining_floor_area','剩餘容積（㎡）'],['saleable_area','銷售坪數（坪）']];
        q('.sm-results').innerHTML = '<table><thead><tr><th>Core 指標</th><th>案件快照</th><th>本次草案</th></tr></thead><tbody>' + keys.map(function (pair) { return '<tr><th>'+pair[1]+'</th><td>'+fmt(rec.view && rec.view[pair[0]])+'</td><td>'+fmt(result[pair[0]])+'</td></tr>'; }).join('') + '</tbody></table>';
        q('.sm-warnings').textContent = (result.warnings || []).map(function (w) { return typeof w === 'string' ? w : w.message || w.msg || w.code || ''; }).join('；');
        status.textContent = '草案已重算 · core ' + result.core_version + ' · input ' + response.input_hash.replace(/^sha256:/,'').slice(0,12);
      } catch (err) { if (!disposed && token === seq) status.textContent = '重算失敗：' + err.message; }
      finally { if (!disposed && token === seq) q('[data-sm="run"]').disabled = false; }
    });
    var first = (draft.floors || []).find(function (f) { return /^\d+F$/.test(f.樓層); });
    if (first && typeof first.樓板 === 'number') q('[name="plate"]').value = first.樓板;
    q('[name="levels"]').value = Math.max(1, (draft.floors || []).filter(function (f) { return /^\d+F$/.test(f.樓層); }).length);
    draw(); edit();
    return {dispose:function () { disposed = true; seq++; }};
  }
  root.SiteMassing = {generate:generate, mount:mount};
})(typeof self !== 'undefined' ? self : this);
