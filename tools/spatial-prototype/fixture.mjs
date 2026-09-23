// Explicit synthetic geometry, never derived from area, floors, or a real case.
export const fixture = {
  schema_version: "spatial-prototype-0.1",
  case_id: null, scenario_id: null, input_hash: null, core_version: null,
  geometry_source: "synthetic", geometry_source_version: "demo-1",
  unit: "m", coordinate_system: "LOCAL_DEMO_XZ_Y_UP",
  generated_at: "2026-09-23T00:00:00Z",
  site: {id: "demo-site", boundary: [[-22,-18],[18,-18],[24,-6],[20,19],[-22,19]]},
  buildings: [{id: "demo-building", footprint: [[-10,-8],[9,-8],[9,7],[-10,7]], height: 26}]
};

export function canonical(value) {
  if (typeof value === "number" && !Number.isFinite(value)) throw Error("Non-finite geometry");
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.keys(value).sort().map(k => JSON.stringify(k)+":"+canonical(value[k])).join(",") + "}";
  return JSON.stringify(value);
}

export function geometryPayload(value) {
  return {unit:value.unit,coordinate_system:value.coordinate_system,site:value.site,buildings:value.buildings};
}

export async function geometryHash(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(geometryPayload(value))));
  return "sha256:" + Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2,"0")).join("");
}

export function validateDemo(value) {
  if (value.geometry_source !== "synthetic" || value.case_id !== null || value.input_hash !== null || value.core_version !== null || value.scenario_id !== null) throw Error("Synthetic data only");
  if (value.schema_version !== "spatial-prototype-0.1" || value.unit !== "m" || value.coordinate_system !== "LOCAL_DEMO_XZ_Y_UP") throw Error("Unsupported prototype contract");
  if (!value.geometry_source_version || !value.generated_at || !value.site?.id || value.buildings?.length !== 1) throw Error("Incomplete prototype geometry");
  const polygon = points => Array.isArray(points) && points.length >= 3 && points.length <= 32 && points.every(p => Array.isArray(p) && p.length === 2 && p.every(n => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= 100));
  if (!polygon(value.site.boundary)) throw Error("Missing site geometry");
  for (const b of value.buildings) if (!b.id || !polygon(b.footprint) || !Number.isFinite(b.height) || b.height <= 0 || b.height > 100) throw Error("Missing building geometry");
  return value;
}
