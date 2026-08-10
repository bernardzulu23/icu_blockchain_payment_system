import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import PrivateRoute from './components/PrivateRoute';
import RoleRoute from './components/RoleRoute';
import RoleRedirect from './components/RoleRedirect';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import BatchReconciliation from './pages/accountant/BatchReconciliation';
import PaymentHistory from './pages/PaymentHistory';
import StudentPortal from './pages/StudentPortal';
import Admin from './pages/Admin';
import StudentDashboard from './pages/student/Dashboard';
import StudentProfile from './pages/student/Profile';
import StudentPayments from './pages/student/Payments';
import SubmitPayment from './pages/student/SubmitPayment';
import Clearance from './pages/student/Clearance';
import AccountantDashboard from './pages/accountant/Dashboard';
import AccountantVerification from './pages/accountant/Verification';
import UploadStatement from './pages/accountant/UploadStatement';
import MassClearance from './pages/accountant/MassClearance';
import BulkPaymentStatus from './pages/accountant/BulkPaymentStatus';
import RegistrarDashboard from './pages/registrar/Dashboard';
import AdminDashboard from './pages/admin/Dashboard';
import RegisterStudent from './pages/admin/RegisterStudent';
import RegisterAccountant from './pages/admin/RegisterAccountant';
import Feedback from './pages/Feedback';
import FeedbackList from './pages/admin/FeedbackList';
import StudentsManagement from './pages/admin/Students';
import StaffManagement from './pages/admin/Staff';
import AuditLogs from './pages/admin/AuditLogs';
import BankStatements from './pages/accountant/BankStatements';
import Notifications from './pages/student/Notifications';
import { useAuth } from './hooks/useAuth';
import { getHomeForRole } from './utils/routing';

function StaffHome() {
  const { user } = useAuth();
  const home = getHomeForRole(user?.role);
  if (home !== '/login' && home !== '/') {
    return <Navigate to={home} replace />;
  }
  return <Dashboard />;
}

function AdminOnly({ children }: { children: React.ReactNode }) {
  return <RoleRoute roles={['admin']}>{children}</RoleRoute>;
}

function AccountantStaff({ children }: { children: React.ReactNode }) {
  return <RoleRoute roles={['admin', 'accountant']}>{children}</RoleRoute>;
}

function ClearanceStaff({ children }: { children: React.ReactNode }) {
  return <RoleRoute roles={['admin', 'accountant', 'registrar']}>{children}</RoleRoute>;
}

function StudentOnly({ children }: { children: React.ReactNode }) {
  return <RoleRoute roles={['student']}>{children}</RoleRoute>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />
      <Route path="/student" element={<StudentPortal />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<StaffHome />} />
        <Route
          path="history"
          element={
            <RoleRoute roles={['admin', 'accountant']}>
              <PaymentHistory />
            </RoleRoute>
          }
        />
        <Route path="batch-verification" element={<Navigate to="/accountant/batch-reconciliation" replace />} />
        <Route path="admin" element={<AdminOnly><Admin /></AdminOnly>} />
        <Route path="admin/dashboard" element={<AdminOnly><AdminDashboard /></AdminOnly>} />
        <Route path="admin/students" element={<AdminOnly><StudentsManagement /></AdminOnly>} />
        <Route path="admin/staff" element={<AdminOnly><StaffManagement /></AdminOnly>} />
        <Route path="admin/register-accountant" element={<AdminOnly><RegisterAccountant /></AdminOnly>} />
        <Route path="admin/audit-logs" element={<AdminOnly><AuditLogs /></AdminOnly>} />
        <Route path="admin/register-student" element={<AdminOnly><RegisterStudent /></AdminOnly>} />
        <Route path="admin/feedback" element={<AdminOnly><FeedbackList /></AdminOnly>} />
        <Route path="feedback" element={<Feedback />} />
      </Route>
      <Route
        path="/student-portal"
        element={
          <PrivateRoute>
            <StudentOnly>
              <Layout />
            </StudentOnly>
          </PrivateRoute>
        }
      >
        <Route index element={<StudentDashboard />} />
        <Route path="profile" element={<StudentProfile />} />
        <Route path="payments" element={<StudentPayments />} />
        <Route path="submit-payment" element={<SubmitPayment />} />
        <Route path="clearance" element={<Clearance />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="feedback" element={<Feedback />} />
      </Route>
      <Route
        path="/accountant"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<AccountantStaff><AccountantDashboard /></AccountantStaff>} />
        <Route path="verification" element={<AccountantStaff><AccountantVerification /></AccountantStaff>} />
        <Route path="upload-statement" element={<AccountantStaff><UploadStatement /></AccountantStaff>} />
        <Route path="mass-clearance" element={<ClearanceStaff><MassClearance /></ClearanceStaff>} />
        <Route path="bulk-payment-status" element={<AccountantStaff><BulkPaymentStatus /></AccountantStaff>} />
        <Route path="batch-reconciliation" element={<AccountantStaff><BatchReconciliation /></AccountantStaff>} />
        <Route path="bank-statements" element={<AccountantStaff><BankStatements /></AccountantStaff>} />
      </Route>
      <Route
        path="/registrar"
        element={
          <PrivateRoute>
            <RoleRoute roles={['admin', 'registrar']}>
              <Layout />
            </RoleRoute>
          </PrivateRoute>
        }
      >
        <Route index element={<RegistrarDashboard />} />
      </Route>
      <Route path="*" element={<PrivateRoute><RoleRedirect /></PrivateRoute>} />
    </Routes>
  );
}
