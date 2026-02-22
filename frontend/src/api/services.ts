import { apiClient } from './client';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'accountant' | 'registrar' | 'student';
}

export interface Payment {
  id: string;
  studentId: string;
  studentName: string;
  amount: number;
  currency: string;
  reference: string;
  status: 'pending' | 'auto_matched' | 'manual_review' | 'verified' | 'rejected' | 'duplicate';
  txHash?: string;
  createdAt: string;
  verifiedAt?: string;
  semester?: string;
  academicYear?: string;
}

export interface BatchVerificationResult {
  totalProcessed: number;
  matched: number;
  unmatched: number;
  duplicates: number;
  results: Array<{
    studentId: string;
    studentName: string;
    amount: number;
    status: 'matched' | 'unmatched' | 'duplicate';
    bankRef?: string;
  }>;
}

export const authService = {
  login: (email: string, password: string) =>
    apiClient.post<{ token: string; accessToken: string; user: User }>('/auth/login', {
      email,
      password,
    }),
  staffLogin: (username: string, password: string) =>
    apiClient.post<{ token: string; accessToken: string; user: User }>('/auth/login/staff', {
      username,
      password,
    }),
  studentLogin: (student_number: string, password: string) =>
    apiClient.post<{ token: string; accessToken: string; user: User }>('/auth/login/student', {
      student_number,
      password,
    }),
  refreshToken: (refreshToken: string) =>
    apiClient.post<{ accessToken: string; token: string }>('/auth/refresh', { refreshToken }),
  me: () => apiClient.get<User>('/auth/me'),
  registerStudent: (data: {
    student_number: string;
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
    password: string;
    program?: string;
    admission_year?: number;
    expected_graduation_year?: number;
  }) => apiClient.post('/auth/register/student', data),
};

export const paymentService = {
  list: (params?: { status?: string; page?: number; limit?: number }) =>
    apiClient.get<{ payments: Payment[]; total: number }>('/payments', { params }),
  getById: (id: string) => apiClient.get<Payment>(`/payments/${id}`),
  create: (data: { studentId: string; amount: number; reference: string }) =>
    apiClient.post<Payment>('/payments', data),
  verify: (id: string) => apiClient.post<Payment>(`/payments/${id}/verify`),
};

export const batchService = {
  verify: (data: FormData) =>
    apiClient.post<BatchVerificationResult>('/accountant/batch/verify', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

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

export interface CreateStudentData {
  studentId: string;
  studentNumber?: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  program?: string;
  department?: string;
  admissionYear?: number;
  dateOfBirth?: string;
  currentSemester?: number;
  currentTerm?: number;
  password?: string;
}

export const studentService = {
  checkPayment: (studentId: string, reference: string) =>
    apiClient.get<Payment>(`/students/check-payment`, { params: { studentId, reference } }),
  myPayments: () => apiClient.get<{ payments: Payment[] }>('/payments/my'),
  getProfile: () => apiClient.get<StudentProfile>('/students/profile'),
  create: (data: CreateStudentData) =>
    apiClient.post<StudentProfile>('/students', data),
  uploadProfilePicture: (file: File) => {
    const formData = new FormData();
    formData.append('profile_picture', file);
    return apiClient.post<{ success: boolean; profile_picture_url: string }>(
      '/students/profile/picture',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  },
};
