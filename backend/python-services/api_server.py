"""
Flask API server for Python services (batch matching, PDF parsing, extract/match).
"""
import io
import logging
import os
from typing import Optional

from flask import Flask, request, jsonify
from flask_cors import CORS

from batch_matching import parse_payments_csv, match_batch
from psycopg2.extras import RealDictCursor

from batch_matching_service import (
    extract_transactions_from_pdf,
    match_payment_to_transaction,
    get_db_connection,
)
from pdf_parser import extract_from_pdf, extract_from_csv
from ocr_pipeline.extractor import extract_deposit_slip, extract_deposit_slips_batch
from ocr_pipeline.matcher import match_slips_to_bank_transactions

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)


def resolve_pdf_path(pdf_url: str, pdf_path: Optional[str] = None) -> str:
    """Resolve PDF URL or path to local filesystem path."""
    if pdf_path and os.path.exists(pdf_path):
        return pdf_path
    # Convert URL to path: http://localhost:5000/uploads/... -> ./uploads/...
    path = pdf_url.replace("http://localhost:5000/", "").replace("https://localhost:5000/", "")
    path = path.replace("/", os.sep).lstrip(os.sep)
    # Try relative to project root (backend/python-services -> ../../uploads)
    base = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    full = os.path.join(base, path)
    if os.path.exists(full):
        return full
    if os.path.exists(path):
        return path
    return full


@app.route("/batch/match", methods=["POST"])
def batch_match():
    """Match student payments against bank statement (CSV + file)."""
    payments_file = request.files.get("payments")
    bank_file = request.files.get("bankStatement") or request.files.get("bank")

    if not payments_file:
        return jsonify({"error": "payments file required"}), 400
    if not bank_file:
        return jsonify({"error": "bank statement file required"}), 400

    payments_content = payments_file.read()
    bank_content = bank_file.read()
    bank_mime = bank_file.content_type or ""

    payment_rows = parse_payments_csv(payments_content)
    if not payment_rows:
        return jsonify({"error": "No valid payment rows in CSV"}), 400

    if "pdf" in (bank_mime or ""):
        try:
            bank_text = extract_from_pdf(bank_content)
        except ImportError:
            return jsonify({"error": "pdfplumber required for PDF parsing"}), 500
    else:
        bank_text = extract_from_csv(bank_content)

    result = match_batch(payment_rows, bank_text)
    return jsonify(result)


@app.route("/extract-transactions", methods=["POST"])
def extract_transactions():
    """Extract transactions from bank statement PDF (for accountant flow)."""
    try:
        data = request.get_json() or {}
        pdf_url = data.get("pdf_url")
        pdf_path = data.get("pdf_path")
        statement_id = data.get("statement_id")

        if not pdf_url and not pdf_path:
            return jsonify({"error": "pdf_url or pdf_path required"}), 400
        if not statement_id:
            return jsonify({"error": "statement_id required"}), 400

        resolved = resolve_pdf_path(pdf_url or "", pdf_path)
        if not os.path.exists(resolved):
            return jsonify({"error": f"PDF file not found: {resolved}"}), 404

        logger.info("Extracting transactions from: %s", resolved)
        transactions = extract_transactions_from_pdf(resolved)

        formatted = []
        for txn in transactions:
            formatted.append({
                "batch_number": txn["batch_number"],
                "amount": txn["amount"],
                "date": txn["date"].isoformat() if txn.get("date") else None,
                "depositor_name": txn.get("depositor_name") or None,
                "raw_line": txn.get("raw_line", ""),
            })

        logger.info("Extracted %d transactions", len(formatted))
        return jsonify({
            "success": True,
            "statement_id": str(statement_id),
            "transactions": formatted,
            "total_count": len(formatted),
        })
    except Exception as e:
        logger.exception("Transaction extraction failed")
        return jsonify({"error": str(e)}), 500


