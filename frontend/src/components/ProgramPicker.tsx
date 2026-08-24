import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { BACHELOR_PROGRAMS, MASTERS_PROGRAMS } from '../constants/options';

type ProgramPickerProps = {
  value: string;
  onChange: (value: string) => void;
  name?: string;
  id?: string;
  error?: string;
  placeholder?: string;
};

export default function ProgramPicker({
  value,
  onChange,
  name,
  id,
  error,
  placeholder = 'Select program',
}: ProgramPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (p: string) => !q || p.toLowerCase().includes(q);
    return {
      bachelor: BACHELOR_PROGRAMS.filter(match),
      masters: MASTERS_PROGRAMS.filter(match),
    };
  }, [query]);

  const total = filtered.bachelor.length + filtered.masters.length;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  return (
    <div ref={rootRef} className="relative w-full">
      <input type="hidden" name={name} value={value} readOnly />
      <button
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="input-field w-full flex items-center justify-between gap-2 text-left"
      >
        <span className={value ? '' : 'opacity-40'}>{value || placeholder}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>

      {open && (
        <div
          className="absolute z-50 mt-1 w-full border-2 border-ink bg-[#e8e4dc] text-ink dark:bg-[#1a1a1a] dark:text-paper dark:border-paper brutal-shadow max-h-72 flex flex-col"
          role="listbox"
        >
          <div className="p-2 border-b-2 border-ink dark:border-paper sticky top-0 bg-inherit">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50" aria-hidden />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search programmes…"
                className="input-field !py-2 pl-8 text-sm"
                aria-label="Search programmes"
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {total === 0 && (
              <p className="px-3 py-4 text-sm opacity-60">No programmes match “{query}”</p>
            )}
            {filtered.bachelor.length > 0 && (
              <div>
                <p className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest bg-ink/10 sticky top-0">
                  Bachelor ({filtered.bachelor.length})
                </p>
                {filtered.bachelor.map((program) => (
                  <button
                    key={program}
                    type="button"
                    role="option"
                    aria-selected={value === program}
                    className={`w-full text-left px-3 py-2 text-sm border-b border-ink/10 hover:bg-accent hover:text-white ${
                      value === program ? 'bg-accent/20 font-semibold' : ''
                    }`}
                    onClick={() => {
                      onChange(program);
                      setOpen(false);
                    }}
                  >
                    {program}
                  </button>
                ))}
              </div>
            )}
            {filtered.masters.length > 0 && (
              <div>
                <p className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest bg-ink/10 sticky top-0">
                  Masters ({filtered.masters.length})
                </p>
                {filtered.masters.map((program) => (
                  <button
                    key={program}
                    type="button"
                    role="option"
                    aria-selected={value === program}
                    className={`w-full text-left px-3 py-2 text-sm border-b border-ink/10 hover:bg-accent hover:text-white ${
                      value === program ? 'bg-accent/20 font-semibold' : ''
                    }`}
                    onClick={() => {
                      onChange(program);
                      setOpen(false);
                    }}
                  >
                    {program}
                  </button>
                ))}
              </div>
            )}
          </div>
          {value && (
            <button
              type="button"
              className="px-3 py-2 text-xs border-t-2 border-ink dark:border-paper text-left hover:bg-ink/5"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
            >
              Clear selection
            </button>
          )}
        </div>
      )}
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  );
}
