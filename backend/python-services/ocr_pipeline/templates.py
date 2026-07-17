"""
Adaptive template definitions for Zambian bank deposit slip layouts.
Field regions are relative (x, y, w, h) as fractions of image size.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple


@dataclass(frozen=True)
class FieldRegion:
    name: str
    x: float
    y: float
    w: float
    h: float


@dataclass(frozen=True)
class BankTemplate:
    bank_id: str
    display_name: str
    header_keywords: Tuple[str, ...]
    regions: Tuple[FieldRegion, ...]
    student_id_pattern: str
    amount_pattern: str
    date_pattern: str
    batch_pattern: str


ZANACO_TEMPLATE = BankTemplate(
    bank_id="zanaco",
    display_name="Zanaco",
    header_keywords=("ZANACO", "ZAMBIA NATIONAL COMMERCIAL"),
    regions=(
        FieldRegion("student_id", 0.04, 0.36, 0.46, 0.08),
        FieldRegion("amount", 0.50, 0.36, 0.46, 0.08),
        FieldRegion("date", 0.50, 0.20, 0.44, 0.07),
        FieldRegion("batch_ref", 0.04, 0.76, 0.60, 0.08),
    ),
    student_id_pattern=r"(?:ICU|STU|REF)[\s\-]*(\d{6,10})|(\d{6,10})",
    amount_pattern=r"(?:K\s*|ZMW\s*|AMOUNT[\s:\(ZMW\)]*)?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)",
    date_pattern=r"(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})",
    batch_pattern=r"(?:TXN|REF|BATCH|TRANS)[\s#:]*([A-Z0-9]{5,24})",
)

FNB_TEMPLATE = BankTemplate(
    bank_id="fnb",
    display_name="FNB",
    header_keywords=("FNB", "FIRST NATIONAL BANK", "FIRST NATIONAL"),
    regions=(
        FieldRegion("student_id", 0.06, 0.38, 0.40, 0.08),
        FieldRegion("amount", 0.48, 0.38, 0.48, 0.08),
        FieldRegion("date", 0.48, 0.22, 0.44, 0.07),
        FieldRegion("batch_ref", 0.06, 0.71, 0.55, 0.10),
    ),
    student_id_pattern=r"(?:ICU|STU|STUDENT|REF)[\s\-#:]*(\d{6,10})|(\d{6,10})",
    amount_pattern=r"(?:K\s*|ZMW\s*|AMT[\s:]*)?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)",
    date_pattern=r"(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})",
    batch_pattern=r"(?:TXN|REF|BATCH|TRANS|SERIAL)[\s#:]*([A-Z0-9]{5,24})",
)

TEMPLATES: Dict[str, BankTemplate] = {
    "zanaco": ZANACO_TEMPLATE,
    "fnb": FNB_TEMPLATE,
}


def detect_template(full_text: str, bank_hint: Optional[str] = None) -> BankTemplate:
    """Pick template from OCR header keywords or explicit bank hint."""
    upper = (full_text or "").upper()
    if bank_hint:
        key = bank_hint.lower().strip()
        if key in TEMPLATES:
            return TEMPLATES[key]
        if "zanaco" in key:
            return ZANACO_TEMPLATE
        if "fnb" in key or "first national" in key:
            return FNB_TEMPLATE

    scores: List[Tuple[int, BankTemplate]] = []
    for tpl in TEMPLATES.values():
        score = sum(1 for kw in tpl.header_keywords if kw in upper)
        scores.append((score, tpl))
    scores.sort(key=lambda x: x[0], reverse=True)
    if scores[0][0] > 0:
        return scores[0][1]
    return ZANACO_TEMPLATE


def crop_region(gray_image, region: FieldRegion):
    """Crop a relative region from a PIL grayscale image."""
    w, h = gray_image.size
    left = int(region.x * w)
    top = int(region.y * h)
    right = int(min(w, (region.x + region.w) * w))
    bottom = int(min(h, (region.y + region.h) * h))
    if right <= left or bottom <= top:
        return gray_image
    return gray_image.crop((left, top, right, bottom))
