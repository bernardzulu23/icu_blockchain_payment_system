"""
Extract data from bank statement PDFs.
"""
import io
from typing import Optional

try:
    import pdfplumber
    HAS_PDFPLUMBER = True
except ImportError:
    HAS_PDFPLUMBER = False


def extract_from_pdf(content: bytes) -> str:
    """Extract text from PDF using pdfplumber."""
    if not HAS_PDFPLUMBER:
        raise ImportError("pdfplumber not installed - pip install pdfplumber")
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        text_parts = []
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                text_parts.append(t)
        return "\n".join(text_parts)


def extract_from_csv(content: bytes) -> str:
    """Extract text from bank statement CSV."""
    return content.decode("utf-8", errors="ignore")
