"""
ICU Payment Batch Matching Service
Uses pdfplumber, pandas, and optional Tesseract OCR for bank statement parsing.
"""
import io
import csv
import re
from typing import Optional

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="ICU Batch Matching Service")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"])


def parse_payments_csv(content: bytes) -> list[dict]:
    """Parse payments CSV: studentId, studentName, amount, reference"""
    text = content.decode("utf-8")
    reader = csv.DictReader(io.StringIO(text))
    rows = []
    for row in reader:
        # Normalize keys
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
            rows.append({
                "studentId": student_id,
                "studentName": student_name,
                "amount": amount,
                "reference": reference,
            })
    return rows


def extract_from_pdf(content: bytes) -> str:
    """Extract text from PDF using pdfplumber."""
    try:
        import pdfplumber
    except ImportError:
        raise HTTPException(500, "pdfplumber not installed")
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        text_parts = []
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                text_parts.append(t)
        return "\n".join(text_parts)


def extract_from_csv(content: bytes) -> str:
    """Extract relevant text from bank statement CSV."""
    return content.decode("utf-8", errors="ignore")


def extract_amounts_and_refs(text: str) -> set[tuple[float, str]]:
    """Extract (amount, reference) pairs from bank statement text."""
    pairs: set[tuple[float, str]] = set()
    # Match amounts like 1500.00, 1,500.00, 1500
    amount_pattern = re.compile(r"(\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d+(?:\.\d{2})?)")
    # Match references (alphanumeric 6-24 chars)
    ref_pattern = re.compile(r"\b([A-Z0-9]{6,24})\b")
    lines = text.split("\n")
    for line in lines:
        amounts = amount_pattern.findall(line)
        refs = ref_pattern.findall(line)
        for amt_str in amounts:
            amt = float(amt_str.replace(",", ""))
            if 10 <= amt <= 1_000_000:  # Reasonable payment range
                for ref in refs:
                    if len(ref) >= 6:
                        pairs.add((round(amt, 2), ref))
    return pairs


@app.post("/batch/match")
async def batch_match(
    payments: UploadFile = File(None),
    bank: Optional[UploadFile] = File(None),
    bankStatement: Optional[UploadFile] = File(None),
):
    """Match student payments against bank statement."""
    if not payments:
        raise HTTPException(400, "payments file required")
    bank_file = bank or bankStatement
    if not bank_file:
        raise HTTPException(400, "bank statement file required")
    payments_content = await payments.read()
    bank_content = await bank_file.read()
    bank_mime = bank.content_type or ""

    payment_rows = parse_payments_csv(payments_content)
    if not payment_rows:
        raise HTTPException(400, "No valid payment rows in CSV")

    if "pdf" in bank_mime:
        bank_text = extract_from_pdf(bank_content)
    else:
        bank_text = extract_from_csv(bank_content)

    bank_pairs = extract_amounts_and_refs(bank_text)
    seen: set[str] = set()
    results = []
    matched = 0
    unmatched = 0
    duplicates = 0

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


@app.get("/health")
def health():
    return {"status": "ok"}
