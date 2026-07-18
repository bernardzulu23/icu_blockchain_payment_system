import { apiClient } from './client';
import type { ListParams, PaginatedResponse } from '../types/api';

export interface CreateStudentData {
  studentId: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  program?: string;
  department?: string;
  dateOfBirth?: string;
  currentSemester?: number | string;
  currentTerm?: number | string;
  admissionYear?: number | string;
  password: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'accountant' | 'registrar' | 'student';
}

export interface StaffUser {
  user_id: string;
  username: string;
  email: string;
  full_name: string;
  role: 'admin' | 'accountant' | 'registrar';
  status: string;
  created_at?: string;
  last_login?: string;
}

export interface Payment {
  id: string;
  studentId: string;
  studentName: string;
  amount: number;
  currency: string;
  reference: string;
  status: string;
  txHash?: string;
  createdAt: string;
  verifiedAt?: string;
  semester?: string;
  academicYear?: string;
}

export interface StudentProfile {
  student_id: string;
  student_number: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  program?: string;
  department?: string;
  date_of_birth?: string;
  current_semester?: number;
  current_term?: number;
  profile_picture_url?: string;
  admission_year?: number;
  status?: string;
}

export interface ClearanceRequest {
  clearance_id: string;
  student_id: string;
  student_name?: string;
  student_number?: string;
  clearance_type: string;
  status: string;
  requested_date?: string;
  clearance_certificate_url?: string;
}

export interface Feedback {
  feedback_id: string;
  user_id: string;
  user_type: string;
  user_name: string;
  message: string;
  rating?: number;
  created_at: string;
}

export interface Notification {
  notification_id: string;
  recipient_id: string;
  recipient_type: string;
  notification_type: string;
  title: string;
  message: string;
  read: boolean;
  read_at?: string;
  created_at: string;
}

export interface BankStatement {
  statement_id: string;
  upload_date: string;
  bank_name: string;
  statement_pdf_url: string;
  uploaded_by: string;
  processed: boolean;
  total_transactions: number;
  matched_count: number;
  unmatched_count: number;
  created_at: string;
}

export interface AuditLog {
  log_id: string;
  user_id: string;
  user_type: string;
  action: string;
  entity_type: string;
  entity_id: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface BatchVerificationResult {
  preview?: boolean;
  message?: string;
  totalProcessed: number;
  matched: number;
  unmatched: number;
  duplicates: number;
  results: Array<{
    studentId: string;
    studentName: string;
    amount: number;
    status: string;
    bankRef?: string;
  }>;
}

export interface OcrSlipResult {
  filename?: string;
  student_id?: string;
  amount?: number;
  date?: string;
  batch_reference?: string;
  confidence: number;
  needs_manual_entry?: boolean;
  template?: string;
  template_name?: string;
}

export interface OcrMatchPair {
  slip: OcrSlipResult;
  transaction: { batch_number?: string; amount?: number; date?: string; raw_line?: string };
  match_confidence: number;
  amount_match: boolean;
  batch_match: boolean;
  mismatch: boolean;
  status: string;
}

export interface OcrReconciliationResult {
  batch_id: string;
  status: string;
  merkle_root: string;
  payment_count: number;
  processing_ms: number;
  manual_flag_rate: number;
  manual_flag_count: number;
  slips: OcrSlipResult[];
  bank_transactions: Array<Record<string, unknown>>;
  matching: {
    matches: OcrMatchPair[];
    unmatched_slips: Array<{ slip: OcrSlipResult; reason: string; confidence: number }>;
    unmatched_transactions: Array<Record<string, unknown>>;
    matched_count: number;
    mismatch_count: number;
  };
  timing?: { total_ms: number; python_ms: number; node_overhead_ms: number };
  preview?: boolean;
  message?: string;
}

export const authService = {
  staffLogin: (username: string, password: string) =>
    apiClient.post('/auth/login/staff', { username, password }),
  studentLogin: (student_number: string, password: string) =>
    apiClient.post('/auth/login/student', { student_number, password }),
  forgotPassword: (email: string) => apiClient.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, newPassword: string, confirmPassword: string) =>
    apiClient.post(`/auth/reset-password/${token}`, { newPassword, confirmPassword }),
  me: () => apiClient.get<User>('/auth/me'),
};

