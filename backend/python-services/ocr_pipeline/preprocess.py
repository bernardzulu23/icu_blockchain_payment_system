"""
Image pre-processing for phone-captured deposit slips:
deskew, contrast normalization (CLAHE), and binarization.
"""
from __future__ import annotations

import io
from typing import Tuple

import numpy as np
from PIL import Image

try:
    import cv2

    HAS_CV2 = True
except ImportError:
    HAS_CV2 = False


def _pil_to_cv2(img: Image.Image) -> np.ndarray:
    rgb = np.array(img.convert("RGB"))
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)


def _cv2_to_pil(arr: np.ndarray) -> Image.Image:
    if len(arr.shape) == 2:
        return Image.fromarray(arr)
    rgb = cv2.cvtColor(arr, cv2.COLOR_BGR2RGB)
    return Image.fromarray(rgb)


def deskew(gray: np.ndarray, max_angle: float = 12.0) -> np.ndarray:
    """Correct mild skew using minimum-area bounding rectangle."""
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    coords = np.column_stack(np.where(binary > 0))
    if coords.size == 0:
        return gray
    angle = cv2.minAreaRect(coords)[-1]
    if angle < -45:
        angle = 90 + angle
    angle = -angle
    if abs(angle) > max_angle:
        return gray
    h, w = gray.shape[:2]
    center = (w // 2, h // 2)
    matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
    return cv2.warpAffine(
        gray,
        matrix,
        (w, h),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_REPLICATE,
    )


def normalize_contrast(gray: np.ndarray) -> np.ndarray:
    """CLAHE on grayscale for low-contrast phone photos."""
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
    return clahe.apply(gray)


def binarize(gray: np.ndarray) -> np.ndarray:
    """Adaptive threshold with Otsu fallback."""
    blurred = cv2.GaussianBlur(gray, (3, 3), 0)
    otsu_val, otsu = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    if otsu_val < 5 or otsu_val > 250:
        return cv2.adaptiveThreshold(
            blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 10
        )
    return otsu


def preprocess_image(image_bytes: bytes) -> Tuple[Image.Image, Image.Image]:
    """
    Returns (preprocessed_pil_for_ocr, grayscale_pil_for_region_crops).
    Falls back to Pillow-only contrast if OpenCV is unavailable.
    """
    img = Image.open(io.BytesIO(image_bytes))
    if not HAS_CV2:
        enhanced = Image.eval(img.convert("L"), lambda x: min(255, int(x * 1.4)))
        return enhanced, enhanced

    bgr = _pil_to_cv2(img)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    gray = deskew(gray)
    gray = normalize_contrast(gray)
    binary = binarize(gray)
    return _cv2_to_pil(binary), _cv2_to_pil(gray)