@app.route("/match-payments", methods=["POST"])
def match_payments():
    """Automated batch matching of student payments with bank transactions."""
    try:
        data = request.get_json() or {}
        statement_id = data.get("statement_id")

        if not statement_id:
            return jsonify({"error": "statement_id required"}), 400

        logger.info("Starting automated matching for statement: %s", statement_id)
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute(
            """
            SELECT transaction_id, batch_number, amount, transaction_date, depositor_name
            FROM bank_transactions
            WHERE statement_id = %s AND matched_with_student = false
            """,
            (statement_id,),
        )
        bank_transactions = list(cursor.fetchall())

        if not bank_transactions:
            logger.warning("No unmatched transactions for statement %s", statement_id)
            cursor.close()
            conn.close()
            return jsonify({
                "success": True,
                "statement_id": str(statement_id),
                "matches": [],
                "message": "No unmatched transactions found",
            })

        cursor.execute(
            """
            SELECT payment_id, student_id, batch_number, amount, payment_date,
                   semester, academic_year
            FROM student_payments
            WHERE status = 'pending' AND matched_with_bank = false
            """
        )
        student_payments = list(cursor.fetchall())

        if not student_payments:
            logger.warning("No pending student payments to match")
            cursor.close()
            conn.close()
            return jsonify({
                "success": True,
                "statement_id": str(statement_id),
                "matches": [],
                "message": "No pending payments to match",
            })

        transactions_list = []
        for txn in bank_transactions:
            transactions_list.append({
                "transaction_id": txn["transaction_id"],
                "batch_number": txn["batch_number"],
                "amount": txn["amount"],
                "date": txn["transaction_date"],
                "matched": False,
            })

        match_results = []
        for payment in student_payments:
            match_result = match_payment_to_transaction(payment, transactions_list)

            if match_result and match_result["confidence"] >= 0.70:
                for txn in transactions_list:
                    if txn["transaction_id"] == match_result["transaction"]["transaction_id"]:
                        txn["matched"] = True
                        break
                match_results.append({
                    "matched": True,
                    "payment_id": str(payment["payment_id"]),
                    "transaction_id": str(match_result["transaction"]["transaction_id"]),
                    "confidence": match_result["confidence"],
                    "match_details": match_result["match_details"],
                    "student_id": payment["student_id"],
                    "semester": payment["semester"],
                    "academic_year": payment["academic_year"],
                })
                logger.info(
                    "Match: Payment %s -> Transaction %s (%.0f%%)",
                    payment["payment_id"],
                    match_result["transaction"]["transaction_id"],
                    match_result["confidence"] * 100,
                )
            else:
                match_results.append({
                    "matched": False,
                    "payment_id": str(payment["payment_id"]),
                    "transaction_id": None,
                    "confidence": match_result["confidence"] if match_result else 0.0,
                    "reason": "No confident match found (threshold: 70%)",
                })

        try:
            for m in match_results:
                if m["matched"]:
                    cursor.execute(
                        """
                        UPDATE student_payments
                        SET status = 'auto_matched', matched_with_bank = true,
                            matched_transaction_id = %s, match_confidence = %s,
                            updated_at = NOW()
                        WHERE payment_id = %s
                        """,
                        (m["transaction_id"], m["confidence"], m["payment_id"]),
                    )
                    cursor.execute(
                        """
                        UPDATE bank_transactions
                        SET matched_with_student = true, matched_payment_id = %s
                        WHERE transaction_id = %s
                        """,
                        (m["payment_id"], m["transaction_id"]),
                    )
                else:
                    cursor.execute(
                        """
                        UPDATE student_payments
                        SET status = 'manual_review', updated_at = NOW()
                        WHERE payment_id = %s
                        """,
                        (m["payment_id"],),
                    )
            conn.commit()
        except Exception as db_err:
            conn.rollback()
            logger.exception("Database update failed after matching")
            raise db_err
        finally:
            cursor.close()
            conn.close()

        matched_count = sum(1 for m in match_results if m["matched"])
        summary = {
            "total_payments": len(student_payments),
            "matched": matched_count,
            "unmatched": len(student_payments) - matched_count,
            "match_rate": matched_count / len(student_payments) if student_payments else 0,
        }

        return jsonify({
            "success": True,
            "statement_id": str(statement_id),
            "matches": match_results,
            "summary": summary,
        })
    except Exception as e:
        logger.exception("Automated matching failed")
        return jsonify({"error": str(e)}), 500


