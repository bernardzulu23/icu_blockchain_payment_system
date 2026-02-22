"""
Automated batch matching algorithm - matches student payments with bank transactions.
"""
import csv
import io
import re
from typing import Optional


def parse_payments_csv(content: bytes) -> list[dict]:
    """Parse payments CSV: studentId, studentName, amount, reference"""
    text = content.decode("utf-8")
    reader = csv.DictReader(io.StringIO(text))
    rows = []
    for row in reader:
        row_lower = {k.lower().strip(): v.strip() for k, v in row.items()}
        student_id = row_lower.get("studentid") or row_lower.get("student_id") or ""
        student_name = row_lower.get("studentname") or row_lower.get("student_name") or f"Student {student_id}"
        amount_str = row_lower.get("amount", "0")
        try:
            amount = float(amount_str.replace(",", ""))
        except ValueError:
            amount = 0.0
        reference = row_lower.get("reference") or row_lower.get("ref") or ""
        if student_id and amount > 0:
            rows.append({"studentId": student_id, "studentName": student_name, "amount": amount, "reference": reference})
    return rows


def extract_amounts_and_refs(text: str) -> set[tuple[float, str]]:
    """Extract (amount, reference) pairs from bank statement text."""
    pairs = set()
    amount_pattern = re.compile(r"(\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d+(?:\.\d{2})?)")
    ref_pattern = re.compile(r"\b([A-Z0-9]{6,24})\b")
    for line in text.split("\n"):
        amounts = amount_pattern.findall(line)
        refs = ref_pattern.findall(line)
        for amt_str in amounts:
            amt = float(amt_str.replace(",", ""))
            if 10 <= amt <= 1_000_000:
                for ref in refs:
                    if len(ref) >= 6:
                        pairs.add((round(amt, 2), ref))
    return pairs


def match_batch(payment_rows: list[dict], bank_text: str) -> dict:
    """Match payment rows against bank statement text."""
    bank_pairs = extract_amounts_and_refs(bank_text)
    seen = set()
    results = []
    matched = unmatched = duplicates = 0

    for p in payment_rows:
        key = f"{p['studentId']}-{p['amount']}-{p['reference']}"
        if key in seen:
            duplicates += 1
            results.append({**p, "status": "duplicate"})
            continue
        seen.add(key)

        amount_rounded = round(p["amount"], 2)
        ref_found = p["reference"] and p["reference"] in bank_text
        amount_found = (amount_rounded, p["reference"]) in bank_pairs
        amount_in_text = str(p["amount"]) in bank_text or str(amount_rounded) in bank_text

        if ref_found or amount_found or amount_in_text:
            matched += 1
            results.append({**p, "status": "matched"})
        else:
            unmatched += 1
            results.append({**p, "status": "unmatched"})

    return {
        "totalProcessed": len(payment_rows),
        "matched": matched,
        "unmatched": unmatched,
        "duplicates": duplicates,
        "results": results,
    }
