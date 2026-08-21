# -*- coding: utf-8 -*-
"""
tools/check_schema_freeze.py — Schema 凍結守衛（M2 close）
==========================================================
凍結中的合約 schema「內容不可變」（紅線）。本檢查對每個凍結檔算 **canonical-LF**
sha256（CRLF 先正規化為 LF），與下方基準比對；任何內容變動即 Fail，擋 merge。

為何是 canonical-LF 而非 raw bytes：Git 在 Windows 的 checkout 會把 LF 轉成 CRLF，
raw byte 比對會在該環境產生**假性失敗**。正規化只吸收換行差異，
JSON 語意零影響；任何實質內容變動仍照擋。
（導入時 18 個既有基準值皆未變動——repo 內檔案本就是 LF。）

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
    "schemas/workflow_schema_v1_1.json":
        "39e7e88e9278abdc72fca86415517a1f626b02ca419eddb8e28bf1eae9ba890f",  # wf-1.1（M5.5-A：stakeholder 可簽性軸）
    "schemas/decision.schema.v0.1.json":
        "7a30ab80a9d6dfb9f22a60557ddd645a0ccc2ac73204bf15841a13fab393fdde",  # decision v0.1（M4）
    "schemas/decision.schema.v0.2.json":
        "16a1a995db88c1d003d386d917c6378b62ef8b53ee4c1c829e6ed99813a3db69",  # decision v0.2（N1：溯源二元組 input_hash × core_version）
    "schemas/household_outcome.schema.v0.1.json":
        "1866452b508c7d9f4bd5b53c044b22ead2d690f7ac8beac25fde98fe50ad0e8d",  # household_outcome v0.1（M5.5 傳動軸）
    "schemas/stakeholder_profile.schema.v0.1.json":
        "d68e5ec52d0cb865cc690073aeada1fd9b319004fb5fe3e0f86d4c694f6f0e2b",  # stakeholder_profile v0.1（M6 分型輸入）
    "schemas/activity.schema.v0.1.json":
        "04f487db779564ed7359c4e289a5ecb78b22fbc1e3a53ed2cd6fe1a5b73163fa",  # activity v0.1（M7.1 Memory：Activity/Session/History）
    "schemas/milestone.schema.v0.1.json":
        "ab3edbab1bdfae6e0b0c4454fb40393d8f38a127b7983e25c84079d8eb692858",  # milestone v0.1（M7.2 Watchtower：statute 必附法源）
    "schemas/stakeholder_profile.schema.v0.2.json":
        "05d1b82a1d7ee9fe985e68150b2046a9a9254ca7acdb3175e8539a379f048583",  # 分型輸入 v0.2（M6：+錨定型）
    "schemas/strategy.schema.v0.2.json":
        "016eda3f8e95af8913b82d467b098a1d008c128a245b2d2e0b9f09c8db9fd5b3",  # 策略輸出 v0.2（M6：+錨定型對策）
    "schemas/strategy.schema.v0.1.json":
        "8821db932a83fd4ac6d457f6ae1a8f19b691a1f071084a883769895c1c9b0bd1",  # strategy v0.1（M6 THE STRATEGIST 輸出）
    "schemas/scenario.schema.v0.1.json":
        "05534522b8b5a67ea6a2705c1c060fc1aa08c8544a321a8d11014378998fca3c",  # scenario v0.1（M7.3 多方案管理）
    "schemas/attribution.schema.v0.1.json":
        "87def91e01a079a68157c08fd4b011d6efbd5fc37a8192447c8b62a613634dec",  # attribution v0.1（M7.4 加總守恆歸因）
    "schemas/chart_contract.schema.v0.1.json":
        "13c5d7cb066c17918af42648fb25bbccc8cd1f655c4efcef413f16277a4bdf95",  # chart contract v0.1（M8.1 視覺契約）
}


def _frozen_digest(path: pathlib.Path) -> str:
    """Hash canonical LF bytes so Git's Windows checkout mode cannot alter the result."""
    canonical = path.read_bytes().replace(b"\r\n", b"\n")
    return hashlib.sha256(canonical).hexdigest()


def main() -> int:
    壞 = []
    for 相對, 基準 in FROZEN.items():
        p = 根 / 相對
        if not p.exists():
            壞.append(f"❌ 缺檔：{相對}")
            continue
        實際 = _frozen_digest(p)
        if 實際 != 基準:
            壞.append(f"❌ {相對} 正規化 LF 後內容已變（凍結違規）\n     基準 {基準}\n     實際 {實際}")
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
