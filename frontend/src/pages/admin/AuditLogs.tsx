import { useState } from 'react';
import { useQuery } from 'react-query';
import CrudTable from '../../components/CrudTable';
import { PaginationBar } from '../../components/CrudPagination';
import { adminService, type AuditLog } from '../../api/services';

export default function AuditLogs() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery(['audit-logs', page], () =>
    adminService.getAuditLogs({ page, limit: 20 }).then((r) => r.data)
  );

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-slate-800 dark:text-slate-100 mb-8">Audit Logs</h1>
      <div className="card">
        <CrudTable<AuditLog>
          loading={isLoading}
          rows={data?.items ?? []}
          rowKey={(r) => r.log_id}
          columns={[
            { key: 'timestamp', label: 'Time', render: (r) => new Date(r.timestamp).toLocaleString() },
            { key: 'action', label: 'Action' },
            { key: 'user_type', label: 'User Type' },
            { key: 'user_id', label: 'User ID' },
            { key: 'entity_type', label: 'Entity' },
            { key: 'entity_id', label: 'Entity ID' },
          ]}
        />
        {data && <PaginationBar page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />}
      </div>
    </div>
  );
}
