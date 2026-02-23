/*
 * ICU Payment System - Hyperledger Fabric Chaincode
 * Smart contract for immutable payment record storage
 */

package main

import (
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// PaymentContract provides functions for managing payments on blockchain
type PaymentContract struct {
	contractapi.Contract
}

// Payment represents a verified student payment
type Payment struct {
	PaymentID      string    `json:"payment_id"`
	StudentID      string    `json:"student_id"`
	StudentNumber  string    `json:"student_number"`
	Semester       string    `json:"semester"`
	AcademicYear   string    `json:"academic_year"`
	Amount         float64   `json:"amount"`
	BatchNumber    string    `json:"batch_number"`
	BankName       string    `json:"bank_name"`
	PaymentDate    string    `json:"payment_date"`
	VerifiedBy     string    `json:"verified_by"`
	VerifiedDate   time.Time `json:"verified_date"`
	BlockchainTxID string    `json:"blockchain_tx_id"`
	RecordedAt     time.Time `json:"recorded_at"`
}

// PaymentHistory represents the history of a payment (for audit trail)
type PaymentHistory struct {
	TxID      string    `json:"tx_id"`
	Timestamp time.Time `json:"timestamp"`
	Payment   Payment   `json:"payment"`
}

// InitLedger initializes the chaincode
func (c *PaymentContract) InitLedger(ctx contractapi.TransactionContextInterface) error {
	fmt.Println("ICU Payment System Chaincode Initialized")
	return nil
}

// RecordPayment records a verified payment on the blockchain
// All args are strings (Fabric convention); amountStr is parsed to float64
func (c *PaymentContract) RecordPayment(
	ctx contractapi.TransactionContextInterface,
	paymentID string,
	studentID string,
	studentNumber string,
	semester string,
	academicYear string,
	amountStr string,
	batchNumber string,
	bankName string,
	paymentDate string,
	verifiedBy string,
) error {

	// Check if payment already exists
	existingPayment, err := ctx.GetStub().GetState(paymentID)
	if err != nil {
		return fmt.Errorf("failed to read from world state: %v", err)
	}
	if existingPayment != nil {
		return fmt.Errorf("payment %s already exists on blockchain", paymentID)
	}

	amount, err := strconv.ParseFloat(amountStr, 64)
	if err != nil {
		return fmt.Errorf("invalid amount: %v", err)
	}

	// Get transaction ID
	txID := ctx.GetStub().GetTxID()

	// Create payment record
	payment := Payment{
		PaymentID:      paymentID,
		StudentID:      studentID,
		StudentNumber:  studentNumber,
		Semester:       semester,
		AcademicYear:   academicYear,
		Amount:         amount,
		BatchNumber:    batchNumber,
		BankName:       bankName,
		PaymentDate:    paymentDate,
		VerifiedBy:     verifiedBy,
		VerifiedDate:   time.Now(),
		BlockchainTxID: txID,
		RecordedAt:     time.Now(),
	}

	// Convert to JSON
	paymentJSON, err := json.Marshal(payment)
	if err != nil {
		return fmt.Errorf("failed to marshal payment: %v", err)
	}

	// Store on ledger
	err = ctx.GetStub().PutState(paymentID, paymentJSON)
	if err != nil {
		return fmt.Errorf("failed to put payment on ledger: %v", err)
	}

	// Create composite key for student query (student_id + semester + year)
	indexKey, err := ctx.GetStub().CreateCompositeKey("student~semester~year", []string{
		studentID,
		semester,
		academicYear,
	})
	if err != nil {
		return fmt.Errorf("failed to create composite key: %v", err)
	}

	// Store index (value is paymentID for efficient lookup)
	err = ctx.GetStub().PutState(indexKey, []byte(paymentID))
	if err != nil {
		return fmt.Errorf("failed to put index on ledger: %v", err)
	}

	// Emit event
	eventPayload, _ := json.Marshal(map[string]interface{}{
		"payment_id":    paymentID,
		"student_id":    studentID,
		"semester":      semester,
		"academic_year": academicYear,
		"amount":        amount,
		"tx_id":         txID,
	})

	err = ctx.GetStub().SetEvent("PaymentRecorded", eventPayload)
	if err != nil {
		return fmt.Errorf("failed to set event: %v", err)
	}

	return nil
}

// GetPayment retrieves a payment by ID
func (c *PaymentContract) GetPayment(ctx contractapi.TransactionContextInterface, paymentID string) (*Payment, error) {
	paymentJSON, err := ctx.GetStub().GetState(paymentID)
	if err != nil {
		return nil, fmt.Errorf("failed to read from world state: %v", err)
	}
	if paymentJSON == nil {
		return nil, fmt.Errorf("payment %s does not exist", paymentID)
	}

	var payment Payment
	err = json.Unmarshal(paymentJSON, &payment)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal payment: %v", err)
	}

	return &payment, nil
}

