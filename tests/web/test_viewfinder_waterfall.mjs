// Gate 17 — M8.2 Viewfinder attribution waterfall.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
let pass = 0, fail = 0;
const ok = (condition, name) => {
  if (condition) pass++;
  else { fail++; console.error("FAIL", name); }
};

function loadCommonJs(path) {
  const source = readFileSync(path, "utf8");
  const module = { exports: {} };
  new Function("module", "exports", "self", source)(module, module.exports, {});
  return { api: module.exports, source };
}

const registryBundle = loadCommonJs(join(root, "apps/web/chart-contracts.js"));
const waterfallBundle = loadCommonJs(join(root, "apps/web/attribution-waterfall.js"));
const contracts = registryBundle.api;
const waterfall = waterfallBundle.api;
const source = waterfallBundle.source;
const workspace = readFileSync(join(root, "apps/web/workspace.html"), "utf8");
const contract = contracts.get("attribution-waterfall");

const hashA = "sha256:" + "a".repeat(64);
const hashB = "sha256:" + "b".repeat(64);
const exactReport = {
  schema_version: "attribution-0.1", status: "ok", core_version: "0.5.0",
  target: { id: "return_rate", label: "全案投報率", raw_unit: "ratio", display_unit: "percentage_points", higher_is_better: true },
  before: { input_hash: hashA, value: 0.515 }, after: { input_hash: hashB, value: 0.5694 }, delta: 0.0544,
  contributions: [
    { feature_id: "params.住宅單價", label: "住宅單價", before_value: 65, after_value: 68.25, impact: 0.0571 },
    { feature_id: "params.車位數", label: "車位數", before_value: 78, after_value: 76, impact: -0.0027 }
  ],
  residual: { impact: 0, kind: "numeric" },
  method: { requested: "auto", resolved: "shapley", feature_count: 2, runs: 4, exact: true },
  conservation: { tolerance: 1e-9, raw_ok: true },
  presentation: {
    precision: 2, before: 51.5, after: 56.94, delta: 5.44,
    contributions: [
      { feature_id: "params.住宅單價", impact: 5.71 },
      { feature_id: "params.車位數", impact: -0.27 }
    ],
    residual: 0, rounding_reconciliation: 0, display_ok: true
  }
};

// Contract and binding are the runtime authority.
ok(contract && contract.source === "attribution-0.1", "loads the frozen attribution contract");
ok(contract.direction_field === "target.higher_is_better", "direction binds the Core target field");
ok(contract.interaction.selectable && !contract.interaction.editable && !contract.interaction.draggable,
  "output interaction is selectable and read-only");
ok(contract.unit_label === "ppt" && contract.endpoint_unit_label === "%", "unit labels come from the contract");
ok(contract.must_not_read_as.includes("變更時序") && contract.must_not_read_as.includes("IRR"),
  "contract carries the two critical misreading guards");

// Model preserves every visible domain value from Core presentation.
const model = waterfall.buildModel(exactReport, contract);
ok(model.before === "51.50" && model.after === "56.94" && model.delta === "+5.44", "endpoint and delta text preserve presentation values");
ok(model.features[0].display === "+5.71" && model.features[1].display === "-0.27", "contribution text preserves presentation impacts");
ok(model.features[0].beforeValue === 65 && model.features[0].afterValue === 68.25, "evidence preserves raw before and after values");
ok(model.rows.some(row => row.id === "residual" && row.display === "0.00"), "zero residual remains a first-class row");
ok(!model.rows.some(row => row.id === "reconciliation"), "zero reconciliation is omitted without merging into residual");
ok(model.uncertainty.level === "calibrated" && model.uncertainty.label === "Shapley 精確", "exact state is contract-driven");
ok(model.features[0].effect === "改善" && model.features[1].effect === "不利", "good/bad direction follows higher_is_better");

const reverseDirection = JSON.parse(JSON.stringify(exactReport));
reverseDirection.target.higher_is_better = false;
const reverseModel = waterfall.buildModel(reverseDirection, contract);
ok(reverseModel.features[0].effect === "不利" && reverseModel.features[1].effect === "改善", "direction is not hard-coded to positive-is-good");

