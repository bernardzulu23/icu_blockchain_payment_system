"""
Generate realistic synthetic Zanaco/FNB deposit slip images for OCR validation.
Produces labeled PNGs mimicking typical Zambian bank slip layouts.
"""
from __future__ import annotations

import json
import os
import random
from datetime import datetime, timedelta
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
SAMPLES_PER_BANK = int(os.getenv("OCR_VALIDATION_SAMPLES_PER_BANK", "40"))


def _font(size: int):
    for name in ("arial.ttf", "Arial.ttf", "DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def _draw_zanaco_slip(
    student_id: str,
    amount: float,
    date_str: str,
    batch_ref: str,
    noise: bool = False,
) -> Image.Image:
    w, h = 800, 1100
    img = Image.new("RGB", (w, h), (245, 245, 240))
    draw = ImageDraw.Draw(img)
    title_font = _font(36)
    label_font = _font(22)
    value_font = _font(28)

    draw.rectangle([20, 20, w - 20, 120], outline=(0, 100, 60), width=3)
    draw.text((40, 45), "ZANACO", fill=(0, 100, 60), font=title_font)
    draw.text((40, 85), "Zambia National Commercial Bank - Deposit Slip", fill=(60, 60, 60), font=label_font)

    draw.text((40, 360), "Student / Reference No:", fill=(0, 0, 0), font=label_font)
    draw.text((40, 400), f"ICU{student_id}", fill=(0, 0, 0), font=value_font)

    draw.text((420, 360), "Amount (ZMW):", fill=(0, 0, 0), font=label_font)
    draw.text((420, 400), f"K {amount:,.2f}", fill=(0, 0, 0), font=value_font)

    draw.text((420, 200), "Date:", fill=(0, 0, 0), font=label_font)
    draw.text((420, 235), date_str, fill=(0, 0, 0), font=value_font)

    draw.text((40, 800), "Batch / Transaction Ref:", fill=(0, 0, 0), font=label_font)
    draw.text((40, 840), f"TXN{batch_ref}", fill=(0, 0, 0), font=value_font)

    if noise:
        for _ in range(400):
            x, y = random.randint(0, w - 1), random.randint(0, h - 1)
            img.putpixel((x, y), (random.randint(200, 255),) * 3)
    return img


def _draw_fnb_slip(
    student_id: str,
    amount: float,
    date_str: str,
    batch_ref: str,
    noise: bool = False,
) -> Image.Image:
    w, h = 800, 1100
    img = Image.new("RGB", (w, h), (252, 250, 245))
    draw = ImageDraw.Draw(img)
    title_font = _font(34)
    label_font = _font(22)
    value_font = _font(28)

    draw.rectangle([20, 20, w - 20, 130], fill=(0, 30, 100), outline=(0, 30, 100))
    draw.text((40, 50), "FNB", fill=(255, 255, 255), font=title_font)
    draw.text((40, 95), "FIRST NATIONAL BANK - Cash Deposit", fill=(200, 210, 255), font=label_font)

    draw.text((60, 390), "Student ID:", fill=(0, 0, 0), font=label_font)
    draw.text((60, 430), f"STU-{student_id}", fill=(0, 0, 0), font=value_font)

    draw.text((400, 390), "AMT:", fill=(0, 0, 0), font=label_font)
    draw.text((400, 430), f"ZMW {amount:,.2f}", fill=(0, 0, 0), font=value_font)

    draw.text((400, 220), "DATE", fill=(0, 0, 0), font=label_font)
    draw.text((400, 255), date_str, fill=(0, 0, 0), font=value_font)

    draw.text((60, 750), "SERIAL / REF:", fill=(0, 0, 0), font=label_font)
    draw.text((60, 790), f"REF{batch_ref}", fill=(0, 0, 0), font=value_font)

    if noise:
        for _ in range(300):
            x, y = random.randint(0, w - 1), random.randint(0, h - 1)
            img.putpixel((x, y), (random.randint(210, 255),) * 3)
    return img


def generate_validation_set(output_dir: Path | None = None) -> dict:
    """Create labeled samples and write labels.json."""
    out = output_dir or ROOT
    random.seed(42)
    labels = []

    for bank, drawer in (("zanaco", _draw_zanaco_slip), ("fnb", _draw_fnb_slip)):
        bank_dir = out / bank
        bank_dir.mkdir(parents=True, exist_ok=True)
        for i in range(SAMPLES_PER_BANK):
            student_id = f"{100000 + i + (0 if bank == 'zanaco' else 1000)}"
            amount = round(random.uniform(2500, 8500), 2)
            days_ago = random.randint(0, 90)
            date_str = (datetime.now() - timedelta(days=days_ago)).strftime("%d/%m/%Y")
            batch_ref = f"{bank.upper()}{2025000 + i}"
            noise = i % 5 == 0

            img = drawer(student_id, amount, date_str, batch_ref, noise=noise)
            fname = f"{bank}_{i:03d}.png"
            img.save(bank_dir / fname)

            labels.append(
                {
                    "file": f"{bank}/{fname}",
                    "bank": bank,
                    "student_id": student_id,
                    "amount": amount,
                    "date": datetime.strptime(date_str, "%d/%m/%Y").strftime("%Y-%m-%d"),
                    "batch_reference": batch_ref,
                }
            )

    labels_path = out / "labels.json"
    with open(labels_path, "w", encoding="utf-8") as f:
        json.dump(labels, f, indent=2)

    return {"samples": len(labels), "labels_path": str(labels_path), "output_dir": str(out)}


if __name__ == "__main__":
    meta = generate_validation_set()
    print(json.dumps(meta, indent=2))
