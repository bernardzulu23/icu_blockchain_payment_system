import { ReactNode } from 'react';

type PaginationProps = {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
};

export function PaginationBar({ page, totalPages, total, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Page {page} of {totalPages} ({total} total)
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  children?: ReactNode;
};

export function SearchBar({ value, onChange, placeholder = 'Search...', children }: SearchBarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-field flex-1"
      />
      {children}
    </div>
  );
}