@app.route("/manual-match", methods=["POST"])
def manual_match():
    """Manually match a payment to a transaction."""
    try:
        data = request.get_json() or {}
        payment_id = data.get("payment_id")
        transaction_id = data.get("transaction_id")

        if not payment_id or not transaction_id:
            return jsonify({"error": "payment_id and transaction_id required"}), 400

        logger.info("Manual match: Payment %s -> Transaction %s", payment_id, transaction_id)
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                UPDATE student_payments
                SET status = 'auto_matched', matched_with_bank = true,
                    matched_transaction_id = %s, match_confidence = 1.0,
                    manually_matched = true, updated_at = NOW()
                WHERE payment_id = %s
                """,
                (transaction_id, payment_id),
            )
            cursor.execute(
                """
                UPDATE bank_transactions
                SET matched_with_student = true, matched_payment_id = %s
                WHERE transaction_id = %s
                """,
                (payment_id, transaction_id),
            )
            conn.commit()
            return jsonify({
                "success": True,
                "payment_id": payment_id,
                "transaction_id": transaction_id,
                "message": "Manual match recorded",
            })
        except Exception as db_err:
            conn.rollback()
            logger.exception("Manual match database update failed")
            raise db_err
        finally:
            cursor.close()
            conn.close()
    except Exception as e:
        logger.exception("Manual match failed")
        return jsonify({"error": str(e)}), 500


@app.route("/ocr/deposit-slip", methods=["POST"])
def ocr_deposit_slip():
    """OCR a single deposit slip image."""
    try:
        slip_file = request.files.get("slip") or request.files.get("image")
        if not slip_file:
            return jsonify({"error": "slip image required"}), 400
        bank_hint = request.form.get("bank") or request.form.get("bank_name")
        result = extract_deposit_slip(slip_file.read(), slip_file.filename or "", bank_hint)
        return jsonify({"success": True, "result": result})
    except Exception as e:
        logger.exception("OCR deposit-slip failed")
        return jsonify({"error": str(e)}), 500


@app.route("/ocr/deposit-slips", methods=["POST"])
def ocr_deposit_slips():
    """OCR a batch of deposit slip images."""
    try:
        files = request.files.getlist("slips") or request.files.getlist("images")
        if not files:
            return jsonify({"error": "at least one slip image required"}), 400
        bank_hint = request.form.get("bank") or request.form.get("bank_name")
        payload = [(f.read(), f.filename or "") for f in files]
        result = extract_deposit_slips_batch(payload, bank_hint)
        return jsonify({"success": True, **result})
    except Exception as e:
        logger.exception("OCR deposit-slips failed")
        return jsonify({"error": str(e)}), 500


@app.route("/ocr/reconcile", methods=["POST"])
def ocr_reconcile():
    """
    Full OCR reconciliation: bank statement PDF + deposit slip images.
    Returns side-by-side slip/transaction pairs with confidence scores.
    """
    import time

    started = time.perf_counter()
    try:
        bank_file = request.files.get("bankStatement") or request.files.get("bank")
        slip_files = request.files.getlist("slips") or request.files.getlist("depositSlips")
        bank_hint = request.form.get("bank") or request.form.get("bank_name")

        if not bank_file:
            return jsonify({"error": "bank statement PDF required"}), 400
        if not slip_files:
            return jsonify({"error": "at least one deposit slip image required"}), 400

        bank_content = bank_file.read()
        bank_mime = bank_file.content_type or ""

        transactions = []
        if "pdf" in bank_mime.lower() or (bank_file.filename or "").lower().endswith(".pdf"):
            import tempfile

            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                tmp.write(bank_content)
                tmp_path = tmp.name
            try:
                transactions = extract_transactions_from_pdf(tmp_path, use_ocr_fallback=True)
            finally:
                os.unlink(tmp_path)
            for txn in transactions:
                if txn.get("date") and hasattr(txn["date"], "isoformat"):
                    txn["date"] = txn["date"].isoformat()
        else:
            from batch_matching_service import _parse_transaction_lines as parse_bank_lines

            bank_text = extract_from_csv(bank_content)
            transactions = parse_bank_lines(bank_text)

        slip_payload = [(f.read(), f.filename or "") for f in slip_files]
        slip_result = extract_deposit_slips_batch(slip_payload, bank_hint)
        match_result = match_slips_to_bank_transactions(slip_result["slips"], transactions)

        elapsed_ms = int((time.perf_counter() - started) * 1000)
        return jsonify({
            "success": True,
            "bank_transactions": transactions,
            "slips": slip_result["slips"],
            "manual_flag_rate": slip_result["manual_flag_rate"],
            "manual_flag_count": slip_result["manual_flag_count"],
            "matching": match_result,
            "processing_ms": elapsed_ms,
            "transaction_count": len(transactions),
            "slip_count": slip_result["total"],
        })
    except Exception as e:
        logger.exception("OCR reconcile failed")
        return jsonify({"error": str(e)}), 500


def _health_payload():
    return {
        "status": "ok",
        "service": "Python OCR & Matching Service",
        "ocr_enabled": True,
        "timestamp": __import__("datetime").datetime.now().isoformat(),
        "endpoints": {
            "GET /": "This status page",
            "GET /health": "JSON health check",
            "POST /ocr/reconcile": "Bank PDF + deposit slips",
            "POST /ocr/deposit-slip": "Single slip OCR",
            "POST /ocr/deposit-slips": "Batch slip OCR",
            "POST /extract-transactions": "Bank PDF transaction extract",
            "POST /batch/match": "CSV + bank matching",
        },
        "ui": "http://localhost:5173/accountant/batch-reconciliation",
    }


@app.route("/", methods=["GET"])
def root():
    """Browser-friendly landing so opening :8000 is not a 404."""
    if request.accept_mimetypes.best == "application/json":
        return jsonify(_health_payload())
    info = _health_payload()
    links = "".join(
        f"<li><code>{path}</code> — {desc}</li>"
        for path, desc in info["endpoints"].items()
    )
    html = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>ICU OCR Service</title>
<style>
body{{font-family:system-ui,sans-serif;max-width:40rem;margin:3rem auto;padding:0 1rem;color:#0f172a}}
code{{background:#e2e8f0;padding:.1rem .35rem;border-radius:.25rem}}
.ok{{color:#047857;font-weight:700}}
</style></head><body>
<h1>ICU OCR service</h1>
<p class="ok">Running</p>
<p>This is an API used by the accountant Batch OCR page. It is not the website.</p>
<p>Open the app: <a href="{info["ui"]}">{info["ui"]}</a></p>
<p>Health JSON: <a href="/health">/health</a></p>
<ul>{links}</ul>
</body></html>"""
    return html, 200, {"Content-Type": "text/html; charset=utf-8"}


@app.route("/health", methods=["GET"])
def health():
    return jsonify(_health_payload())


if __name__ == "__main__":
    port = int(os.getenv("PYTHON_SERVICE_PORT", "8000"))
    app.run(host="0.0.0.0", port=port, debug=True)
