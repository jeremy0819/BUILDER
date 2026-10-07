"""M9 candidate evidence must retain type, origin, and verification boundaries."""
import copy
import json
from pathlib import Path
import subprocess

import jsonschema
import pytest


ROOT = Path(__file__).resolve().parents[1]
SCHEMA = json.loads((ROOT / "schemas/evidence_fact.schema.v0.1.json").read_text(encoding="utf-8"))
VALIDATOR = jsonschema.Draft7Validator(SCHEMA, format_checker=jsonschema.FormatChecker())


def fact(kind="observed"):
    return {
        "schema_version": "evidence-fact-0.1", "fact_id": "f-synthetic-1",
        "case_id": "case-synthetic", "subject": {"kind": "case", "id": "case-synthetic"},
        "field": "基地面積", "value": "860", "unit": None,
        "evidence_type": kind, "source": {"label": "合成測試文件", "version": None},
        "observed_at": "2026-10-01" if kind == "observed" else None,
        "valid_from": None, "valid_until": None, "confidence": "unknown",
        "recorded_at": "2026-10-06T00:00:00.000Z",
        "model_version": None, "parameter_version": None,
        "supporting_fact_ids": [], "evidence_snapshot_hash": None,
        "verification_status": "unverified",
    }


def test_schema_is_valid_and_manual_types_remain_unverified():
    jsonschema.Draft7Validator.check_schema(SCHEMA)
    VALIDATOR.validate(fact())
    VALIDATOR.validate(fact("assumed"))


@pytest.mark.parametrize("change", [
    {"evidence_type": "observed", "observed_at": None},
    {"evidence_type": "assumed", "observed_at": "2026-10-01"},
    {"evidence_type": "inferred"},
    {"evidence_type": "calibrated"},
    {"verification_status": "verified"},
    {"recorded_at": "not-a-date"},
    {"confidence": 0.9},
])
def test_unfounded_authority_is_rejected(change):
    candidate = fact("assumed")
    candidate.update(change)
    assert not VALIDATOR.is_valid(candidate)


def test_inference_and_calibration_need_lineage():
    inferred = fact("inferred")
    inferred.update(model_version="synthetic-model-1", supporting_fact_ids=["f-source"])
    VALIDATOR.validate(inferred)
    calibrated = copy.deepcopy(inferred)
    calibrated.update(evidence_type="calibrated", parameter_version="synthetic-params-1",
                      evidence_snapshot_hash="sha256:" + "a" * 64)
    VALIDATOR.validate(calibrated)
    calibrated["evidence_snapshot_hash"] = None
    assert not VALIDATOR.is_valid(calibrated)


def test_browser_created_fact_matches_the_versioned_schema():
    script = (
        "const L=require('./apps/web/evidence-ledger.js');"
        "const r={pid:'case-synthetic'};"
        "const f=L.caseFact(r,{field:'基地面積',value:'860',source:'合成測試文件',"
        "evidence_type:'observed',observed_at:'2026-10-01',confidence:'unknown'},"
        "'f-synthetic-2','2026-10-06T00:00:00.000Z');"
        "process.stdout.write(JSON.stringify(f));"
    )
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, encoding="utf-8",
                            capture_output=True, check=True)
    VALIDATOR.validate(json.loads(result.stdout))
