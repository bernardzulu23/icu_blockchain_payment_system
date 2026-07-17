package main

import (
	"encoding/json"
	"fmt"
	"strconv"
	"testing"

	"github.com/hyperledger/fabric-chaincode-go/shim"
	"github.com/hyperledger/fabric-chaincode-go/shimtest"
	"github.com/hyperledger/fabric-contract-api-go/contractapi"
	"github.com/stretchr/testify/require"
)

func newTestContext(t *testing.T) (contractapi.TransactionContextInterface, *shimtest.MockStub) {
	t.Helper()
	stub := shimtest.NewMockStub("ReconciliationChaincode", nil)
	ctx := contractapi.NewTransactionContext(stub)
	return ctx, stub
}

func TestMatchPayment_Success(t *testing.T) {
	cc := &ReconciliationChaincode{}
	ctx, stub := newTestContext(t)

	err := cc.MatchPayment(ctx, "hash-001", "STU001", "5000", "1", "BATCH-1001")
	require.NoError(t, err)

	stored, err := stub.GetState(paymentStateKey("hash-001"))
	require.NoError(t, err)
	require.NotNil(t, stored)

	var payment Payment
	require.NoError(t, json.Unmarshal(stored, &payment))
	require.Equal(t, "hash-001", payment.PaymentHash)
	require.Equal(t, "STU001", payment.StudentID)
	require.Equal(t, "5000", payment.Amount)
	require.Equal(t, "1", payment.Semester)
	require.Equal(t, "BATCH-1001", payment.BatchNumber)

	events := stub.ChaincodeEvents
	require.Len(t, events, 1)
	require.Equal(t, "PaymentVerified", events[0].EventName)
}

func TestMatchPayment_DuplicateRejected(t *testing.T) {
	cc := &ReconciliationChaincode{}
	ctx, _ := newTestContext(t)

	require.NoError(t, cc.MatchPayment(ctx, "hash-dup", "STU001", "5000", "1", "BATCH-1"))

	err := cc.MatchPayment(ctx, "hash-dup", "STU001", "5000", "2", "BATCH-2")
	require.Error(t, err)
	require.Contains(t, err.Error(), "duplicate payment")
}

func TestCheckClearanceEligibility_MissingSemesters(t *testing.T) {
	cc := &ReconciliationChaincode{}
	ctx, _ := newTestContext(t)

	require.NoError(t, cc.MatchPayment(ctx, "h1", "STU002", "5000", "1", "B1"))
	require.NoError(t, cc.MatchPayment(ctx, "h3", "STU002", "5000", "3", "B3"))

	result, err := cc.CheckClearanceEligibility(ctx, "STU002", 4)
	require.NoError(t, err)
	require.False(t, result.Eligible)
	require.Equal(t, []int{2, 4}, result.MissingSemesters)
}

func TestCheckClearanceEligibility_AllSemestersPaid(t *testing.T) {
	cc := &ReconciliationChaincode{}
	ctx, _ := newTestContext(t)

	for semester := 1; semester <= 4; semester++ {
		hash := fmt.Sprintf("hash-stu003-%d", semester)
		err := cc.MatchPayment(ctx, hash, "STU003", "5000", strconv.Itoa(semester), "BATCH")
		require.NoError(t, err)
	}

	result, err := cc.CheckClearanceEligibility(ctx, "STU003", 4)
	require.NoError(t, err)
	require.True(t, result.Eligible)
	require.Empty(t, result.MissingSemesters)
}

func TestGetStudentPaymentHistory_OrderedBySemester(t *testing.T) {
	cc := &ReconciliationChaincode{}
	ctx, _ := newTestContext(t)

	require.NoError(t, cc.MatchPayment(ctx, "h8", "STU004", "5000", "8", "B8"))
	require.NoError(t, cc.MatchPayment(ctx, "h2", "STU004", "5000", "2", "B2"))
	require.NoError(t, cc.MatchPayment(ctx, "h5", "STU004", "5000", "5", "B5"))

	history, err := cc.GetStudentPaymentHistory(ctx, "STU004")
	require.NoError(t, err)
	require.Len(t, history, 3)
	require.Equal(t, "2", history[0].Semester)
	require.Equal(t, "5", history[1].Semester)
	require.Equal(t, "8", history[2].Semester)
}

func TestSubmitBatchRoot_Success(t *testing.T) {
	cc := &ReconciliationChaincode{}
	ctx, stub := newTestContext(t)

	err := cc.SubmitBatchRoot(ctx, "0xabc123merkle", "BATCH-OCR-42", 150)
	require.NoError(t, err)

	key, err := stub.CreateCompositeKey(objectTypeBatchRoot, []string{"BATCH-OCR-42"})
	require.NoError(t, err)

	stored, err := stub.GetState(key)
	require.NoError(t, err)
	require.NotNil(t, stored)

	var record BatchRoot
	require.NoError(t, json.Unmarshal(stored, &record))
	require.Equal(t, "0xabc123merkle", record.MerkleRoot)
	require.Equal(t, 150, record.PaymentCount)

	events := stub.ChaincodeEvents
	require.Len(t, events, 1)
	require.Equal(t, "BatchRootSubmitted", events[0].EventName)
}

func TestSubmitBatchRoot_DuplicateRejected(t *testing.T) {
	cc := &ReconciliationChaincode{}
	ctx, _ := newTestContext(t)

	require.NoError(t, cc.SubmitBatchRoot(ctx, "root-a", "BATCH-DUP", 10))
	err := cc.SubmitBatchRoot(ctx, "root-b", "BATCH-DUP", 20)
	require.Error(t, err)
	require.Contains(t, err.Error(), "already exists")
}

// Ensure mock stub satisfies shim interface used by contract API.
var _ shim.ChaincodeStubInterface = (*shimtest.MockStub)(nil)
