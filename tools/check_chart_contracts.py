# -*- coding: utf-8 -*-
"""Gate 16: validate Viewfinder contracts, bindings, and generated bundle."""
import copy
import json
import pathlib

from jsonschema import Draft7Validator

from build_chart_contracts import REGISTRY_PATH, ROOT, BUNDLE_PATH, render_bundle


SCHEMA_PATH = ROOT / "schemas" / "chart_contract.schema.v0.1.json"
BINDING_PATH = ROOT / "docs" / "architecture" / "UI_BINDING_MAP.md"


def validate_registry(registry: dict, schema: dict, binding_text: str) -> list[str]:
    errors = [f"schema: {e.message}" for e in Draft7Validator(schema).iter_errors(registry)]
    chart_ids = [c.get("chart_id") for c in registry.get("charts", [])]
    if len(chart_ids) != len(set(chart_ids)):
        errors.append("chart_id 必須唯一")
    for chart in registry.get("charts", []):
        series_ids = [s.get("series_id") for s in chart.get("series", [])]
        if len(series_ids) != len(set(series_ids)):
            errors.append(f"{chart.get('chart_id')}: series_id 必須唯一")
        if "higher_is_better" in chart:
            errors.append(f"{chart.get('chart_id')}: 不得複製 higher_is_better 常數")
        fields = [s.get("field") for s in chart.get("series", [])]
        fields += [s.get("unit_field") for s in chart.get("series", [])]
        fields += [chart.get("direction_field")]
        fields += [chart.get("uncertainty", {}).get("source_field")]
        fields += chart.get("evidence_fields", [])
        for field in filter(None, fields):
            if f"`{field}`" not in binding_text:
                errors.append(f"{chart.get('chart_id')}: UI_BINDING_MAP 缺 `{field}`")
    return errors


def selftest(schema: dict, binding_text: str, registry: dict) -> list[str]:
    failures = []
    if validate_registry(registry, schema, binding_text):
        failures.append("有效 registry 被拒絕")
    missing_guard = copy.deepcopy(registry)
    del missing_guard["charts"][0]["must_not_read_as"]
    if not validate_registry(missing_guard, schema, binding_text):
        failures.append("缺 must_not_read_as 未被攔截")
    editable = copy.deepcopy(registry)
    editable["charts"][0]["interaction"]["draggable"] = True
    if not validate_registry(editable, schema, binding_text):
        failures.append("draggable Output 未被攔截")
    unbound = copy.deepcopy(registry)
    unbound["charts"][0]["series"][0]["field"] = "presentation.not_authoritative"
    if not validate_registry(unbound, schema, binding_text):
        failures.append("未登記欄位未被攔截")
    return failures


def main() -> int:
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    registry = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    binding_text = BINDING_PATH.read_text(encoding="utf-8")
    failures = selftest(schema, binding_text, registry)
    failures += validate_registry(registry, schema, binding_text)
    expected_bundle = render_bundle(registry)
    if not BUNDLE_PATH.exists() or BUNDLE_PATH.read_text(encoding="utf-8") != expected_bundle:
        failures.append("chart-contracts.js 與 chart-contracts.json 不同步")
    if failures:
        for failure in failures:
            print(f"FAIL: {failure}")
        return 1
    print(
        f"Gate16 PASS: {len(registry['charts'])} chart contract validated; "
        "selftest, binding map, and bundle sync are clean"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
