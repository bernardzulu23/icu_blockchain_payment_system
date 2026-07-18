import { ReactNode } from 'react';
import LoadingSpinner from './LoadingSpinner';

export type Column<T> = {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  className?: string;
};

type CrudTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyMessage?: string;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  onView?: (row: T) => void;
  extraActions?: (row: T) => ReactNode;
};

export default function CrudTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  emptyMessage = 'No records found',
  onEdit,
  onDelete,
  onView,
  extraActions,
}: CrudTableProps<T>) {
  const hasActions = onEdit || onDelete || onView || extraActions;

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!rows.length) {
    return <p className="text-slate-500 dark:text-slate-400 py-8 text-center">{emptyMessage}</p>;
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              {columns.map((col) => (
                <th key={col.key} className="text-left py-3 px-2 text-slate-600 dark:text-slate-400 font-medium">
                  {col.label}
                </th>
              ))}
              {hasActions && (
                <th className="text-right py-3 px-2 text-slate-600 dark:text-slate-400 font-medium">Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
              >
                {columns.map((col) => (
                  <td key={col.key} className={`py-3 px-2 text-slate-800 dark:text-slate-200 ${col.className || ''}`}>
                    {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '—')}
                  </td>
                ))}
                {hasActions && (
                  <td className="py-3 px-2 text-right whitespace-nowrap">
                    <div className="flex justify-end gap-2 flex-wrap">
                      {onView && (
                        <button type="button" onClick={() => onView(row)} className="text-cyan-600 text-xs font-medium hover:underline">
                          View
                        </button>
                      )}
                      {onEdit && (
                        <button type="button" onClick={() => onEdit(row)} className="text-icu-accent text-xs font-medium hover:underline">
                          Edit
                        </button>
                      )}
                      {extraActions?.(row)}
                      {onDelete && (
                        <button type="button" onClick={() => onDelete(row)} className="text-red-500 text-xs font-medium hover:underline">
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {rows.map((row) => (
          <div key={rowKey(row)} className="card p-4 space-y-2">
            {columns.map((col) => (
              <div key={col.key} className="flex justify-between gap-4 text-sm">
                <span className="text-slate-500 dark:text-slate-400 shrink-0">{col.label}</span>
                <span className="text-slate-800 dark:text-slate-200 text-right break-all">
                  {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '—')}
                </span>
              </div>
            ))}
            {hasActions && (
              <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                {onView && (
                  <button type="button" onClick={() => onView(row)} className="btn-secondary text-xs py-1.5 px-3">
                    View
                  </button>
                )}
                {onEdit && (
                  <button type="button" onClick={() => onEdit(row)} className="btn-primary text-xs py-1.5 px-3">
                    Edit
                  </button>
                )}
                {extraActions?.(row)}
                {onDelete && (
                  <button type="button" onClick={() => onDelete(row)} className="text-red-500 text-xs font-medium py-1.5">
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
