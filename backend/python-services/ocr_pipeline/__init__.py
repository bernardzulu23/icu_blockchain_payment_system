"""Tesseract OCR pipeline for Zambian bank deposit slips (Zanaco, FNB)."""

from .extractor import extract_deposit_slip, extract_deposit_slips_batch
from .matcher import match_slips_to_bank_transactions
from .preprocess import preprocess_image

__all__ = [
    "preprocess_image",
    "extract_deposit_slip",
    "extract_deposit_slips_batch",
    "match_slips_to_bank_transactions",
]
