#!/usr/bin/env python3
"""
Verification script for ICU Payment System Python matching fixes.
Run from backend/python-services: python verify_fixes.py
Requires: postgres running, migrations applied, python-service dependencies.
"""
import os
import sys
from datetime import date, timedelta

# Add current dir for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_normalize_batch():
    """FIX 5: TXN-001, txn001, #TXN001, 000TXN001 should all normalize to same value."""
    from batch_matching import normalize_batch

    refs = ["TXN-001", "txn001", "#TXN001", "000TXN001", "TXN001"]
    expected = normalize_batch("TXN001")
    for r in refs:
        assert normalize_batch(r) == expected, f"{r} -> {normalize_batch(r)} != {expected}"
    print("PASS: normalize_batch - TXN-001, txn001, #TXN001, 000TXN001 all match")


def test_batch_match_normalization():
    """FIX 5: Batch variants should match in match_batch."""
    from batch_matching import match_batch, normalize_batch

    # Bank text contains "TXN-001" with amount 500
    bank_text = "Date 01/01/2024  Ref TXN-001  Amount 500.00"
    payments = [
        {"studentId": "S1", "studentName": "A", "amount": 500, "reference": "txn001"},
        {"studentId": "S2", "studentName": "B", "amount": 500, "reference": "#TXN001"},
        {"studentId": "S3", "studentName": "C", "amount": 500, "reference": "000TXN001"},
    ]
    result = match_batch(payments, bank_text)
    matched = [r for r in result["results"] if r["status"] == "matched"]
    assert len(matched) == 3, f"Expected 3 matched, got {len(matched)}: {result}"
    print("PASS: match_batch - TXN-001, txn001, #TXN001, 000TXN001 all match each other")


def test_k40_amount_auto_match():
    """FIX 2+3: Exact batch + K40 amount diff should score >= 70% and auto-match."""
    from batch_matching_service import match_payment_to_transaction

    payment = {
        "batch_number": "BN12345",
        "amount": 1000.0,
        "payment_date": date(2024, 1, 15),
    }
    transactions = [
        {
            "transaction_id": "t1",
            "batch_number": "BN12345",
            "amount": 1040.0,  # K40 diff
            "date": date(2024, 1, 15),
            "matched": False,
        }
    ]
    match = match_payment_to_transaction(payment, transactions)
    assert match is not None, "Expected a match"
    assert match["confidence"] >= 0.70, f"Expected >= 70%%, got {match['confidence']*100}%%"
    print(f"PASS: K40 amount diff scores {match['confidence']*100:.1f}%% -> auto_matched")


def test_batch_date_no_amount():
    """FIX 3: Exact batch + date within 7 days, no amount match should still score >= 70%."""
    from batch_matching_service import match_payment_to_transaction

    # "no amount data" - use 0 or very different amounts so amount scoring gives 0
    payment = {
        "batch_number": "BN99999",
        "amount": 500.0,
        "payment_date": date(2024, 1, 10),
    }
    transactions = [
        {
            "transaction_id": "t1",
            "batch_number": "BN99999",
            "amount": 999999.0,  # Huge diff - amount scoring would give 0
            "date": date(2024, 1, 15),  # 5 days diff -> 10 pts
            "matched": False,
        }
    ]
    match = match_payment_to_transaction(payment, transactions)
    # Batch 60 + amount 0 (diff > 50) + date 10 = 70
    assert match is not None, "Expected a match"
    assert match["confidence"] >= 0.70, f"Expected >= 70%%, got {match['confidence']*100}%%"
    print(f"PASS: Batch+date(7d) scores {match['confidence']*100:.1f}%% -> auto_match")


def main():
    print("=" * 60)
    print("ICU Payment System - Verification of Fixes")
    print("=" * 60)

    test_normalize_batch()
    test_batch_match_normalization()
    test_k40_amount_auto_match()
    test_batch_date_no_amount()

    print()
    print("All unit verifications PASSED.")
    print()
    print("Integration checks (require DB + services):")
    print("  1. Run /match-payments twice - 2nd run: 'No pending payments to match'")
    print("  2. K40 amount diff -> auto_matched (verified above)")
    print("  3. Batch + date 7d, no amount -> >= 70%% (verified above)")
    print("  4. /manual-match -> query DB to confirm status/links updated")
    print("  5. Batch normalization (verified above)")
    print()


if __name__ == "__main__":
    main()
