package main

import (
	"encoding/json"
	"fmt"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

type Payment struct {
	ID          string  `json:"id"`
	StudentID   string  `json:"studentId"`
	StudentName string  `json:"studentName"`
	Semester    string  `json:"semester"`
	AcademicYear string `json:"academicYear"`
	Amount      float64 `json:"amount"`
	Currency    string  `json:"currency"`
	Reference   string  `json:"reference"`
	Status      string  `json:"status"`
	Timestamp   string  `json:"timestamp"`
}

type PaymentContract struct {
	contractapi.Contract
}

func (c *PaymentContract) RecordPayment(ctx contractapi.TransactionContextInterface, paymentJSON string) error {
	var payment Payment
	if err := json.Unmarshal([]byte(paymentJSON), &payment); err != nil {
		return fmt.Errorf("invalid payment JSON: %w", err)
	}
	if payment.ID == "" || payment.StudentID == "" || payment.Reference == "" {
		return fmt.Errorf("payment must have id, studentId, and reference")
	}
	if payment.Semester == "" || payment.AcademicYear == "" {
		return fmt.Errorf("payment must have semester and academicYear")
	}
	compositeKey, err := ctx.GetStub().CreateCompositeKey("Payment", []string{payment.StudentID, payment.Semester, payment.AcademicYear})
	if err != nil {
		return err
	}
	existing, err := ctx.GetStub().GetState(compositeKey)
	if err != nil {
		return err
	}
	if existing != nil {
		return fmt.Errorf("payment %s already exists (duplicate)", payment.ID)
	}
	paymentBytes, _ := json.Marshal(payment)
	return ctx.GetStub().PutState(compositeKey, paymentBytes)
}

func (c *PaymentContract) GetPayment(ctx contractapi.TransactionContextInterface, paymentID string) (*Payment, error) {
	bytes, err := ctx.GetStub().GetState(paymentID)
	if err != nil {
		return nil, err
	}
	if bytes == nil {
		return nil, fmt.Errorf("payment %s not found", paymentID)
	}
	var payment Payment
	if err := json.Unmarshal(bytes, &payment); err != nil {
		return nil, err
	}
	return &payment, nil
}

func (c *PaymentContract) QueryPayment(ctx contractapi.TransactionContextInterface, studentId, semester, academicYear string) (*Payment, error) {
	compositeKey, err := ctx.GetStub().CreateCompositeKey("Payment", []string{studentId, semester, academicYear})
	if err != nil {
		return nil, err
	}
	bytes, err := ctx.GetStub().GetState(compositeKey)
	if err != nil {
		return nil, err
	}
	if bytes == nil || len(bytes) == 0 {
		return nil, fmt.Errorf("payment not found for student %s semester %s %s", studentId, semester, academicYear)
	}
	var payment Payment
	if err := json.Unmarshal(bytes, &payment); err != nil {
		return nil, err
	}
	return &payment, nil
}

func (c *PaymentContract) GetAllPayments(ctx contractapi.TransactionContextInterface, studentId string) ([]*Payment, error) {
	resultsIterator, err := ctx.GetStub().GetStateByPartialCompositeKey("Payment", []string{studentId})
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	var payments []*Payment
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}
		var payment Payment
		if err := json.Unmarshal(queryResponse.Value, &payment); err != nil {
			return nil, err
		}
		payments = append(payments, &payment)
	}
	return payments, nil
}

func (c *PaymentContract) VerifyPayment(ctx contractapi.TransactionContextInterface, paymentID string) error {
	bytes, err := ctx.GetStub().GetState(paymentID)
	if err != nil {
		return err
	}
	if bytes == nil {
		return fmt.Errorf("payment %s not found", paymentID)
	}
	var payment Payment
	if err := json.Unmarshal(bytes, &payment); err != nil {
		return err
	}
	payment.Status = "verified"
	paymentBytes, _ := json.Marshal(payment)
	return ctx.GetStub().PutState(paymentID, paymentBytes)
}

func main() {
	cc, err := contractapi.NewChaincode(&PaymentContract{})
	if err != nil {
		panic(err)
	}
	if err := cc.Start(); err != nil {
		panic(err)
	}
}
