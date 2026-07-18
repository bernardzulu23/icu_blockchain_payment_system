"""
ICU Payment System - Automated Batch Matching Service
Matches student payments with bank transactions using advanced algorithms.
Provides /extract-transactions and /match-payments for the accountant flow.
"""

import os
import re
from datetime import datetime
from difflib import SequenceMatcher

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    HAS_PSYCOPG2 = True
except ImportError:
    HAS_PSYCOPG2 = False

try:
    import pdfplumber
    HAS_PDFPLUMBER = True
except ImportError:
    HAS_PDFPLUMBER = False


# Database configuration
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", "5432")),
    "database": os.getenv("DB_NAME", "icu_payments"),
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", ""),
}


def get_db_connection():
    """Create database connection."""
    if not HAS_PSYCOPG2:
        raise ImportError("psycopg2 required - pip install psycopg2-binary")
    return psycopg2.connect(**DB_CONFIG)


def clean_batch_number(batch_num):
    """
    Clean and normalize batch numbers for matching.
    Handles variations like: 12345, #12345, BN12345, 000012345
    """
    if not batch_num:
        return ""
    batch_str = str(batch_num).upper().strip()
    batch_str = re.sub(r"^(BN|BATCH|#|B)", "", batch_str)
    batch_str = re.sub(r"[\s\-]", "", batch_str)
    batch_str = batch_str.lstrip("0")
    return batch_str


def normalize_amount(amount):
    """Normalize amount for comparison (handle slight variations)."""
    try:
        return round(float(amount), 2)
    except (ValueError, TypeError):
        return 0.0


def similarity_score(str1, str2):
    """Calculate similarity between two strings (0-1)."""
    if not str1 or not str2:
        return 0.0
    return SequenceMatcher(None, str1.lower(), str2.lower()).ratio()


def parse_date(date_str):
    """Parse date from various formats."""
    if date_str is None:
        return None
    if hasattr(date_str, "date"):
        return date_str.date() if hasattr(date_str, "date") else date_str
    formats = ["%d/%m/%Y", "%Y-%m-%d", "%m-%d-%Y", "%d-%m-%Y"]
    for fmt in formats:
        try:
            return datetime.strptime(str(date_str), fmt).date()
        except (ValueError, TypeError):
            continue
    return None


def parse_amount(amount_str):
    """Parse amount from string."""
    try:
        clean_amount = re.sub(r"[K,\s]", "", str(amount_str))
        return float(clean_amount)
    except (ValueError, TypeError):
        return 0.0


def _ocr_page_text(page) -> str:
    """OCR a scanned PDF page when text extraction returns empty."""
    try:
        import io

        import pytesseract
        from PIL import Image

        from ocr_pipeline.preprocess import preprocess_image

        img = page.to_image(resolution=200).original
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        binary, _ = preprocess_image(buf.getvalue())
        return pytesseract.image_to_string(binary, lang="eng")
    except Exception:
        return ""


def _parse_transaction_lines(text: str) -> list:
    transactions = []
    pattern1 = r"(\d{1,2}/\d{1,2}/\d{4})\s+.*?(\d{5,})\s+([0-9,]+\.?\d{0,2})"
    pattern2 = r"(\d{4}-\d{2}-\d{2}).*?REF[:\s]*(\d+).*?([0-9,]+\.?\d{0,2})"
    pattern3 = r"DEPOSIT.*?(\d{5,}).*?([0-9,]+\.?\d{0,2})"
    pattern4 = r"(?:TXN|REF|BATCH)[\s#:]*([A-Z0-9]{5,20}).*?([0-9,]+\.?\d{0,2})"

    for line in text.split("\n"):
        for pattern in [pattern1, pattern2, pattern3, pattern4]:
            match = re.search(pattern, line, re.IGNORECASE)
            if match:
                groups = match.groups()
                if len(groups) == 2:
                    batch_num, amount_str = groups
                    date_str = None
                else:
                    date_str, batch_num, amount_str = groups[0], groups[1], groups[2]
                transactions.append({
                    "date": parse_date(date_str) if date_str else None,
                    "batch_number": clean_batch_number(batch_num),
                    "amount": parse_amount(amount_str),
                    "raw_line": line.strip(),
                })
                break
    return transactions


def extract_transactions_from_pdf(pdf_path, use_ocr_fallback: bool = True):
    """
    Extract transactions from bank statement PDF.
    Uses pdfplumber text extraction with Tesseract OCR fallback for scanned pages.
    """
    if not HAS_PDFPLUMBER:
        raise ImportError("pdfplumber required - pip install pdfplumber")

    transactions = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            if not text.strip() and use_ocr_fallback:
                text = _ocr_page_text(page)
            if not text:
                continue
            transactions.extend(_parse_transaction_lines(text))

    return transactions


def match_payment_to_transaction(payment, transactions):
    """
    Match a single student payment to bank transactions.
    Returns best match with confidence score.
    """
    best_match = None
    best_score = 0.0

    payment_batch = clean_batch_number(payment.get("batch_number"))
    payment_amount = normalize_amount(payment.get("amount"))
    payment_date = payment.get("payment_date")
    if hasattr(payment_date, "date"):
        payment_date = payment_date.date()

    for txn in transactions:
        if txn.get("matched"):
            continue

        txn_batch = clean_batch_number(txn.get("batch_number"))
        txn_amount = normalize_amount(txn.get("amount"))
        txn_date = txn.get("date")
        if txn_date and hasattr(txn_date, "date"):
            txn_date = txn_date.date()

        score = 0.0

        if payment_batch and txn_batch:
            if payment_batch == txn_batch:
                score += 60.0
            else:
                batch_sim = similarity_score(payment_batch, txn_batch)
                if batch_sim > 0.8:
                    score += 60.0 * batch_sim

        if payment_amount > 0 and txn_amount > 0:
            amount_diff = abs(payment_amount - txn_amount)
            if amount_diff == 0:
                score += 25.0
            elif amount_diff <= 1.0:
                score += 23.0
            elif amount_diff <= 10.0:
                score += 21.0
            elif amount_diff <= 50.0:
                score += 20.0

        if payment_date and txn_date:
            date_diff = abs((payment_date - txn_date).days)
            if date_diff == 0:
                score += 15.0
            elif date_diff <= 3:
                score += 12.0
            elif date_diff <= 7:
                score += 10.0
            elif date_diff <= 14:
                score += 5.0

        if score > best_score:
            best_score = score
            best_match = {
                "transaction": txn,
                "confidence": score / 100.0,
                "match_details": {
                    "batch_match": payment_batch == txn_batch,
                    "amount_match": abs(payment_amount - txn_amount) <= 1.0,
                    "date_match": bool(
                        payment_date and txn_date and abs((payment_date - txn_date).days) <= 3
                    ),
                },
            }

    return best_match
