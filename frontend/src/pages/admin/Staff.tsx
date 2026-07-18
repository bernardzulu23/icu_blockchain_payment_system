import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import CrudTable from '../../components/CrudTable';
import { PaginationBar, SearchBar } from '../../components/CrudPagination';
import { userService, type StaffUser } from '../../api/services';

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

  const saveMutation = useMutation(
    () =>
      editing
        ? userService.update(editing.user_id, form)
        : userService.create(form),
    {
      onSuccess: () => {
        toast.success(editing ? 'Staff updated' : 'Staff created');
        queryClient.invalidateQueries('staff');
        setShowModal(false);
        setEditing(null);
        setForm({});
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
    setForm({ username: '', email: '', password: '', role: 'accountant', fullName: '' });
    setShowModal(true);
  };

  const openEdit = (row: StaffUser) => {
    setShowModal(true);
    setEditing(row);
    setForm({ username: row.username, email: row.email, fullName: row.full_name, role: row.role, status: row.status });
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <h1 className="font-display text-2xl font-bold text-slate-800 dark:text-slate-100">Staff Users</h1>
        <button type="button" onClick={openCreate} className="btn-primary">Add Staff</button>
      </div>

      <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search staff..." />

      <div className="card">
        <CrudTable<StaffUser>
          loading={isLoading}
          rows={data?.items ?? []}
          rowKey={(r) => r.user_id}
          columns={[
            { key: 'username', label: 'Username' },
            { key: 'full_name', label: 'Name' },
            { key: 'email', label: 'Email' },
            { key: 'role', label: 'Role' },
            { key: 'status', label: 'Status' },
          ]}
          onEdit={openEdit}
          onDelete={(r) => { if (confirm(`Deactivate ${r.full_name}?`)) deleteMutation.mutate(r.user_id); }}
        />
        {data && <PaginationBar page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="card max-w-lg w-full">
            <h2 className="text-lg font-semibold mb-4">{editing ? 'Edit Staff' : 'New Staff'}</h2>
            <div className="space-y-3">
              <input className="input-field" placeholder="Username" value={form.username || ''} onChange={(e) => setForm({ ...form, username: e.target.value })} />
              <input className="input-field" placeholder="Full Name" value={form.fullName || ''} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
              <input className="input-field" placeholder="Email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              {!editing && <input className="input-field" type="password" placeholder="Password" value={form.password || ''} onChange={(e) => setForm({ ...form, password: e.target.value })} />}
              {editing && <input className="input-field" type="password" placeholder="New password (optional)" value={form.password || ''} onChange={(e) => setForm({ ...form, password: e.target.value })} />}
              <select className="input-field" value={form.role || 'accountant'} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="accountant">Accountant</option>
                <option value="registrar">Registrar</option>
                <option value="admin">Admin</option>
              </select>
              {editing && (
                <select className="input-field" value={form.status || 'active'} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button type="button" className="btn-primary flex-1" onClick={() => saveMutation.mutate()}>Save</button>
              <button type="button" className="btn-secondary flex-1" onClick={() => { setShowModal(false); setForm({}); setEditing(null); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
