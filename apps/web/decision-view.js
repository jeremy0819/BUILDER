/* Decision relationship view: selectable evidence, read-only authoritative values. */
(function (root) {
  "use strict";

  function raw(obj, key) { return obj && obj[key] != null ? obj[key] : null; }
  function buildModel(rec) {
    var view = (rec && rec.view) || {}, snap = (rec && rec.snap) || {}, decision = (rec && rec.decision) || null;
    return {
      center: {
        label: "Decision Engine",
        value: decision ? raw(decision, "verdict") : "待判讀",
        completion_probability: decision ? raw(decision, "completion_probability") : null,
        source: decision ? "Decision Engine" : "等待權威輸出"
      },
      nodes: [
        {
          id: "site", title: "量體", source: "Core",
          primary: { label: "容積餘量", value: raw(view, "remaining_floor_area"), unit: "㎡" },
          evidence: [
            { label: "允建容積", value: raw(view, "allow_floor_area"), unit: "㎡" },
            { label: "使用容積", value: raw(view, "used_floor_area"), unit: "㎡" },
            { label: "容積餘量", value: raw(view, "remaining_floor_area"), unit: "㎡" }
          ]
        },
        {
          id: "product", title: "財務", source: "Core",
          primary: { label: "全案投報率", value: raw(view, "return_rate"), unit: "ratio" },
          evidence: [
            { label: "銷售坪數", value: raw(view, "saleable_area"), unit: "坪" },
            { label: "共同負擔比", value: raw(view, "shared_cost_ratio"), unit: "ratio" },
            { label: "地主分回比", value: raw(view, "owner_return_ratio"), unit: "ratio" },
            { label: "全案投報率", value: raw(view, "return_rate"), unit: "ratio" }
          ]
        },
        {
          id: "people", title: "人心", source: "Workflow",
          primary: { label: "同意戶數", value: [raw(snap, "agreed"), raw(snap, "total")], unit: "fraction" },
          evidence: [
            { label: "已同意", value: raw(snap, "agreed"), unit: "戶" },
            { label: "權變戶數", value: raw(snap, "total"), unit: "戶" },
            { label: "同意門檻", value: raw(snap, "threshold"), unit: "ratio" }
          ]
        },
        {
          id: "decision", title: "判讀", source: "Decision Engine",
          primary: { label: "判定", value: decision ? raw(decision, "verdict") : null, unit: "text" },
          evidence: [
            { label: "判定", value: decision ? raw(decision, "verdict") : null, unit: "text" },
            { label: "完工機率", value: decision ? raw(decision, "completion_probability") : null, unit: "ratio" },
            { label: "決策急迫度", value: decision ? raw(decision, "decision_urgency") : null, unit: "ratio" },
            { label: "破局引爆點", value: decision ? raw(decision, "breakpoint_stakeholder") : null, unit: "text" }
          ]
        }
      ],
      provenance: {
        input_hash: raw(snap, "input_hash"), core_version: raw(snap, "core_version"),
        decision_engine_version: decision ? raw(decision, "decision_engine_version") : null
      }
    };
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function format(item) {
    if (!item || item.value == null) return "—";
    if (item.unit === "fraction") {
      var pair = item.value || [];
      return (pair[0] == null ? "—" : pair[0]) + "/" + (pair[1] == null ? "—" : pair[1]) + " 戶";
    }
    if (item.unit === "ratio") return (Number(item.value) * 100).toFixed(1) + "%";
    if (typeof item.value === "number") return item.value.toLocaleString("en-US", { maximumFractionDigits: 1 }) + (item.unit ? " " + item.unit : "");
    return String(item.value);
  }
  function nodeHtml(node) {
    return '<button type="button" class="decision-node" data-node="' + node.id + '" aria-pressed="false">'
      + '<small>' + esc(node.title) + " · " + esc(node.source) + '</small><strong>' + esc(format(node.primary))
      + '</strong><em>' + esc(node.primary.label) + "</em></button>";
  }
  function evidenceHtml(node, provenance) {
    return '<h3>' + esc(node.title) + '</h3><div class="decision-evidence-sub">來源：' + esc(node.source) + "</div>"
      + node.evidence.map(function (item) {
        return '<div class="decision-evidence-row"><span>' + esc(item.label) + '</span><b>' + esc(format(item)) + "</b></div>";
      }).join("")
      + '<div class="decision-evidence-note">互動只切換證據，不修改或反算任何結果。<br>input '
      + esc(String(provenance.input_hash || "").replace(/^sha256:/, "").slice(0, 10) || "—") + " · core "
      + esc(provenance.core_version || "—") + "</div>";
  }
  function mount(container, rec) {
    if (!container) return null;
    var model = buildModel(rec), preferred = model.nodes[3];
    var completion = model.center.completion_probability == null ? "" : " · 完工機率 "
      + (Number(model.center.completion_probability) * 100).toFixed(1) + "%";
    container.innerHTML = '<div class="uros-decision-layout"><div class="decision-map" role="group" aria-label="決策關聯圖">'
      + '<svg class="decision-map-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">'
      + '<path d="M50 50 L20 20 M50 50 L80 20 M50 50 L20 80 M50 50 L80 80"></path></svg>'
      + '<div class="decision-hub"><div><span>' + esc(model.center.label) + '</span><b>' + esc(model.center.value || "—")
      + '</b><span>' + esc(model.center.source + completion) + "</span></div></div>"
      + model.nodes.map(nodeHtml).join("") + '</div><aside class="decision-evidence" aria-live="polite"></aside></div>';
    var evidence = container.querySelector(".decision-evidence");
    function select(node) {
      Array.prototype.forEach.call(container.querySelectorAll(".decision-node"), function (button) {
        button.setAttribute("aria-pressed", String(button.getAttribute("data-node") === node.id));
      });
      evidence.innerHTML = evidenceHtml(node, model.provenance);
    }
    Array.prototype.forEach.call(container.querySelectorAll(".decision-node"), function (button) {
      button.addEventListener("click", function () {
        var id = button.getAttribute("data-node");
        select(model.nodes.filter(function (node) { return node.id === id; })[0]);
      });
    });
    select(preferred);
    return model;
  }

  var api = { buildModel: buildModel, format: format, mount: mount };
  root.DecisionView = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof self !== "undefined" ? self : this);
