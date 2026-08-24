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
from .templates import (
    BankTemplate,
    TEMPLATES,
    BANK_REF_RE,
    CURRENCY_AMOUNT_RE,
    ISO_OR_DMY_DATE_RE,
    LABELED_REF_RE,
    crop_region,
    detect_template,
)

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
    has_decimal = "." in str(raw).replace(",", "")
    has_thousands = "," in str(raw)
    clean = re.sub(r"[^\d.]", "", str(raw).replace(",", ""))
    try:
        val = float(clean)
        if 1900 <= val <= 2100 and not has_decimal:
            return None
        if val < 100 and not has_decimal:
            return None
        if not has_decimal and not has_thousands and val < 1000:
            return None
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
        lines: Dict[tuple, List[str]] = {}
        confs = []
        n = len(data.get("text", []))
        for i in range(n):
            w = (data["text"][i] or "").strip()
            if not w:
                continue
            key = (
                data.get("block_num", [0] * n)[i],
                data.get("par_num", [0] * n)[i],
                data.get("line_num", [0] * n)[i],
            )
            lines.setdefault(key, []).append(w)
            try:
                c = float(data["conf"][i])
                if c >= 0:
                    confs.append(c)
            except (TypeError, ValueError, IndexError):
                pass
        text = "\n".join(" ".join(words) for _, words in sorted(lines.items()))
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
    """Parse fields using label + same-line or next-line values (common on bank PDFs)."""
    lines = [ln.strip() for ln in (text or "").splitlines() if ln.strip()]
    out: Dict[str, Any] = {}

    def look(i: int) -> str:
        nxt = lines[i + 1] if i + 1 < len(lines) else ""
        return f"{lines[i]} {nxt}"

    for i, line in enumerate(lines):
        lu = re.sub(r"[:\s]+$", "", line.upper())
        blob = look(i)

        if re.search(r"STUDENT\s*(ID|NO|NUMBER|/)|STU-", lu):
            sid = _first_group(template.student_id_pattern, blob) or _first_group(
                r"(?:ICU|STU)[\s\-]*(\d{6,10})", blob
            )
            if sid:
                out["student_id"] = sid

        if re.match(r"DATE\b", lu) or lu == "DATE":
            d = _first_group(ISO_OR_DMY_DATE_RE, blob)
            parsed = _parse_date(d or "")
            if parsed:
                out["date"] = parsed

        if re.search(r"\b(AMOUNT|AMT|TOTAL)\b", lu):
            amt = _first_group(CURRENCY_AMOUNT_RE, blob)
            parsed = _parse_amount(amt or "")
            if parsed:
                out["amount"] = parsed
            else:
                nxt = lines[i + 1] if i + 1 < len(lines) else ""
                parsed = _parse_amount(_first_group(CURRENCY_AMOUNT_RE, nxt) or nxt)
                if parsed:
                    out["amount"] = parsed

        if re.search(r"\b(BATCH|TXN|SERIAL|REFERENCE|TRANSACTION)\b", lu) or lu in (
            "REF",
            "TXN",
        ):
            ref = _first_group(BANK_REF_RE, blob) or _first_group(LABELED_REF_RE, blob)
            if ref and ref.upper() not in {"ERENCE", "ERENCE:", "FERENCE"}:
                out["batch_reference"] = ref

    if not out.get("amount"):
        amt = _first_group(CURRENCY_AMOUNT_RE, text or "")
        parsed = _parse_amount(amt or "")
        if parsed:
            out["amount"] = parsed

    if not out.get("date"):
        d = _first_group(ISO_OR_DMY_DATE_RE, text or "")
        parsed = _parse_date(d or "")
        if parsed:
            out["date"] = parsed

    if not out.get("student_id"):
        sid = _first_group(r"(?:ICU|STU)[\s\-]*(\d{6,10})", text or "")
        if sid:
            out["student_id"] = sid

    if not out.get("batch_reference"):
        ref = _first_group(BANK_REF_RE, text or "")
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
        or _first_group(r"(?:ICU|STU)[\s\-]*(\d{6,10})", combined)
    )
    if anchored.get("amount") is not None:
        amount = anchored["amount"]
    else:
        amount = _parse_amount(
            _first_group(CURRENCY_AMOUNT_RE, region_texts.get("amount", "")) or ""
        )

    if anchored.get("date"):
        payment_date = anchored["date"]
    else:
        payment_date = _parse_date(
            _first_group(ISO_OR_DMY_DATE_RE, region_texts.get("date", "") or combined) or ""
        )

    batch_ref = anchored.get("batch_reference") or (
        _first_group(BANK_REF_RE, region_texts.get("batch_ref", "") or combined)
        or _first_group(LABELED_REF_RE, region_texts.get("batch_ref", "") or combined)
    )
    if batch_ref and batch_ref.upper() in {"ERENCE", "FERENCE"}:
        batch_ref = None

    def _region_score(name: str) -> float:
        rc = region_confs.get(name)
        if rc is None or rc < 0.05:
            return full_conf if full_conf > 0 else 0.7
        return rc

    field_scores = []
    if student_id:
        field_scores.append(_region_score("student_id"))
    if amount is not None:
        field_scores.append(_region_score("amount"))
    if payment_date:
        field_scores.append(_region_score("date"))
    if batch_ref:
        field_scores.append(_region_score("batch_ref"))

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


