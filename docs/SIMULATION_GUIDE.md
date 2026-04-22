# ICU Blockchain Payment System — Simulation & Demo Guide

This guide walks you through simulating the full payment reconciliation flow for demonstrations, testing, or project defense.

---

## Prerequisites

- Backend running (`npm run dev:backend` or `cd backend && npm start`)
- Frontend running (`npm run dev:frontend` or `cd frontend && npm run dev`)
- Database seeded (run `cd backend && node scripts/seed.js` if needed)
- Python matching service (optional, for bank statement matching): `cd backend/python-services && python api_server.py`

---

## Simulation Scenarios

### Scenario 1: Student Submits Deposit Slip

**Actor:** Student  
**Goal:** Submit a payment and receive confirmation

1. **Login as Student**
   - Go to `http://localhost:5173` (or your frontend URL)
   - Click "Student Login"
   - Use credentials: `student_number` / `password` (from seed or registered student)

2. **Submit Payment**
   - Navigate to "Submit Payment" or "My Payments"
   - Fill in: Semester (e.g. `1`), Academic Year (e.g. `2025`), Amount (e.g. `5000`), Batch Number (e.g. `TXN-2025-001`), Bank Name, Payment Date
   - Upload a deposit slip image (PNG/JPG)
   - Click "Submit"

3. **Expected Result**
   - Success message
   - Payment appears in "My Payments" with status `pending`
   - Accountant receives email notification (if SendGrid configured)

---

### Scenario 2: Accountant Verifies Payment (Single)

**Actor:** Accountant  
**Goal:** Manually verify a student's payment

1. **Login as Accountant/Admin**
   - Staff login with `admin` / `admin123` (or your accountant credentials)

2. **View Pending Payments**
   - Go to "Verification" or "Pending Payments"
   - Find the student's payment with status `pending` or `manual_review`

3. **Verify**
   - Click "Approve" (or "Verify")
   - Optionally add notes
   - Confirm

4. **Expected Result**
   - Payment status changes to `verified`
   - Blockchain TX ID recorded (or dev placeholder)
   - Statement PDF generated
   - Student receives SMS and email with proof-of-no-balance document (password = student number)

---

### Scenario 3: Accountant Uploads Bank Statement & Bulk Verify

**Actor:** Accountant  
**Goal:** Upload bank PDF, run matching, verify all auto-matched payments

1. **Upload Bank Statement**
   - Go to "Upload Statement" or "Bank Statements"
   - Select bank name, upload date
   - Upload a PDF containing batch numbers and amounts (or use sample from `backend/python-services/` if available)

2. **Run Matching** (if Python service is running)
   - The system may auto-trigger matching, or use the `/match-payments` endpoint
   - Payments with matching batch numbers get status `auto_matched`

3. **Verify All Auto-Matched**
   - Go to "Verification" or "Verify All"
   - Click "Verify All Auto-Matched"
   - Confirm

4. **Expected Result**
   - All auto-matched payments become `verified`
   - Each student receives notification
   - Statement PDFs generated for each

---

### Scenario 4: Student Requests Clearance

**Actor:** Student  
**Goal:** Request graduation clearance after all payments verified

1. **Prerequisites**
   - Student must have verified payments for required semesters (e.g. 1–8)
   - Bank batch numbers must be confirmed (admin uploads bank PDF)

2. **Request Clearance**
   - Login as student
   - Go to "Clearance" or "Request Clearance"
   - Select clearance type (e.g. graduation)
   - Click "Request Clearance"

3. **Expected Result**
   - If eligible: Clearance request created with status `pending`
   - If not eligible: Message listing missing semesters

---

### Scenario 5: Accountant/Admin Approves Clearance

**Actor:** Accountant or Admin  
**Goal:** Approve clearance and generate certificate

1. **View Clearance Requests**
   - Login as accountant/admin
   - Go to "Mass Clearance" or "Clearance Requests"
   - Filter by status `pending`

2. **Approve**
   - Select one or more clearance requests
   - Click "Approve" (or "Mass Verify" with status `approved`)

3. **Expected Result**
   - Clearance status → `approved`
   - Payment Completion Certificate PDF generated (signed by Accounts Staff, Admin Officer, Registrar)
   - Student can download certificate from "Clearance" page

---

## Demo Data (Seed Script)

Ensure you have test users and data:

```bash
cd backend
node scripts/seed.js
```

This typically creates:
- Admin user: `admin` / `admin123`
- Sample students (if defined in seed)
- You may need to register a student via Admin → Register Student

---

## Quick Demo Script (5 Minutes)

| Step | Actor    | Action                          | Time |
|------|----------|----------------------------------|------|
| 1    | Admin    | Login, register student "Demo User" | 0:30 |
| 2    | Student  | Login, submit payment (Sem 1, 2025, K5000, batch TXN001) | 1:00 |
| 3    | Accountant| Login, verify the payment        | 0:45 |
| 4    | Student  | Check "My Payments" — see verified | 0:30 |
| 5    | Student  | Request clearance (if eligible)  | 0:30 |
| 6    | Accountant| Approve clearance               | 0:45 |
| 7    | Student  | Download certificate            | 0:30 |

---

## Mockup Reference

Visual mockups for key screens are in `assets/`:

- `mockup-student-dashboard.png` — Student portal dashboard
- `mockup-accountant-dashboard.png` — Accountant verification dashboard
- `mockup-registrar-clearance.png` — Registrar clearance queue
- `mockup-payment-flow.png` — End-to-end payment flow diagram

Use these for presentations, README, or design reference.

---

## Troubleshooting

| Issue | Check |
|-------|-------|
| Login fails | Verify user exists in `users` or `students` table; check password hash |
| No pending payments | Seed more data or submit as student first |
| Matching not working | Ensure Python service is running; check `PYTHON_SERVICE_URL` |
| Certificate not generated | Ensure clearance is `approved`; check `generatePaymentCompletionCertificatePDF` in clearanceController |
| SMS/Email not sent | Check Africa's Talking and SendGrid env vars; logs show "skipping" if not configured |