const oatReport = JSON.parse(JSON.stringify(exactReport));
oatReport.method = { requested: "auto", resolved: "oat", feature_count: 2, runs: 3, exact: false };
oatReport.presentation.residual = -0.02;
oatReport.presentation.rounding_reconciliation = 0.02;
const oatModel = waterfall.buildModel(oatReport, contract);
ok(oatModel.uncertainty.level === "directional" && oatModel.uncertainty.label === "OAT 近似", "OAT stays visibly directional");
ok(oatModel.rows.some(row => row.id === "residual" && row.display === "-0.02"), "OAT residual remains visible");
ok(oatModel.rows.some(row => row.id === "reconciliation" && row.display === "+0.02"), "non-zero reconciliation gets its own row");

// Rendering and accessibility.
const html = waterfall.render(exactReport, contract);
ok(/<figure[^>]+aria-labelledby="wf-title"/.test(html), "chart has an accessible figure name");
ok((html.match(/<button type="button" class="wf-mark"/g) || []).length === model.rows.length, "every plotted point is a native keyboard button");
ok(/aria-pressed="false"/.test(html), "selectable points expose state");
ok(/交互作用（殘差）/.test(html), "residual is visible in the chart");
ok(/wf-residual wf-zero/.test(html), "residual keeps a distinct visual class even when zero");
ok(/不可解讀為/.test(html) && /模型外的因果證明/.test(html), "misreading guards render visibly");
ok(/Core presentation/.test(html), "chart identifies its presentation source");
ok(!/排序.*時序/.test(html), "chart does not imply chronological sequencing");

const emptyReport = JSON.parse(JSON.stringify(exactReport));
emptyReport.contributions = [];
emptyReport.presentation.contributions = [];
const emptyHtml = waterfall.render(emptyReport, contract);
ok(/沒有可歸因變更/.test(emptyHtml) && emptyHtml.includes(contract.empty_reason), "zero-change state explains why there is no chart");
ok(/wf-residual wf-adverse/.test(waterfall.render(oatReport, contract)), "non-zero residual is not styled as an ordinary contribution");

// Static and architectural purity. toFixed is permitted only for CSS geometry.
ok(!/CaseStore|createCoreRuntime|\.attribute\(/.test(source), "view module has no persistence or Core transport dependency");
ok(!/draggable\s*=|dragstart|dragover|drop/.test(source), "output has no drag path");
ok(!/return_rate\s*[+\-*/]|shared_cost|floor_area|profit|revenue/.test(source), "view module contains no domain formula");
const fixedLines = source.split("\n").filter(line => line.includes(".toFixed("));
ok(fixedLines.length === 2 && fixedLines.every(line => /row\.(anchor|left|width)/.test(line)), "numeric rounding is limited to CSS geometry");
ok(/attribution-0\.1 未提供法源欄位/.test(source), "evidence explicitly refuses to invent a legal source");
ok(/pointerenter/.test(source) && /addEventListener\("focus"/.test(source), "hover and focus select the same evidence");

// Workspace wiring and responsive states.
ok(workspace.indexOf('src="chart-contracts.js"') < workspace.indexOf('src="attribution-waterfall.js"'), "contract loads before the chart module");
ok(/AttributionWaterfall\.render\(r, contract\)/.test(workspace), "workspace renders through the governed module");
ok(/AttributionWaterfall\.bind\(\$\("atBody"\), ATTR\.report, contract\)/.test(workspace), "workspace binds chart interaction after paint");
const attributionBlock = workspace.slice(workspace.indexOf("var ATTR ="), workspace.indexOf("function renderMassing"));
ok(!/\.toFixed\(/.test(attributionBlock), "attribution UI never rounds Core presentation again");
ok(/p\.display_ok/.test(attributionBlock) && /r\.conservation\.raw_ok/.test(attributionBlock), "visible reconciliation status uses both Core flags");
ok(/@media\(max-width:600px\)/.test(workspace) && /wf-layout\{grid-template-columns:1fr\}/.test(workspace), "narrow layout has explicit constraints");
ok(/方案已變更，請按「計算歸因」重新執行/.test(workspace), "stale state remains visible");
ok(/Core 正在執行反事實重算/.test(workspace), "computing state remains visible");
ok(/正在載入計算核心/.test(workspace) && /!ATTR\.coreReady/.test(workspace), "Core readiness is a visible disabled state");
ok(/這組比較不在首版歸因範圍/.test(workspace), "unsupported state remains visible");
ok(/計算核心無法載入/.test(workspace), "Core failure state remains visible");
ok(/兩個完整方案/.test(workspace), "insufficient-scenarios state remains visible");
ok(!/https?:\/\//.test(source), "view module makes no external request");

console.log(`\nM8.2 VIEWFINDER WATERFALL headless: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
