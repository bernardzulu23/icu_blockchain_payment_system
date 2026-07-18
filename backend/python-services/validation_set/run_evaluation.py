"""
Evaluate OCR field extraction against labeled validation set.
Computes per-field and aggregate precision, recall, F1.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from ocr_pipeline.extractor import extract_deposit_slip  # noqa: E402

FIELDS = ("student_id", "amount", "date", "batch_reference")


def _norm_student(val: str, bank: str) -> str:
    s = str(val or "").upper().replace("STU-", "").replace("ICU", "").strip()
    return s.lstrip("0") or s


def _norm_batch(val: str) -> str:
    s = str(val or "").upper()
    for p in ("TXN", "REF", "BATCH", "BN", "ZANACO", "FNB"):
        if s.startswith(p):
            s = s[len(p) :]
    return s.replace(" ", "").lstrip("0")


def _field_match(field: str, expected: dict, predicted: dict, bank: str) -> bool:
    exp = expected.get(field if field != "batch_reference" else "batch_reference")
    pred = predicted.get(field)
    if field == "student_id":
        return _norm_student(str(exp), bank) == _norm_student(str(pred or ""), bank)
    if field == "amount":
        try:
            return abs(float(exp) - float(pred or 0)) < 0.01
        except (TypeError, ValueError):
            return False
    if field == "date":
        return str(exp or "")[:10] == str(pred or "")[:10]
    if field == "batch_reference":
        return _norm_batch(str(exp)) == _norm_batch(str(pred or ""))
    return False


def evaluate(labels_path: Path | None = None) -> dict:
    base = labels_path.parent if labels_path else Path(__file__).resolve().parent
    labels_file = labels_path or base / "labels.json"
    if not labels_file.exists():
        raise FileNotFoundError(f"Run generate_samples.py first — missing {labels_file}")

    with open(labels_file, encoding="utf-8") as f:
        labels = json.load(f)

    stats = {f: {"tp": 0, "fp": 0, "fn": 0} for f in FIELDS}
    per_sample = []
    manual_flags = 0

    for item in labels:
        img_path = base / item["file"]
        with open(img_path, "rb") as f:
            content = f.read()
        pred = extract_deposit_slip(content, img_path.name, bank_hint=item["bank"])
        if pred.get("needs_manual_entry"):
            manual_flags += 1

        sample_result = {"file": item["file"], "predicted": pred, "expected": item, "fields": {}}
        for field in FIELDS:
            exp_present = item.get(field if field != "batch_reference" else "batch_reference") is not None
            pred_present = pred.get(field) is not None and pred.get(field) != ""
            correct = _field_match(field, item, pred, item["bank"])

            if correct:
                stats[field]["tp"] += 1
            else:
                if pred_present:
                    stats[field]["fp"] += 1
                if exp_present:
                    stats[field]["fn"] += 1
            sample_result["fields"][field] = correct
        per_sample.append(sample_result)

    def prf(s):
        p = s["tp"] / (s["tp"] + s["fp"]) if (s["tp"] + s["fp"]) else 0.0
        r = s["tp"] / (s["tp"] + s["fn"]) if (s["tp"] + s["fn"]) else 0.0
        f1 = 2 * p * r / (p + r) if (p + r) else 0.0
        return {"precision": round(p, 4), "recall": round(r, 4), "f1": round(f1, 4), **s}

    field_metrics = {f: prf(stats[f]) for f in FIELDS}
    macro_f1 = sum(field_metrics[f]["f1"] for f in FIELDS) / len(FIELDS)

    report = {
        "samples_evaluated": len(labels),
        "manual_flag_rate": round(manual_flags / len(labels), 4) if labels else 0,
        "field_metrics": field_metrics,
        "macro_f1": round(macro_f1, 4),
        "meets_95_target": macro_f1 >= 0.95,
        "per_sample": per_sample,
    }

    report_path = base / "evaluation_report.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    report["report_path"] = str(report_path)
    return report


if __name__ == "__main__":
    result = evaluate()
    print(json.dumps({k: v for k, v in result.items() if k != "per_sample"}, indent=2))