def _pdf_native_text(pdf_bytes: bytes) -> str:
    try:
        import pdfplumber
    except ImportError:
        return ""
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        return "\n".join((page.extract_text() or "") for page in pdf.pages[:3]).strip()


def _pdf_to_png(pdf_bytes: bytes, dpi: int = 300) -> bytes:
    """Rasterize the first PDF page so deposit-slip PDFs can go through the image OCR path."""
    try:
        import pypdfium2 as pdfium

        doc = pdfium.PdfDocument(io.BytesIO(pdf_bytes))
        page = doc[0]
        pil = page.render(scale=dpi / 72.0).to_pil().convert("RGB")
        buf = io.BytesIO()
        pil.save(buf, format="PNG")
        return buf.getvalue()
    except Exception:
        pass

    try:
        import pdfplumber
    except ImportError as exc:
        raise RuntimeError("pdfplumber is required to OCR PDF deposit slips") from exc

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        if not pdf.pages:
            raise ValueError("Empty PDF deposit slip")
        try:
            img = pdf.pages[0].to_image(resolution=dpi).original
        except Exception as exc:
            raise RuntimeError(
                "Cannot rasterize PDF slip. Install pypdfium2 in the Python OCR environment."
            ) from exc
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()


def _batch_from_filename(filename: str) -> Optional[str]:
    m = re.search(BANK_REF_RE, filename or "", re.I)
    return m.group(1).upper() if m else None


def _coerce_to_image_bytes(image_bytes: bytes, filename: str = "") -> tuple[bytes, str]:
    """Returns (image_bytes, native_pdf_text)."""
    name = (filename or "").lower()
    if not image_bytes:
        raise ValueError(f"Empty file: {filename or 'deposit slip'}")
    if name.endswith(".pdf") or image_bytes[:5] == b"%PDF-":
        native = _pdf_native_text(image_bytes)
        return _pdf_to_png(image_bytes), native
    return image_bytes, ""


def extract_deposit_slip(
    image_bytes: bytes,
    filename: str = "",
    bank_hint: Optional[str] = None,
) -> Dict[str, Any]:
    """OCR a single deposit slip image with preprocessing and template matching."""
    image_bytes, native_text = _coerce_to_image_bytes(image_bytes, filename)
    orig_gray = Image.open(io.BytesIO(image_bytes)).convert("L")
    binary_img, gray_img = preprocess_image(image_bytes)

    candidates: List[tuple[str, float]] = []
    if native_text and len(native_text.strip()) >= 20:
        candidates.append((native_text, 0.92))
    for img in (gray_img, orig_gray, binary_img):
        text, conf = _ocr_image(img)
        candidates.append((text, conf))
        if len(text.strip()) < 20:
            alt_text, alt_conf = _ocr_image(img, config="--oem 3 --psm 4")
            if len(alt_text) > len(text):
                candidates.append((alt_text, alt_conf))

    template_seed = detect_template(native_text or (candidates[0][0] if candidates else ""), bank_hint)

    def _cand_key(item: tuple[str, float]) -> tuple:
        text, conf = item
        anchored = _label_anchored_parse(text, template_seed)
        fields = sum(1 for k in ("student_id", "amount", "date", "batch_reference") if anchored.get(k))
        return (fields, len(text.strip()), conf)

    full_text, full_conf = max(candidates, key=_cand_key) if candidates else ("", 0.0)
    if len(full_text.strip()) < 20:
        alt_text, alt_conf = _ocr_image(binary_img)
        if len(alt_text) > len(full_text):
            full_text, full_conf = alt_text, alt_conf

    template = detect_template(full_text, bank_hint)
    if not full_text and bank_hint and bank_hint.lower() in TEMPLATES:
        template = TEMPLATES[bank_hint.lower()]

    result = _extract_from_template(binary_img, gray_img, template, full_text, full_conf)
    if not result.get("batch_reference"):
        hinted = _batch_from_filename(filename)
        if hinted:
            result["batch_reference"] = hinted
            result["batch_reference_source"] = "filename"
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
