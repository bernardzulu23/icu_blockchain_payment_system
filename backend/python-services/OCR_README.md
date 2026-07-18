# OCR Pipeline (Tesseract + OpenCV)

Deposit slip OCR runs in this Python service — **not** in Node. Node calls
`PYTHON_SERVICE_URL` endpoints; preprocessing and template matching live here.

## Why Python (not node-tesseract-ocr)

- `pytesseract` + `opencv-python-headless` + `Pillow` are already declared in `requirements.txt`
- OpenCV deskew/binarization/CLAHE is far easier in Python than native Node bindings
- Docker Compose already builds this service; Node stays a thin orchestrator
- Bank PDF OCR fallback (scanned statements) shares the same stack

## System dependencies

Install **Tesseract OCR** on the host or in Docker:

```bash
# Ubuntu / Debian
sudo apt-get install -y tesseract-ocr tesseract-ocr-eng

# Windows (chocolatey)
choco install tesseract
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/ocr/deposit-slip` | Single slip image |
| POST | `/ocr/deposit-slips` | Batch of slip images |
| POST | `/ocr/reconcile` | Bank PDF + slips → matched pairs + timing |
| POST | `/batch/match` | Legacy CSV + bank file matching |
| POST | `/extract-transactions` | Bank PDF transaction extraction |

## Templates

Adaptive templates for **Zanaco** and **FNB** in `ocr_pipeline/templates.py`.
Field regions are relative bounding boxes; low-confidence slips are flagged
for manual accountant entry (`OCR_CONFIDENCE_THRESHOLD`, default `0.65`).

## Validation set & metrics

```bash
cd backend/python-services
pip install -r requirements.txt
python validation_set/generate_samples.py   # 40 Zanaco + 40 FNB labeled PNGs
python validation_set/run_evaluation.py     # writes evaluation_report.json
```

The evaluation script computes per-field **precision, recall, F1** and macro F1.
Results are written to `validation_set/evaluation_report.json` for your thesis chapter.

## Environment

```env
OCR_LANG=eng
OCR_CONFIDENCE_THRESHOLD=0.65
PYTHON_SERVICE_PORT=8000
```
