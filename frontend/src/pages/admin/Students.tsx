import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import CrudTable from '../../components/CrudTable';
import { PaginationBar, SearchBar } from '../../components/CrudPagination';
import { studentService, type StudentProfile } from '../../api/services';

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

  const saveMutation = useMutation(
    () =>
      editing
        ? studentService.update(editing.student_id, form)
        : studentService.create({
            studentId: form.studentId,
            studentNumber: form.studentNumber,
            firstName: form.firstName,
            lastName: form.lastName,
            email: form.email,
            phone: form.phone,
            program: form.program,
            password: form.password,
          }),
    {
      onSuccess: () => {
        toast.success(editing ? 'Student updated' : 'Student created');
        queryClient.invalidateQueries('students');
        setShowModal(false);
        setEditing(null);
        setForm({});
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
    setForm({ studentId: '', studentNumber: '', firstName: '', lastName: '', email: '', password: '' });
    setShowModal(true);
  };

  const openEdit = (row: StudentProfile) => {
    setShowModal(true);
    setEditing(row);
    setForm({
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email || '',
      phone: row.phone || '',
      program: row.program || '',
      status: row.status || 'active',
    });
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <h1 className="font-display text-2xl font-bold text-slate-800 dark:text-slate-100">Students</h1>
        <button type="button" onClick={openCreate} className="btn-primary">
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
            { key: 'student_number', label: 'Number' },
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

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="card max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">{editing ? 'Edit Student' : 'New Student'}</h2>
            <div className="space-y-3">
              {!editing && (
                <>
                  <input className="input-field" placeholder="Student ID" value={form.studentId || ''} onChange={(e) => setForm({ ...form, studentId: e.target.value })} />
                  <input className="input-field" placeholder="Student Number" value={form.studentNumber || ''} onChange={(e) => setForm({ ...form, studentNumber: e.target.value })} />
                  <input className="input-field" placeholder="Password" type="password" value={form.password || ''} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </>
              )}
              <input className="input-field" placeholder="First Name" value={form.firstName || ''} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
              <input className="input-field" placeholder="Last Name" value={form.lastName || ''} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              <input className="input-field" placeholder="Email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <input className="input-field" placeholder="Phone" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <input className="input-field" placeholder="Program" value={form.program || ''} onChange={(e) => setForm({ ...form, program: e.target.value })} />
              {editing && (
                <select className="input-field" value={form.status || 'active'} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="graduated">Graduated</option>
                </select>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button type="button" className="btn-primary flex-1" disabled={saveMutation.isLoading} onClick={() => saveMutation.mutate()}>
                Save
              </button>
              <button type="button" className="btn-secondary flex-1" onClick={() => { setShowModal(false); setEditing(null); setForm({}); }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
