# ICU Blockchain Payment System — UI Mockups

Visual mockups for key screens and flows. Use these for presentations, design reference, or project documentation.

**Single HTML mockup:** Open [`assets/mockups.html`](../assets/mockups.html) in a browser to view all mockups in one page.

---

## Screens

### Student Dashboard

![Student Dashboard](../assets/mockup-student-dashboard.png)

- Student portal home
- Payment status overview
- Quick actions: Submit Deposit Slip, Request Clearance
- Recent payments table

---

### Accountant Dashboard

![Accountant Dashboard](../assets/mockup-accountant-dashboard.png)

- Pending verification queue
- Upload Bank Statement
- Stats: Pending, Auto-Matched, Verified
- Bulk verification actions

---

### Registrar Clearance

![Registrar Clearance](../assets/mockup-registrar-clearance.png)

- Clearance requests list
- Approve / Reject actions
- Status badges and statistics

---

## Payment Flow

![Payment Flow](../assets/mockup-payment-flow.png)

End-to-end flow:

1. **Student** uploads deposit slip
2. **Python service** extracts batch numbers from bank PDF
3. **Auto-matching** marks payments
4. **Accountant** verifies
5. **Blockchain** records payment
6. **Student** receives SMS/email with proof document

---

## File Locations

| Mockup | Path |
|--------|------|
| **All in one** | `assets/mockups.html` |
| Student Dashboard | `assets/mockup-student-dashboard.png` |
| Accountant Dashboard | `assets/mockup-accountant-dashboard.png` |
| Registrar Clearance | `assets/mockup-registrar-clearance.png` |
| Payment Flow | `assets/mockup-payment-flow.png` |
