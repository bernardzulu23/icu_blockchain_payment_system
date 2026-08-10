import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import CrudTable from '../../components/CrudTable';
import Modal from '../../components/Modal';
import { PaginationBar, SearchBar } from '../../components/CrudPagination';
import { userService, type StaffUser } from '../../api/services';
import { ACADEMIC_YEAR_START, ACADEMIC_YEAR_END } from '../../constants/options';

export default function StaffManagement() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<StaffUser | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery(['staff', page, search], () =>
    userService.list({ page, limit: 10, search: search || undefined }).then((r) => r.data)
  );

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setForm({});
  };

  const saveMutation = useMutation(
    () =>
      editing
        ? userService.update(editing.user_id, {
            email: form.email,
            fullName: form.fullName,
            role: form.role,
            status: form.status,
            password: form.password || undefined,
            residentialAddress: form.residentialAddress,
            dateOfBirth: form.dateOfBirth,
          })
        : userService.create({
            fullName: form.fullName,
            email: form.email,
            password: form.password,
            role: form.role || 'accountant',
            residentialAddress: form.residentialAddress,
            dateOfBirth: form.dateOfBirth,
          }),
    {
      onSuccess: (res) => {
        const emp = (res as { data?: StaffUser })?.data?.employee_id;
        toast.success(
          editing
            ? 'Staff updated'
            : emp
              ? `Officer created. Employee ID: ${emp}`
              : 'Staff created'
        );
        queryClient.invalidateQueries('staff');
        closeModal();
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        toast.error(msg || 'Save failed');
      },
    }
  );

  const deleteMutation = useMutation((id: string) => userService.remove(id), {
    onSuccess: () => {
      toast.success('Staff deactivated');
      queryClient.invalidateQueries('staff');
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm({
      fullName: '',
      email: '',
      password: '',
      role: 'accountant',
      residentialAddress: '',
      dateOfBirth: '',
    });
    setShowModal(true);
  };

  const openEdit = (row: StaffUser) => {
    setEditing(row);
    setForm({
      email: row.email,
      fullName: row.full_name,
      role: row.role,
      status: row.status,
      residentialAddress: row.residential_address || '',
      dateOfBirth: row.date_of_birth ? String(row.date_of_birth).slice(0, 10) : '',
      password: '',
    });
    setShowModal(true);
  };

  const validateAndSave = () => {
    if (!form.fullName?.trim() || !form.email?.trim()) {
      toast.error('Full name and email are required');
      return;
    }
    if (!editing && !form.password?.trim()) {
      toast.error('Password is required');
      return;
    }
    if ((form.role || 'accountant') === 'accountant') {
      if (!form.residentialAddress?.trim()) {
        toast.error('Residential address is required for accountant officers');
        return;
      }
      if (!form.dateOfBirth) {
        toast.error('Date of birth is required for accountant officers');
        return;
      }
    }
    saveMutation.mutate();
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <h1 className="font-display text-2xl font-bold text-slate-800 dark:text-slate-100">Staff Users</h1>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/register-accountant" className="btn-primary">
            Register Accountant
          </Link>
          <button type="button" onClick={openCreate} className="btn-secondary">
            Add Staff (modal)
          </button>
        </div>
      </div>

      <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search staff..." />

      <div className="card">
        <CrudTable<StaffUser>
          loading={isLoading}
          rows={data?.items ?? []}
          rowKey={(r) => r.user_id}
          columns={[
            { key: 'employee_id', label: 'Employee ID', render: (r) => r.employee_id || r.username },
            { key: 'full_name', label: 'Full Name' },
            { key: 'email', label: 'Email' },
            { key: 'role', label: 'Role' },
            { key: 'status', label: 'Status' },
          ]}
          onEdit={openEdit}
          onDelete={(r) => { if (confirm(`Deactivate ${r.full_name}?`)) deleteMutation.mutate(r.user_id); }}
        />
        {data && <PaginationBar page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />}
      </div>

      <Modal
        open={showModal}
        title={editing ? 'Edit Staff' : 'New Accountant / Staff Officer'}
        onClose={closeModal}
        footer={
          <>
            <button
              type="button"
              className="btn-primary flex-1"
              disabled={saveMutation.isLoading}
              onClick={validateAndSave}
            >
              {saveMutation.isLoading ? 'Saving...' : 'Save'}
            </button>
            <button type="button" className="btn-secondary flex-1" onClick={closeModal}>
              Cancel
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <input
            className="input-field"
            placeholder="Full Name *"
            value={form.fullName || ''}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />
          {editing ? (
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-ink/50 mb-1">
                Employee ID (system)
              </label>
              <input
                className="input-field opacity-80"
                value={editing.employee_id || editing.username}
                readOnly
              />
            </div>
          ) : (
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink/50">
              Employee ID will be generated automatically (e.g. ACC-2026-0001)
            </p>
          )}
          <input
            className="input-field"
            type="email"
            placeholder="Email Address *"
            value={form.email || ''}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <input
            className="input-field"
            type="password"
            placeholder={editing ? 'New password (leave blank to keep)' : 'Password *'}
            value={form.password || ''}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <textarea
            className="input-field min-h-[80px]"
            placeholder="Residential Address *"
            value={form.residentialAddress || ''}
            onChange={(e) => setForm({ ...form, residentialAddress: e.target.value })}
          />
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-ink/50 mb-1">
              Date of Birth *
            </label>
            <input
              className="input-field"
              type="date"
              min={`${ACADEMIC_YEAR_START}-01-01`}
              max={`${ACADEMIC_YEAR_END}-12-31`}
              value={form.dateOfBirth || ''}
              onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
            />
          </div>
          <select
            className="input-field"
            value={form.role || 'accountant'}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            <option value="accountant">Accountant Officer</option>
            <option value="registrar">Registrar</option>
            <option value="admin">Admin</option>
          </select>
          {editing && (
            <select
              className="input-field"
              value={form.status || 'active'}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          )}
        </div>
      </Modal>
    </div>
  );
}
