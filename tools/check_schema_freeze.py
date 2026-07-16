# -*- coding: utf-8 -*-
"""
tools/check_schema_freeze.py — Schema 凍結守衛（M2 close）
==========================================================
凍結中的合約 schema「位元組不可變」（紅線）。本檢查對每個凍結檔算 sha256，
與下方基準比對；任何一位元組變動即 Fail，擋 merge。

要合法變更凍結 schema：走版本升級流程（新檔 + 新 schema_version + 遷移器 + 更新此表），
而非直接改凍結檔。基準記錄同時抄錄於 governance/VERSION_POLICY.md 與
docs/releases/CHECKLIST.md，三處必須一致。
"""
import hashlib
import pathlib
import sys

根 = pathlib.Path(__file__).resolve().parents[1]

# 凍結基準（檔 → sha256）。變更凍結檔＝改這裡＝需 repo 擁有者核准（🔴）。
FROZEN = {
    "schemas/project_schema.json":
        "e37e10dbe19f5bbf51234a12fa8e60af34d4c854ac05566aa3e87f7d35bd4a96",  # v1.1
    "schemas/project_schema_v2.json":
        "f1c466a3162655634baf19973dcb061a8e64643d08302a1dc3f6cdd0df38e6b1",  # v2.0
    "schemas/project_schema_v2_1.json":
        "20405192063c367614f5b64faaae194d58adb416b43b8780140710dc6919d344",  # v2.1（M3）
    "schemas/v2/input.schema.json":
        "b420313ed74305b13d10d3a1a27d1795b0ab211dd2756f45355dd633a8a19ae2",
    "schemas/v2/output.schema.json":
        "1d5445f8afecb6fb49276842d5022e24c1f8489f088578a7924e20630fe547f3",
    "schemas/v2/metadata.schema.json":
        "6bb6694a88f911cb9bf184e381784e821dfb97c053e400bc81c89cb25768348d",
    "schemas/workflow_schema.json":
        "1328690f7783b273fee6b3ebaff6fbd7c678e87deb22eb7fc0e2dda7cd5f8324",  # wf-1.0（M3-C）
    "schemas/decision.schema.v0.1.json":
        "7a30ab80a9d6dfb9f22a60557ddd645a0ccc2ac73204bf15841a13fab393fdde",  # decision v0.1（M4）
}


def main() -> int:
    壞 = []
    for 相對, 基準 in FROZEN.items():
        p = 根 / 相對
        if not p.exists():
            壞.append(f"❌ 缺檔：{相對}")
            continue
        實際 = hashlib.sha256(p.read_bytes()).hexdigest()
        if 實際 != 基準:
            壞.append(f"❌ {相對} 位元組已變（凍結違規）\n     基準 {基準}\n     實際 {實際}")
        else:
            print(f"✓ frozen {相對}")
    if 壞:
        print("\n".join(壞))
        print("\nSchema 凍結違規：要改凍結合約請走版本升級流程，勿直接改檔。")
        return 1
    print(f"\nSchema 凍結守衛：{len(FROZEN)} 檔全部相符。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