export const studentService = {
  list: (params?: ListParams) => apiClient.get<PaginatedResponse<StudentProfile>>('/students', { params }),
  getById: (id: string) => apiClient.get<StudentProfile>(`/students/${id}`),
  create: (data: Record<string, unknown>) => apiClient.post<StudentProfile>('/students', data),
  update: (id: string, data: Record<string, unknown>) => apiClient.put<StudentProfile>(`/students/${id}`, data),
  remove: (id: string) => apiClient.delete(`/students/${id}`),
  checkPayment: (studentNumber: string, reference: string) =>
    apiClient.get<Payment>('/students/check-payment', { params: { studentNumber, reference } }),
  getProfile: () => apiClient.get<StudentProfile>('/students/profile'),
  updateProfile: (data: Record<string, unknown>) => apiClient.put<StudentProfile>('/students/profile', data),
  myPayments: () => apiClient.get<{ payments: Payment[]; stats: Record<string, number> }>('/payments/my'),
  uploadProfilePicture: (file: File) => {
    const formData = new FormData();
    formData.append('profile_picture', file);
    return apiClient.post('/students/profile/picture', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const paymentService = {
  list: (params?: ListParams & { status?: string }) =>
    apiClient.get<{ payments: Payment[]; total: number }>('/payments', { params }),
  getById: (id: string) => apiClient.get<Payment>(`/payments/${id}`),
  create: (data: { studentId: string; amount: number; reference: string; bankName?: string }) =>
    apiClient.post<Payment>('/payments', data),
  update: (id: string, data: Record<string, unknown>) => apiClient.put<Payment>(`/payments/${id}`, data),
  remove: (id: string) => apiClient.delete(`/payments/${id}`),
  downloadStatement: (id: string) => apiClient.get<{ success: boolean; download_url: string }>(`/payments/${id}/statement`),
  getReceipt: (id: string) => apiClient.get(`/payments/${id}/receipt`, { responseType: 'blob' }),
};

export const userService = {
  list: (params?: ListParams) => apiClient.get<PaginatedResponse<StaffUser>>('/users', { params }),
  getById: (id: string) => apiClient.get<StaffUser>(`/users/${id}`),
  create: (data: Record<string, unknown>) => apiClient.post<StaffUser>('/users', data),
  update: (id: string, data: Record<string, unknown>) => apiClient.put<StaffUser>(`/users/${id}`, data),
  remove: (id: string) => apiClient.delete(`/users/${id}`),
};

export const clearanceService = {
  list: (params?: { status?: string }) => apiClient.get<{ requests: ClearanceRequest[] }>('/clearance', { params }),
  getMine: () => apiClient.get<{ requests: ClearanceRequest[] }>('/clearance/mine'),
  getById: (id: string) => apiClient.get<ClearanceRequest>(`/clearance/${id}`),
  getByStudent: (studentId: string) => apiClient.get(`/clearance/student/${studentId}`),
  request: (clearance_type: string) => apiClient.post('/clearance/request', { clearance_type }),
  create: (data: { studentId: string; clearance_type: string }) => apiClient.post('/clearance', data),
  update: (id: string, data: { status: string; rejection_reason?: string }) =>
    apiClient.patch(`/clearance/${id}`, data),
  massVerify: (clearanceIds: string[], status: 'approved' | 'rejected') =>
    apiClient.patch('/clearance/mass-verify', { clearanceIds, status }),
  remove: (id: string) => apiClient.delete(`/clearance/${id}`),
  downloadCertificate: (id: string) => apiClient.get(`/clearance/${id}/certificate`, { responseType: 'blob' }),
};

export const feedbackService = {
  submit: (data: { message: string; rating?: number }) => apiClient.post('/feedback', data),
  getAll: (params?: ListParams) => apiClient.get<PaginatedResponse<Feedback>>('/feedback', { params }),
  getMine: () => apiClient.get<{ items: Feedback[] }>('/feedback/mine'),
  getById: (id: string) => apiClient.get<Feedback>(`/feedback/${id}`),
  update: (id: string, data: { message?: string; rating?: number }) => apiClient.put<Feedback>(`/feedback/${id}`, data),
  remove: (id: string) => apiClient.delete(`/feedback/${id}`),
};

export const notificationService = {
  list: (params?: ListParams) => apiClient.get<PaginatedResponse<Notification>>('/notifications', { params }),
  getById: (id: string) => apiClient.get<Notification>(`/notifications/${id}`),
  markRead: (id: string) => apiClient.patch<Notification>(`/notifications/${id}/read`),
  markAllRead: () => apiClient.patch('/notifications/read-all'),
  remove: (id: string) => apiClient.delete(`/notifications/${id}`),
};

export const accountantService = {
  getStats: () => apiClient.get('/accountant/stats'),
  getPendingPayments: (params?: { status?: string }) => apiClient.get('/accountant/pending-payments', { params }),
  verifyPayment: (paymentId: string, action: 'approve' | 'reject', rejection_reason?: string) =>
    apiClient.post(`/accountant/verify/${paymentId}`, { action, rejection_reason }),
  bulkVerify: (payment_ids: string[]) => apiClient.post('/accountant/bulk-verify', { payment_ids }),
  verifyAllAutoMatched: () => apiClient.post('/accountant/verify-all-auto-matched'),
  uploadBankStatement: (data: FormData) =>
    apiClient.post('/accountant/bank-statement', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  listBankStatements: (params?: ListParams) =>
    apiClient.get<PaginatedResponse<BankStatement>>('/accountant/bank-statements', { params }),
  getBankStatement: (id: string) => apiClient.get<BankStatement>(`/accountant/bank-statements/${id}`),
  listBankTransactions: (statementId: string, params?: ListParams) =>
    apiClient.get<PaginatedResponse<Record<string, unknown>>>(`/accountant/bank-statements/${statementId}/transactions`, { params }),
  deleteBankStatement: (id: string) => apiClient.delete(`/accountant/bank-statements/${id}`),
  bulkPaymentStatus: (studentNumbers: string[]) => apiClient.post('/accountant/bulk-payment-status', { studentNumbers }),
};

export const batchService = {
  verify: (data: FormData) =>
    apiClient.post<BatchVerificationResult>('/accountant/batch/verify', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  reconcileOcr: (data: FormData) =>
    apiClient.post<OcrReconciliationResult>('/accountant/batch/reconcile', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 600000,
    }),
  getReconcile: (batchId: string) =>
    apiClient.get<OcrReconciliationResult>(`/accountant/batch/reconcile/${batchId}`),
  approveReconcile: (batchId: string, body?: { approved_match_indexes?: number[] }) =>
    apiClient.post(`/accountant/batch/reconcile/${batchId}/approve`, body),
};

export const adminService = {
  getStats: () => apiClient.get('/admin/stats'),
  getAuditLogs: (params?: ListParams) => apiClient.get<PaginatedResponse<AuditLog>>('/admin/audit-logs', { params }),
};
