"""Measure the frozen fixture matrix through real mTLS or an oracle adapter."""
import argparse
import asyncio
from datetime import date
import hashlib
import json
import math
from pathlib import Path
import time
from unittest.mock import AsyncMock, patch

from fixtures import CASES, make

from doc_verify import vision
from doc_verify.decoder import decode
from doc_verify.evidence import blank, canonical
from doc_verify.extraction import Extraction, extract
from doc_verify.models import Classification, DlExtract, PoaExtract, RuleInput
from doc_verify.rules import evaluate
from doc_verify.transport import model_pin


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


async def proposal(kind, fixture, mode):
    data = fixture["files"][kind]
    if data is None:
        return Extraction(blank(kind), {}, [f"{kind}_missing"])
    doc = await decode(data, "dl" if kind == "licence" else "poa")
    if mode == "live":
        return await extract(doc, kind)
    expected = fixture["fields"][kind]
    schema = DlExtract if kind == "licence" else PoaExtract
    key = "is_uk_driving_licence" if kind == "licence" else "is_proof_of_address_document"
    mock = AsyncMock(return_value=schema(readable=True, **{key: True}, **expected))
    with patch.object(vision, "classify", AsyncMock(return_value=Classification(kind=kind))), patch.object(
            vision, "read_dl" if kind == "licence" else "read_poa", mock):
        return await extract(doc, kind)


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=("oracle", "live"), required=True)
    parser.add_argument("--split", choices=("development", "holdout"), required=True)
    parser.add_argument("--case", choices=CASES, help="Single-case diagnostic, never a qualification")
    parser.add_argument("--gpu-name")
    parser.add_argument("--gpu-peak-mib", type=int)
    args = parser.parse_args()
    root = Path(__file__).parent
    criteria = json.loads((root / "criteria.json").read_text())
    model, pin = model_pin() if args.mode == "live" else ("oracle", None)
    print(json.dumps({"split": args.split, "mode": args.mode, "model": model, "digest": pin,
                      "criteria_sha256": digest(root / "criteria.json"),
                      "fixtures_sha256": digest(root / "fixtures.py")}), flush=True)
    cases = CASES if args.case is None else (args.case,)
    measurements = []
    field_totals = {}
    valid = rejections = required = reviews = supported = correct = unsupported = errors = 0
    for case in cases:
        fixture = make(args.split, case)
        observed = {}
        durations = {}
        for kind in ("licence", "proof"):
            begin = time.monotonic()
            try:
                observed[kind] = await proposal(kind, fixture, args.mode)
            except Exception:
                errors += 1
                observed[kind] = Extraction(blank(kind), {}, [f"{kind}_inference_failed"])
            if fixture["files"][kind] is not None:
                elapsed = time.monotonic() - begin
                measurements.append(elapsed)
                durations[kind] = round(elapsed, 3)
        reasons = [reason for row in observed.values() for reason in row.reasons]
        advisory = "review"
        if not reasons:
            profile = fixture["profile"]
            result = evaluate(RuleInput(today=date.fromisoformat(criteria["reference_date"]),
                                        profile_full_name=profile["name"], profile_postcode=profile["postcode"],
                                        profile_dob=date.fromisoformat(profile["dob"]), poa=observed["proof"].fields,
                                        dl=observed["licence"].fields))
            advisory, reasons = result.decision, result.reasons
        case_metrics = {"supported": 0, "correct": 0, "unsupported_non_null": 0}
        for kind, fields in fixture["fields"].items():
            for field, truth in fields.items():
                expected = canonical(field, truth)
                actual = canonical(field, getattr(observed[kind].fields, field, None))
                tally = field_totals.setdefault(f"{kind}.{field}", {"expected": 0, "correct": 0, "unsupported": 0})
                invented = actual is not None and (actual != expected or field not in observed[kind].locations)
                tally["unsupported"] += invented
                if expected is not None:
                    tally["expected"] += 1
                    tally["correct"] += actual == expected
                    case_metrics["supported"] += 1
                    case_metrics["correct"] += actual == expected
                case_metrics["unsupported_non_null"] += invented
        supported += case_metrics["supported"]
        correct += case_metrics["correct"]
        unsupported += case_metrics["unsupported_non_null"]
        valid += fixture["valid"]
        rejections += fixture["valid"] and advisory == "reject"
        required += fixture["uncertain"]
        reviews += fixture["uncertain"] and advisory == "review" and bool(reasons)
        print(json.dumps({"case": case, "advisory": advisory, "reasons": reasons, "document_seconds": durations, **case_metrics}), flush=True)
    p95 = sorted(measurements)[math.ceil(len(measurements) * 0.95) - 1]
    false_rejection = rejections / valid if valid else None
    review_rate = reviews / required if required else None
    field_accuracy = correct / supported if supported else None
    threshold = (
        field_accuracy is not None and field_accuracy >= criteria["min_exact_field_accuracy_per_model"]
        and false_rejection is not None and false_rejection <= criteria["max_false_rejection_rate_per_model"]
        and review_rate is not None and review_rate >= criteria["min_required_review_rate_per_model"]
        and unsupported <= criteria["max_unsupported_non_null_fields_per_model"]
        and p95 <= criteria["max_p95_document_seconds"] and errors == 0
    )
    qualified = (args.mode == "live" and args.split == "holdout" and args.case is None and threshold
                 and args.gpu_name == criteria["required_gpu"] and args.gpu_peak_mib is not None
                 and 0 < args.gpu_peak_mib <= criteria["max_gpu_memory_mib"])
    print(json.dumps({"case_count": len(cases), "exact_field_accuracy": field_accuracy, "correct_fields": correct,
                      "expected_fields": supported, "unsupported_non_null": unsupported,
                      "false_rejection_rate": false_rejection, "required_review_rate": review_rate,
                      "inference_errors": errors, "p95_document_seconds": round(p95, 3),
                      "gpu_peak_mib": args.gpu_peak_mib, "by_field": field_totals, "metrics_pass": threshold, "qualified": qualified}), flush=True)
    if args.mode == "live" and args.split == "holdout" and not qualified:
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
