"""
Deposit slip field extraction via adaptive template matching + Tesseract OCR.
"""
from __future__ import annotations

import io
import os
import re
from datetime import datetime
from typing import Any, Dict, List, Optional

from PIL import Image

from .preprocess import preprocess_image
from .templates import BankTemplate, TEMPLATES, crop_region, detect_template

try:
    import pytesseract

    HAS_TESSERACT = True
except ImportError:
    HAS_TESSERACT = False

OCR_LANG = os.getenv("OCR_LANG", "eng")
CONFIDENCE_THRESHOLD = float(os.getenv("OCR_CONFIDENCE_THRESHOLD", "0.65"))
TESSERACT_CONFIG = "--oem 3 --psm 6"
TESSERACT_REGION_CONFIG = "--oem 3 --psm 7"

if HAS_TESSERACT:
    _tess_cmd = os.getenv("TESSERACT_CMD")
    if _tess_cmd:
        pytesseract.pytesseract.tesseract_cmd = _tess_cmd
    elif os.name == "nt":
        _win_default = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
        if os.path.exists(_win_default):
            pytesseract.pytesseract.tesseract_cmd = _win_default


def _parse_amount(raw: str) -> Optional[float]:
    if not raw:
        return None
    clean = re.sub(r"[^\d.]", "", raw.replace(",", ""))
    try:
        val = float(clean)
        return round(val, 2) if 10 <= val <= 1_000_000 else None
    except ValueError:
        return None


