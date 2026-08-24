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
        clean_amount = re.sub(r"[K,\s]", "", str(amount_str), flags=re.I)
        return float(clean_amount)
    except (ValueError, TypeError):
        return 0.0


BANK_REF_TOKEN = re.compile(r"(?:ABSA|ABS|ZANACO|ZNC|FNB)\d{6,24}", re.I)
DATE_TOKEN = re.compile(r"\d{4}-\d{2}-\d{2}|\d{1,2}/\d{1,2}/\d{4}")
STUDENT_TOKEN = re.compile(r"\b(?:ICU|STU)[\s\-]*\d{6,10}\b|\b\d{7,10}\b", re.I)
MONEY_TOKEN = re.compile(
    r"(?:K|ZMW)\s*([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{2})?|[0-9]+\.[0-9]{2})"
    r"|([0-9]{1,3}(?:,[0-9]{3})+\.[0-9]{2})"
    r"|([0-9]+\.[0-9]{2})"
    r"|([0-9]{1,3}(?:,[0-9]{3})+)"
    r"|(\b[1-9][0-9]{2,5}\b)",
    re.I,
)


def pick_money_amount(line: str) -> float:
    """
    Pick the tuition amount on a bank-statement line.
    Ignores dates, bank refs (ABS2026…), and student numbers (2023051).
    Prefers values with currency, decimals, or thousands separators.
    """
    if not line:
        return 0.0
    stripped = BANK_REF_TOKEN.sub(" ", line)
    stripped = DATE_TOKEN.sub(" ", stripped)
    stripped = STUDENT_TOKEN.sub(" ", stripped)

    best_val = 0.0
    best_score = -1
    for match in MONEY_TOKEN.finditer(stripped):
        raw = next((g for g in match.groups() if g), None)
        if not raw:
            continue
        val = parse_amount(raw)
        if val < 50 or val > 500_000:
            continue
        score = 0
        if match.group(0).upper().startswith(("K", "ZMW")):
            score += 4
        if "." in raw:
            score += 3
        if "," in raw:
            score += 2
        if 200 <= val <= 80_000:
            score += 2
        if score > best_score:
            best_score = score
            best_val = val
    return best_val


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


def _normalize_statement_text(text: str) -> str:
    """Split glued PDF columns (pdf-parse often emits DateRefNameIDAmount)."""
    text = text or ""
    text = re.sub(r"(\d{4}-\d{2}-\d{2})", r"\n\1 ", text)
    text = re.sub(r"(ABSA|ABS|ZANACO|ZNC|FNB)(\d{6,24})", r" \1\2 ", text, flags=re.I)
    text = re.sub(r"(ICU|STU)(\d{7})", r" \1\2 ", text, flags=re.I)
    text = re.sub(r"(\d{3,6}\.\d{2})", r" \1", text)
    return text


def _depositor_from_line(raw: str) -> str:
    s = BANK_REF_TOKEN.sub(" ", raw or "")
    s = DATE_TOKEN.sub(" ", s)
    s = STUDENT_TOKEN.sub(" ", s)
    s = re.sub(r"(?:K|ZMW)?\s*[0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?", " ", s, flags=re.I)
    s = re.sub(r"[0-9]+\.[0-9]{2}", " ", s)
    s = re.sub(r"\s+", " ", s).strip(" -/," )
    return s[:200]


def _parse_transaction_lines(text: str) -> list:
    transactions = []
    seen = set()

    for line in _normalize_statement_text(text).split("\n"):
        raw = line.strip()
        if not raw:
            continue
        ref_match = BANK_REF_TOKEN.search(raw)
        date_match = DATE_TOKEN.search(raw)
        amount = pick_money_amount(raw)
        if not ref_match and amount <= 0:
            continue
        if not ref_match:
            # Legacy numeric batch lines (date + digits + amount)
            legacy = re.search(
                r"(\d{1,2}/\d{1,2}/\d{4}|\d{4}-\d{2}-\d{2})\s+.*?([A-Z0-9]{5,24})\s+([0-9,]+\.\d{2})",
                raw,
                re.I,
            )
            if not legacy:
                continue
            date_str, batch_num, amount_str = legacy.groups()
            amount = parse_amount(amount_str)
            batch_num = clean_batch_number(batch_num)
            date_val = parse_date(date_str)
        else:
            batch_num = ref_match.group(0).upper()
            date_val = parse_date(date_match.group(0)) if date_match else None
            if amount <= 0:
                continue

        key = (batch_num, round(amount, 2), str(date_val))
        if key in seen:
            continue
        seen.add(key)
        transactions.append({
            "date": date_val,
            "batch_number": batch_num,
            "amount": amount,
            "depositor_name": _depositor_from_line(raw),
            "raw_line": raw,
        })

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