// GetStudentPayments retrieves all payments for a student
func (c *PaymentContract) GetStudentPayments(ctx contractapi.TransactionContextInterface, studentID string) ([]*Payment, error) {
	// Query by composite key to get payment IDs, then fetch each payment
	resultsIterator, err := ctx.GetStub().GetStateByPartialCompositeKey("student~semester~year", []string{studentID})
	if err != nil {
		return nil, fmt.Errorf("failed to get student payments: %v", err)
	}
	defer resultsIterator.Close()

	var paymentIDs []string
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, fmt.Errorf("failed to iterate results: %v", err)
		}
		_, compositeKeyParts, err := ctx.GetStub().SplitCompositeKey(queryResponse.Key)
		if err != nil {
			continue
		}
		if len(compositeKeyParts) >= 3 {
			paymentID := string(queryResponse.Value)
			if paymentID != "" {
				paymentIDs = append(paymentIDs, paymentID)
			}
		}
	}

	var payments []*Payment
	for _, pid := range paymentIDs {
		payment, err := c.GetPayment(ctx, pid)
		if err != nil {
			continue
		}
		payments = append(payments, payment)
	}

	return payments, nil
}

// VerifyPayment verifies if a payment exists for a student in a specific semester
func (c *PaymentContract) VerifyPayment(
	ctx contractapi.TransactionContextInterface,
	studentID string,
	semester string,
	academicYear string,
) (bool, error) {

	indexKey, err := ctx.GetStub().CreateCompositeKey("student~semester~year", []string{
		studentID,
		semester,
		academicYear,
	})
	if err != nil {
		return false, fmt.Errorf("failed to create composite key: %v", err)
	}

	value, err := ctx.GetStub().GetState(indexKey)
	if err != nil {
		return false, fmt.Errorf("failed to read from world state: %v", err)
	}

	return value != nil, nil
}

// GetPaymentHistory retrieves the complete history of a payment (all transactions)
func (c *PaymentContract) GetPaymentHistory(ctx contractapi.TransactionContextInterface, paymentID string) ([]*PaymentHistory, error) {
	resultsIterator, err := ctx.GetStub().GetHistoryForKey(paymentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get payment history: %v", err)
	}
	defer resultsIterator.Close()

	var history []*PaymentHistory

	for resultsIterator.HasNext() {
		response, err := resultsIterator.Next()
		if err != nil {
			return nil, fmt.Errorf("failed to iterate history: %v", err)
		}

		var payment Payment
		if len(response.Value) > 0 {
			err = json.Unmarshal(response.Value, &payment)
			if err != nil {
				return nil, fmt.Errorf("failed to unmarshal payment: %v", err)
			}
		}

		var ts time.Time
		if response.Timestamp != nil {
			ts = time.Unix(response.Timestamp.Seconds, int64(response.Timestamp.Nanos))
		}

		historyRecord := &PaymentHistory{
			TxID:      response.TxId,
			Timestamp: ts,
			Payment:   payment,
		}

		history = append(history, historyRecord)
	}

	return history, nil
}

// GetAllPayments retrieves all payments (for admin/reporting)
func (c *PaymentContract) GetAllPayments(ctx contractapi.TransactionContextInterface) ([]*Payment, error) {
	resultsIterator, err := ctx.GetStub().GetStateByRange("", "")
	if err != nil {
		return nil, fmt.Errorf("failed to get all payments: %v", err)
	}
	defer resultsIterator.Close()

	var payments []*Payment

	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, fmt.Errorf("failed to iterate: %v", err)
		}

		var payment Payment
		err = json.Unmarshal(queryResponse.Value, &payment)
		if err != nil {
			continue // Skip non-payment records (e.g. index keys)
		}

		if payment.PaymentID != "" {
			payments = append(payments, &payment)
		}
	}

	return payments, nil
}

// QueryPaymentsByDateRange retrieves payments within a date range
// Requires CouchDB as state database (LevelDB does not support rich queries)
func (c *PaymentContract) QueryPaymentsByDateRange(
	ctx contractapi.TransactionContextInterface,
	startDate string,
	endDate string,
) ([]*Payment, error) {

	queryString := fmt.Sprintf(`{
		"selector": {
			"payment_date": {
				"$gte": "%s",
				"$lte": "%s"
			}
		}
	}`, startDate, endDate)

	resultsIterator, err := ctx.GetStub().GetQueryResult(queryString)
	if err != nil {
		return nil, fmt.Errorf("failed to execute query (CouchDB required): %v", err)
	}
	defer resultsIterator.Close()

	var payments []*Payment

	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, fmt.Errorf("failed to iterate query results: %v", err)
		}

		var payment Payment
		err = json.Unmarshal(queryResponse.Value, &payment)
		if err != nil {
			return nil, fmt.Errorf("failed to unmarshal payment: %v", err)
		}

		payments = append(payments, &payment)
	}

	return payments, nil
}

// GetPaymentCount returns total number of payments on blockchain
func (c *PaymentContract) GetPaymentCount(ctx contractapi.TransactionContextInterface) (int, error) {
	resultsIterator, err := ctx.GetStub().GetStateByRange("", "")
	if err != nil {
		return 0, fmt.Errorf("failed to get payments: %v", err)
	}
	defer resultsIterator.Close()

	count := 0
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return 0, fmt.Errorf("failed to iterate: %v", err)
		}

		var payment Payment
		if json.Unmarshal(queryResponse.Value, &payment) == nil && payment.PaymentID != "" {
			count++
		}
	}

	return count, nil
}

func main() {
	chaincode, err := contractapi.NewChaincode(&PaymentContract{})
	if err != nil {
		fmt.Printf("Error creating payment chaincode: %v\n", err)
		return
	}

	if err := chaincode.Start(); err != nil {
		fmt.Printf("Error starting payment chaincode: %v\n", err)
	}
}
