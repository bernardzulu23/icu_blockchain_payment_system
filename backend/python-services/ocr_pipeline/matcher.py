"""
Match OCR-extracted deposit slips against bank statement transactions.
"""
from __future__ import annotations

from difflib import SequenceMatcher
from typing import Any, Dict, List, Optional


def _norm_ref(ref: Optional[str]) -> str:
    if not ref:
        return ""
    s = str(ref).upper().strip()
    for prefix in ("BN", "BATCH", "REF", "TXN", "#", "B"):
        if s.startswith(prefix):
            s = s[len(prefix) :]
    return s.replace(" ", "").replace("-", "").lstrip("0")


def _norm_amount(amount) -> float:
    try:
        return round(float(amount), 2)
    except (TypeError, ValueError):
        return 0.0


def _similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


def score_slip_to_transaction(slip: Dict[str, Any], txn: Dict[str, Any]) -> float:
    """Score 0–1 for slip↔bank transaction pair."""
    score = 0.0

    slip_batch = _norm_ref(slip.get("batch_reference"))
    txn_batch = _norm_ref(txn.get("batch_number") or txn.get("batch_reference"))
    if slip_batch and txn_batch:
        if slip_batch == txn_batch:
            score += 0.45
        elif _similarity(slip_batch, txn_batch) >= 0.85:
            score += 0.40

    slip_amt = _norm_amount(slip.get("amount"))
    txn_amt = _norm_amount(txn.get("amount"))
    if slip_amt > 0 and txn_amt > 0:
        diff = abs(slip_amt - txn_amt)
        if diff == 0:
            score += 0.35
        elif diff <= 1:
            score += 0.30
        elif diff <= 10:
            score += 0.20

    slip_id = str(slip.get("student_id") or "").strip()
    depositor = str(txn.get("depositor_name") or "").strip()
    txn_line = str(txn.get("raw_line") or "")
    if slip_id and (slip_id in depositor or slip_id in txn_line):
        score += 0.20

    slip_conf = float(slip.get("confidence") or 0)
    score *= 0.7 + 0.3 * slip_conf
    return min(1.0, score)


def match_slips_to_bank_transactions(
    slips: List[Dict[str, Any]],
    transactions: List[Dict[str, Any]],
    threshold: float = 0.55,
) -> Dict[str, Any]:
    """
    Greedy one-to-one matching between OCR slips and bank transactions.
    Returns pairs with confidence and mismatch flags for accountant review.
    """
    used_txn = set()
    matches = []
    unmatched_slips = []
    unmatched_txns = list(range(len(transactions)))

    for slip in slips:
        if slip.get("needs_manual_entry"):
            unmatched_slips.append(
                {
                    "slip": slip,
                    "reason": "low_ocr_confidence",
                    "confidence": slip.get("confidence", 0),
                }
            )
            continue

        best_idx = None
        best_score = 0.0
        for idx, txn in enumerate(transactions):
            if idx in used_txn:
                continue
            s = score_slip_to_transaction(slip, txn)
            if s > best_score:
                best_score = s
                best_idx = idx

        if best_idx is not None and best_score >= threshold:
            used_txn.add(best_idx)
            if best_idx in unmatched_txns:
                unmatched_txns.remove(best_idx)
            txn = transactions[best_idx]
            amount_match = abs(_norm_amount(slip.get("amount")) - _norm_amount(txn.get("amount"))) <= 1
            batch_match = _norm_ref(slip.get("batch_reference")) == _norm_ref(
                txn.get("batch_number") or txn.get("batch_reference")
            )
            matches.append(
                {
                    "slip": slip,
                    "transaction": txn,
                    "match_confidence": round(best_score, 4),
                    "amount_match": amount_match,
                    "batch_match": batch_match,
                    "mismatch": not (amount_match and batch_match),
                    "status": "matched" if amount_match and batch_match else "review_required",
                }
            )
        else:
            unmatched_slips.append(
                {
                    "slip": slip,
                    "reason": "no_bank_match",
                    "confidence": best_score,
                }
            )

    return {
        "matches": matches,
        "unmatched_slips": unmatched_slips,
        "unmatched_transactions": [transactions[i] for i in unmatched_txns],
        "matched_count": len(matches),
        "mismatch_count": sum(1 for m in matches if m.get("mismatch")),
        "match_threshold": threshold,
    }
