import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import CrudTable from '../../components/CrudTable';
import Modal from '../../components/Modal';
import { PaginationBar, SearchBar } from '../../components/CrudPagination';
import { studentService, type StudentProfile } from '../../api/services';
import PasswordInput from '../../components/PasswordInput';
import ProgramPicker from '../../components/ProgramPicker';

export default function StudentsManagement() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<StudentProfile | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery(['students', page, search], () =>
    studentService.list({ page, limit: 10, search: search || undefined }).then((r) => r.data)
  );

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setForm({});
  };

  const saveMutation = useMutation(
    () =>
      editing
        ? studentService.update(editing.student_id, form)
        : studentService.create({
            studentId: form.studentId,
            studentNumber: form.studentId,
            firstName: form.firstName,
            lastName: form.lastName,
            email: form.email,
            phone: form.phone,
            program: form.program,
            password: form.password,
          }),
    {
      onSuccess: (res) => {
        const hint = (res as { data?: { login_hint?: string } })?.data?.login_hint;
        toast.success(
          editing
            ? 'Student updated'
            : hint || 'Student created — they can log in with the email and password you set'
        );
        queryClient.invalidateQueries('students');
        closeModal();
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data;
        toast.error(msg?.message || msg?.error || 'Save failed');
      },
    }
  );

  const deleteMutation = useMutation((id: string) => studentService.remove(id), {
    onSuccess: () => {
      toast.success('Student deactivated');
      queryClient.invalidateQueries('students');
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm({
      studentId: '',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      program: '',
      password: '',
    });
    setShowModal(true);
  };

  const openEdit = (row: StudentProfile) => {
    setEditing(row);
    setForm({
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email || '',
      phone: row.phone || '',
      program: row.program || '',
      status: row.status || 'active',
      password: '',
    });
    setShowModal(true);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <h1 className="font-display text-2xl font-bold text-ink">Students</h1>
        <button
          type="button"
          onClick={openCreate}
          className="btn-primary"
        >
          Add Student
        </button>
      </div>

      <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search students..." />

      <div className="card">
        <CrudTable<StudentProfile>
          loading={isLoading}
          rows={data?.items ?? []}
          rowKey={(r) => r.student_id}
          columns={[
            { key: 'student_number', label: 'Student ID', render: (r) => r.student_number || r.student_id },
            { key: 'first_name', label: 'First Name' },
            { key: 'last_name', label: 'Last Name' },
            { key: 'email', label: 'Email' },
            { key: 'program', label: 'Program' },
            {
              key: 'status',
              label: 'Status',
              render: (r) => (
                <span className={`px-2 py-0.5 rounded text-xs ${r.status === 'active' ? 'bg-green-500/20 text-green-600' : 'bg-red-500/20 text-red-600'}`}>
                  {r.status}
                </span>
              ),
            },
          ]}
          onEdit={openEdit}
          onDelete={(r) => {
            if (confirm(`Deactivate ${r.first_name} ${r.last_name}?`)) deleteMutation.mutate(r.student_id);
          }}
        />
        {data && (
          <PaginationBar page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />
        )}
      </div>

      <Modal
        open={showModal}
        title={editing ? 'Edit Student' : 'New Student'}
        onClose={closeModal}
        footer={
          <>
            <button
              type="button"
              className="btn-primary flex-1"
              disabled={saveMutation.isLoading}
              onClick={() => {
                if (!editing) {
                  if (
                    !form.studentId?.trim() ||
                    !form.firstName?.trim() ||
                    !form.lastName?.trim() ||
                    !form.email?.trim() ||
                    !form.password?.trim()
                  ) {
                    toast.error('Student ID, name, email, and password are required for login');
                    return;
                  }
                  if (form.password.length < 6) {
                    toast.error('Password must be at least 6 characters');
                    return;
                  }
                } else if (form.password && form.password.length < 6) {
                  toast.error('Password must be at least 6 characters');
                  return;
                } else if (editing && !form.email?.trim()) {
                  toast.error('Email is required — students log in with email and password');
                  return;
                }
                saveMutation.mutate();
              }}
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
          {!editing && (
            <div>
              <input
                className="input-field"
                placeholder="Student ID *"
                value={form.studentId || ''}
                onChange={(e) => setForm({ ...form, studentId: e.target.value })}
              />
              <p className="font-mono text-[10px] uppercase tracking-widest text-ink/50 mt-1">
                Same as student number — used for login with email or ID
              </p>
            </div>
          )}
          <input className="input-field" placeholder="First Name *" value={form.firstName || ''} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          <input className="input-field" placeholder="Last Name *" value={form.lastName || ''} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          <input
            className="input-field"
            placeholder="Email * (login username)"
            type="email"
            value={form.email || ''}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <PasswordInput
            className="input-field"
            placeholder={editing ? 'New password (leave blank to keep)' : 'Password * (student login)'}
            value={form.password || ''}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            autoComplete="new-password"
          />
          <p className="font-mono text-[10px] uppercase tracking-widest text-ink/50">
            Students sign in with this email (or student ID) and password
          </p>
          <input className="input-field" placeholder="Phone" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest text-ink/50 mb-1">
              Program
            </label>
            <ProgramPicker
              value={form.program || ''}
              onChange={(v) => setForm({ ...form, program: v })}
            />
          </div>
          {editing && (
            <select className="input-field" value={form.status || 'active'} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="graduated">Graduated</option>
            </select>
          )}
        </div>
      </Modal>
    </div>
  );
}
