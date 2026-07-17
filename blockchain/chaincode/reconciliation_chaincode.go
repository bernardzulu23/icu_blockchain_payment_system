package main

import (
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

const (
	objectTypePayment   = "Payment"
	objectTypeBatchRoot = "BatchRoot"
	indexStudentPayment = "StudentPayment"
)

// Payment is a verified ledger entry for a student semester payment.
type Payment struct {
	PaymentHash string `json:"paymentHash"`
	StudentID   string `json:"studentID"`
	Amount      string `json:"amount"`
	Semester    string `json:"semester"`
	BatchNumber string `json:"batchNumber"`
	TxID        string `json:"txId"`
	RecordedAt  string `json:"recordedAt"`
}

// BatchRoot anchors an OCR batch via a single Merkle root transaction.
type BatchRoot struct {
	BatchID      string `json:"batchId"`
	MerkleRoot   string `json:"merkleRoot"`
	PaymentCount int    `json:"paymentCount"`
	SubmittedAt  string `json:"submittedAt"`
	TxID         string `json:"txId"`
}

// ClearanceEligibilityResult is returned by CheckClearanceEligibility.
type ClearanceEligibilityResult struct {
	Eligible         bool  `json:"eligible"`
	MissingSemesters []int `json:"missingSemesters"`
}

// ReconciliationChaincode implements ICU payment reconciliation on Fabric.
type ReconciliationChaincode struct {
	contractapi.Contract
}

// MatchPayment records a verified payment unless paymentHash already exists.
func (c *ReconciliationChaincode) MatchPayment(
	ctx contractapi.TransactionContextInterface,
	paymentHash, studentID, amount, semester, batchNumber string,
) error {
	if err := validateMatchPaymentArgs(paymentHash, studentID, amount, semester, batchNumber); err != nil {
		return err
	}

	existing, err := ctx.GetStub().GetState(paymentStateKey(paymentHash))
	if err != nil {
		return fmt.Errorf("failed to read ledger: %w", err)
	}
	if existing != nil && len(existing) > 0 {
		return fmt.Errorf("duplicate payment: hash %s already recorded on ledger", paymentHash)
	}

	semesterKey, err := ctx.GetStub().CreateCompositeKey(indexStudentPayment, []string{studentID, semester})
	if err != nil {
		return fmt.Errorf("failed to create student index key: %w", err)
	}
	semesterExisting, err := ctx.GetStub().GetState(semesterKey)
	if err != nil {
		return fmt.Errorf("failed to read student semester index: %w", err)
	}
	if semesterExisting != nil && len(semesterExisting) > 0 {
		return fmt.Errorf("duplicate payment: student %s already has semester %s recorded", studentID, semester)
	}

	payment := Payment{
		PaymentHash: paymentHash,
		StudentID:   studentID,
		Amount:      amount,
		Semester:    semester,
		BatchNumber: batchNumber,
		TxID:        ctx.GetStub().GetTxID(),
		RecordedAt:  time.Now().UTC().Format(time.RFC3339),
	}

	paymentBytes, err := json.Marshal(payment)
	if err != nil {
		return fmt.Errorf("failed to marshal payment: %w", err)
	}

	if err := ctx.GetStub().PutState(paymentStateKey(paymentHash), paymentBytes); err != nil {
		return fmt.Errorf("failed to write payment: %w", err)
	}
	if err := ctx.GetStub().PutState(semesterKey, paymentBytes); err != nil {
		return fmt.Errorf("failed to write student semester index: %w", err)
	}

	eventPayload, _ := json.Marshal(map[string]string{
		"paymentHash": paymentHash,
		"studentID":   studentID,
		"amount":      amount,
		"semester":    semester,
		"batchNumber": batchNumber,
		"txId":        payment.TxID,
	})
	if err := ctx.GetStub().SetEvent("PaymentVerified", eventPayload); err != nil {
		return fmt.Errorf("failed to emit PaymentVerified event: %w", err)
	}

	return nil
}

// GetStudentPaymentHistory returns all payments for a student ordered by semester.
func (c *ReconciliationChaincode) GetStudentPaymentHistory(
	ctx contractapi.TransactionContextInterface,
	studentID string,
) ([]*Payment, error) {
	if strings.TrimSpace(studentID) == "" {
		return nil, fmt.Errorf("studentID is required")
	}

	iterator, err := ctx.GetStub().GetStateByPartialCompositeKey(indexStudentPayment, []string{studentID})
	if err != nil {
		return nil, fmt.Errorf("failed to query student payments: %w", err)
	}
	defer iterator.Close()

	var payments []*Payment
	for iterator.HasNext() {
		response, err := iterator.Next()
		if err != nil {
			return nil, fmt.Errorf("failed to iterate student payments: %w", err)
		}
		var payment Payment
		if err := json.Unmarshal(response.Value, &payment); err != nil {
			return nil, fmt.Errorf("failed to unmarshal payment: %w", err)
		}
		payments = append(payments, &payment)
	}

	sort.Slice(payments, func(i, j int) bool {
		return semesterNumber(payments[i].Semester) < semesterNumber(payments[j].Semester)
	})

	return payments, nil
}

// CheckClearanceEligibility verifies semesters 1..requiredSemesters are paid.
func (c *ReconciliationChaincode) CheckClearanceEligibility(
	ctx contractapi.TransactionContextInterface,
	studentID string,
	requiredSemesters int,
) (*ClearanceEligibilityResult, error) {
	if strings.TrimSpace(studentID) == "" {
		return nil, fmt.Errorf("studentID is required")
	}
	if requiredSemesters < 1 {
		return nil, fmt.Errorf("requiredSemesters must be at least 1")
	}

	payments, err := c.GetStudentPaymentHistory(ctx, studentID)
	if err != nil {
		return nil, err
	}

	paid := make(map[int]bool)
	for _, payment := range payments {
		paid[semesterNumber(payment.Semester)] = true
	}

	missing := make([]int, 0)
	for semester := 1; semester <= requiredSemesters; semester++ {
		if !paid[semester] {
			missing = append(missing, semester)
		}
	}

	return &ClearanceEligibilityResult{
		Eligible:         len(missing) == 0,
		MissingSemesters: missing,
	}, nil
}

// SubmitBatchRoot stores one Merkle root per OCR batch for throughput efficiency.
func (c *ReconciliationChaincode) SubmitBatchRoot(
	ctx contractapi.TransactionContextInterface,
	merkleRoot, batchID string,
	paymentCount int,
) error {
	if strings.TrimSpace(merkleRoot) == "" {
		return fmt.Errorf("merkleRoot is required")
	}
	if strings.TrimSpace(batchID) == "" {
		return fmt.Errorf("batchID is required")
	}
	if paymentCount < 1 {
		return fmt.Errorf("paymentCount must be at least 1")
	}

	key, err := ctx.GetStub().CreateCompositeKey(objectTypeBatchRoot, []string{batchID})
	if err != nil {
		return fmt.Errorf("failed to create batch key: %w", err)
	}

	existing, err := ctx.GetStub().GetState(key)
	if err != nil {
		return fmt.Errorf("failed to read batch root: %w", err)
	}
	if existing != nil && len(existing) > 0 {
		return fmt.Errorf("batch root for batchID %s already exists", batchID)
	}

	record := BatchRoot{
		BatchID:      batchID,
		MerkleRoot:   merkleRoot,
		PaymentCount: paymentCount,
		SubmittedAt:  time.Now().UTC().Format(time.RFC3339),
		TxID:         ctx.GetStub().GetTxID(),
	}

	recordBytes, err := json.Marshal(record)
	if err != nil {
		return fmt.Errorf("failed to marshal batch root: %w", err)
	}
	if err := ctx.GetStub().PutState(key, recordBytes); err != nil {
		return fmt.Errorf("failed to write batch root: %w", err)
	}

	eventPayload, _ := json.Marshal(record)
	if err := ctx.GetStub().SetEvent("BatchRootSubmitted", eventPayload); err != nil {
		return fmt.Errorf("failed to emit BatchRootSubmitted event: %w", err)
	}

	return nil
}

// --- Legacy wrappers (backend compatibility during migration) ---

// RecordPayment accepts JSON payload and delegates to MatchPayment.
func (c *ReconciliationChaincode) RecordPayment(ctx contractapi.TransactionContextInterface, paymentJSON string) error {
	var legacy struct {
		ID           string  `json:"id"`
		StudentID    string  `json:"studentId"`
		Amount       float64 `json:"amount"`
		Semester     string  `json:"semester"`
		Reference    string  `json:"reference"`
		PaymentHash  string  `json:"paymentHash"`
		BatchNumber  string  `json:"batchNumber"`
	}
	if err := json.Unmarshal([]byte(paymentJSON), &legacy); err != nil {
		return fmt.Errorf("invalid payment JSON: %w", err)
	}
	hash := legacy.PaymentHash
	if hash == "" {
		hash = legacy.ID
	}
	batch := legacy.BatchNumber
	if batch == "" {
		batch = legacy.Reference
	}
	amount := strconv.FormatFloat(legacy.Amount, 'f', -1, 64)
	return c.MatchPayment(ctx, hash, legacy.StudentID, amount, legacy.Semester, batch)
}

// GetAllPayments is a legacy alias for GetStudentPaymentHistory.
func (c *ReconciliationChaincode) GetAllPayments(ctx contractapi.TransactionContextInterface, studentID string) ([]*Payment, error) {
	return c.GetStudentPaymentHistory(ctx, studentID)
}

// QueryPayment fetches a payment by student + semester via the student index.
func (c *ReconciliationChaincode) QueryPayment(
	ctx contractapi.TransactionContextInterface,
	studentID, semester, _ string,
) (*Payment, error) {
	key, err := ctx.GetStub().CreateCompositeKey(indexStudentPayment, []string{studentID, semester})
	if err != nil {
		return nil, err
	}
	bytes, err := ctx.GetStub().GetState(key)
	if err != nil {
		return nil, err
	}
	if bytes == nil || len(bytes) == 0 {
		return nil, fmt.Errorf("payment not found for student %s semester %s", studentID, semester)
	}
	var payment Payment
	if err := json.Unmarshal(bytes, &payment); err != nil {
		return nil, err
	}
	return &payment, nil
}

func validateMatchPaymentArgs(paymentHash, studentID, amount, semester, batchNumber string) error {
	if strings.TrimSpace(paymentHash) == "" {
		return fmt.Errorf("paymentHash is required")
	}
	if strings.TrimSpace(studentID) == "" {
		return fmt.Errorf("studentID is required")
	}
	if strings.TrimSpace(amount) == "" {
		return fmt.Errorf("amount is required")
	}
	if strings.TrimSpace(semester) == "" {
		return fmt.Errorf("semester is required")
	}
	if strings.TrimSpace(batchNumber) == "" {
		return fmt.Errorf("batchNumber is required")
	}
	return nil
}

func paymentStateKey(paymentHash string) string {
	return objectTypePayment + ":" + paymentHash
}

func semesterNumber(semester string) int {
	n, err := strconv.Atoi(strings.TrimSpace(semester))
	if err != nil {
		return 0
	}
	return n
}

func main() {
	chaincode, err := contractapi.NewChaincode(&ReconciliationChaincode{})
	if err != nil {
		panic(fmt.Sprintf("failed to create chaincode: %v", err))
	}
	if err := chaincode.Start(); err != nil {
		panic(fmt.Sprintf("failed to start chaincode: %v", err))
	}
}