def _parse_date(raw: str) -> Optional[str]:
    if not raw:
        return None
    for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y", "%Y-%m-%d"):
        try:
            return datetime.strptime(raw.strip(), fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def _first_group(pattern: str, text: str) -> Optional[str]:
    m = re.search(pattern, text, re.IGNORECASE)
    if not m:
        return None
    for g in m.groups():
        if g:
            return g.strip()
    return m.group(0).strip()


def _ocr_image(img: Image.Image, config: str = TESSERACT_CONFIG) -> tuple[str, float]:
    if not HAS_TESSERACT:
        return "", 0.0
    try:
        data = pytesseract.image_to_data(img, lang=OCR_LANG, config=config, output_type=pytesseract.Output.DICT)
        texts = []
        confs = []
        for i, word in enumerate(data.get("text", [])):
            w = (word or "").strip()
            if not w:
                continue
            texts.append(w)
            try:
                c = float(data["conf"][i])
                if c >= 0:
                    confs.append(c)
            except (TypeError, ValueError, IndexError):
                pass
        text = " ".join(texts)
        avg_conf = (sum(confs) / len(confs) / 100.0) if confs else 0.5
        return text, avg_conf
    except pytesseract.TesseractNotFoundError:
        raise RuntimeError(
            "Tesseract OCR is not installed. Install tesseract-ocr (eng) and ensure it is on PATH."
        ) from None
    except Exception:
        try:
            plain = pytesseract.image_to_string(img, lang=OCR_LANG, config=config)
            return plain.strip(), 0.45
        except pytesseract.TesseractNotFoundError:
            raise RuntimeError(
                "Tesseract OCR is not installed. Install tesseract-ocr (eng) and ensure it is on PATH."
            ) from None
        except Exception:
            return "", 0.0


def _label_anchored_parse(text: str, template: BankTemplate) -> Dict[str, Any]:
    """Parse fields using bank-specific label anchors in full-page OCR text."""
    upper = text.upper()
    out: Dict[str, Any] = {}

    id_markers = ("STUDENT", "REFERENCE", "STU-", "ICU")
    for line in text.splitlines():
        lu = line.upper()
        if any(m in lu for m in id_markers):
            sid = _first_group(template.student_id_pattern, line)
            if sid:
                out["student_id"] = sid

    amt_markers = ("AMOUNT", "AMT", "ZMW", "K ")
    for line in text.splitlines():
        lu = line.upper()
        if any(m in lu for m in amt_markers):
            amt = _first_group(template.amount_pattern, line)
            if amt:
                parsed = _parse_amount(amt)
                if parsed:
                    out["amount"] = parsed

    for line in text.splitlines():
        if "DATE" in line.upper() or re.search(template.date_pattern, line):
            d = _first_group(template.date_pattern, line)
            if d:
                parsed = _parse_date(d)
                if parsed:
                    out["date"] = parsed

    for line in text.splitlines():
        lu = line.upper()
        if any(m in lu for m in ("BATCH", "TXN", "REF", "SERIAL", "TRANSACTION")):
            ref = _first_group(template.batch_pattern, line)
            if ref:
                out["batch_reference"] = ref

    return out


def _extract_from_template(
    binary_img: Image.Image,
    gray_img: Image.Image,
    template: BankTemplate,
    full_text: str,
    full_conf: float,
) -> Dict[str, Any]:
    region_texts: Dict[str, str] = {}
    region_confs: Dict[str, float] = {}

    for region in template.regions:
        crop = crop_region(gray_img, region)
        text, conf = _ocr_image(crop, config=TESSERACT_REGION_CONFIG)
        region_texts[region.name] = text
        region_confs[region.name] = conf

    combined = f"{full_text}\n" + "\n".join(region_texts.values())
    anchored = _label_anchored_parse(combined, template)

    student_id = anchored.get("student_id") or (
        _first_group(template.student_id_pattern, region_texts.get("student_id", ""))
        or _first_group(template.student_id_pattern, combined)
    )
    amount_raw = None
    if anchored.get("amount") is not None:
        amount = anchored["amount"]
    else:
        amount_raw = (
            _first_group(template.amount_pattern, region_texts.get("amount", ""))
            or _first_group(template.amount_pattern, combined)
        )
        amount = _parse_amount(amount_raw or "")

    if anchored.get("date"):
        payment_date = anchored["date"]
    else:
        date_raw = (
            _first_group(template.date_pattern, region_texts.get("date", ""))
            or _first_group(template.date_pattern, combined)
        )
        payment_date = _parse_date(date_raw or "")

    batch_ref = anchored.get("batch_reference") or (
        _first_group(template.batch_pattern, region_texts.get("batch_ref", ""))
        or _first_group(template.batch_pattern, combined)
    )

    field_scores = []
    if student_id:
        field_scores.append(region_confs.get("student_id", full_conf))
    if amount is not None:
        field_scores.append(region_confs.get("amount", full_conf))
    if payment_date:
        field_scores.append(region_confs.get("date", full_conf))
    if batch_ref:
        field_scores.append(region_confs.get("batch_ref", full_conf))

    fields_found = sum(
        1 for v in [student_id, amount, payment_date, batch_ref] if v is not None and v != ""
    )
    confidence = (sum(field_scores) / len(field_scores)) if field_scores else full_conf * 0.5
    confidence = min(1.0, confidence * (0.5 + 0.125 * fields_found))

    needs_manual = confidence < CONFIDENCE_THRESHOLD or fields_found < 2

    return {
        "student_id": student_id,
        "amount": amount,
        "date": payment_date,
        "batch_reference": batch_ref,
        "confidence": round(confidence, 4),
        "needs_manual_entry": needs_manual,
        "template": template.bank_id,
        "template_name": template.display_name,
        "fields_found": fields_found,
        "region_confidence": region_confs,
        "raw_text": combined[:2000],
    }


def extract_deposit_slip(
    image_bytes: bytes,
    filename: str = "",
    bank_hint: Optional[str] = None,
) -> Dict[str, Any]:
    """OCR a single deposit slip image with preprocessing and template matching."""
    binary_img, gray_img = preprocess_image(image_bytes)
    full_text, full_conf = _ocr_image(gray_img)
    if len(full_text.strip()) < 20:
        alt_text, alt_conf = _ocr_image(binary_img)
        if len(alt_text) > len(full_text):
            full_text, full_conf = alt_text, alt_conf
    template = detect_template(full_text, bank_hint)

    if not full_text and bank_hint and bank_hint.lower() in TEMPLATES:
        template = TEMPLATES[bank_hint.lower()]

    result = _extract_from_template(binary_img, gray_img, template, full_text, full_conf)
    result["filename"] = filename
    result["confidence_threshold"] = CONFIDENCE_THRESHOLD
    return result


def extract_deposit_slips_batch(
    files: List[tuple[bytes, str]],
    bank_hint: Optional[str] = None,
) -> Dict[str, Any]:
    """OCR multiple deposit slip images; returns slips + manual-flag rate."""
    slips = []
    manual_count = 0
    for content, name in files:
        slip = extract_deposit_slip(content, name, bank_hint)
        slips.append(slip)
        if slip.get("needs_manual_entry"):
            manual_count += 1

    total = len(slips)
    return {
        "slips": slips,
        "total": total,
        "manual_flag_count": manual_count,
        "manual_flag_rate": round(manual_count / total, 4) if total else 0.0,
        "confidence_threshold": CONFIDENCE_THRESHOLD,
    }
