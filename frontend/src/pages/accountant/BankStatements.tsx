import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import { Link } from 'react-router-dom';
import CrudTable from '../../components/CrudTable';
import { PaginationBar } from '../../components/CrudPagination';
import { accountantService, type BankStatement } from '../../api/services';

export default function BankStatements() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery(['bank-statements', page], () =>
    accountantService.listBankStatements({ page, limit: 10 }).then((r) => r.data)
  );

  const deleteMutation = useMutation((id: string) => accountantService.deleteBankStatement(id), {
    onSuccess: () => {
      toast.success('Statement deleted');
      queryClient.invalidateQueries('bank-statements');
    },
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <h1 className="font-display text-2xl font-bold text-slate-800 dark:text-slate-100">Bank Statements</h1>
        <Link to="/accountant/upload-statement" className="btn-primary text-center">Upload New</Link>
      </div>
      <div className="card">
        <CrudTable<BankStatement>
          loading={isLoading}
          rows={data?.items ?? []}
          rowKey={(r) => r.statement_id}
          columns={[
            { key: 'bank_name', label: 'Bank' },
            { key: 'upload_date', label: 'Upload Date' },
            {
              key: 'processed',
              label: 'Processed',
              render: (r) => (r.processed ? 'Yes' : 'No'),
            },
            { key: 'matched_count', label: 'Matched' },
            { key: 'unmatched_count', label: 'Unmatched' },
            { key: 'total_transactions', label: 'Transactions' },
          ]}
          onDelete={(r) => {
            if (confirm('Delete this bank statement?')) deleteMutation.mutate(r.statement_id);
          }}
        />
        {data && <PaginationBar page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />}
      </div>
    </div>
  );
}
