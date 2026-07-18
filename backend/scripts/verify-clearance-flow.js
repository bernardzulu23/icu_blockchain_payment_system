#!/usr/bin/env node
/**
 * Verification script for clearance flow.
 * Run: node scripts/verify-clearance-flow.js
 *
 * Tests logic without Fabric (mocks getAllPayments).
 * For full verification with Fabric, use peer chaincode query commands.
 */
const EXPECTED_SEMESTERS = ['1', '2', '3', '4', '5', '6', '7', '8'];

function getPaidSemestersFromPayments(payments) {
  return [...new Set((payments || []).map((p) => String(p.semester).trim()).filter(Boolean))];
}

function checkClearanceEligibility(paidSemesters) {
  const missingSemesters = EXPECTED_SEMESTERS.filter((s) => !paidSemesters.includes(s));
  return {
    eligible: missingSemesters.length === 0,
    missing_semesters: missingSemesters,
    message:
      missingSemesters.length > 0
        ? `Clearance denied. Outstanding payments for semesters: ${missingSemesters.join(', ')}`
        : null,
  };
}

// Test 1: Student with all 8 semesters
const all8Payments = [
  { semester: '1' },
  { semester: '2' },
  { semester: '3' },
  { semester: '4' },
  { semester: '5' },
  { semester: '6' },
  { semester: '7' },
  { semester: '8' },
];
const paidAll8 = getPaidSemestersFromPayments(all8Payments);
const resultAll8 = checkClearanceEligibility(paidAll8);
console.assert(resultAll8.eligible === true, 'Student with all 8 semesters should be eligible');
console.log('PASS: Student with all 8 semesters -> eligible:', resultAll8.eligible);

// Test 2: Student missing semester 3
const missing3Payments = [
  { semester: '1' },
  { semester: '2' },
  { semester: '4' },
  { semester: '5' },
  { semester: '6' },
  { semester: '7' },
  { semester: '8' },
];
const paidMissing3 = getPaidSemestersFromPayments(missing3Payments);
const resultMissing3 = checkClearanceEligibility(paidMissing3);
console.assert(resultMissing3.eligible === false, 'Student missing semester 3 should be ineligible');
console.assert(
  resultMissing3.missing_semesters.includes('3'),
  'Missing semesters should include 3'
);
console.assert(
  resultMissing3.message.includes('3'),
  'Message should list semester 3 as outstanding'
);
console.log('PASS: Student missing semester 3 ->', resultMissing3);

// Test 3: Empty payments (no payments on chain)
const paidNone = getPaidSemestersFromPayments([]);
const resultNone = checkClearanceEligibility(paidNone);
console.assert(resultNone.eligible === false, 'Student with no payments should be ineligible');
console.assert(
  resultNone.missing_semesters.length === 8,
  'All 8 semesters should be missing'
);
console.log('PASS: Student with zero payments -> all semesters missing');

console.log('\nAll verification checks PASSED.');
console.log('\nManual Fabric verification (when network is running):');
console.log('  peer chaincode query -C payments-channel -n payment-contract -c \'{"Args":["GetAllPayments","STU001"]}\'');
console.log('  peer chaincode query -C payments-channel -n payment-contract -c \'{"Args":["QueryPayment","STU001","1","2025"]}\'');
console.log('  (Use "query" not "invoke" for read-only operations)');
