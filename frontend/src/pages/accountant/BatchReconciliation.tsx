import { useState } from 'react';
import { useMutation } from 'react-query';
import { toast } from 'react-toastify';
import {
  batchService,
  type OcrReconciliationResult,
  type OcrMatchPair,
} from '../../api/services';
import LoadingSpinner from '../../components/LoadingSpinner';
import BankPicker from '../../components/BankPicker';
import { BANK_TEMPLATES } from '../../constants/options';

function confidenceClass(conf: number) {
  if (conf >= 0.8) return 'text-green-600 dark:text-green-400';
  if (conf >= 0.65) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

export default function BatchReconciliation() {
  const [bankFile, setBankFile] = useState<File | null>(null);
  const [slipFiles, setSlipFiles] = useState<File[]>([]);
  const [bankHint, setBankHint] = useState('zanaco');
  const [result, setResult] = useState<OcrReconciliationResult | null>(null);
  const [selectedMatches, setSelectedMatches] = useState<Set<number>>(new Set());

  const previewMutation = useMutation(
    () => {
      const formData = new FormData();
      if (bankFile) formData.append('bankStatement', bankFile);
      slipFiles.forEach((f) => formData.append('slips', f));
      formData.append('bank_name', bankHint);
      return batchService.reconcileOcr(formData);
    },
    {
      onSuccess: (res) => {
        setResult(res.data);
        const matches = res.data.matching?.matches || [];
        setSelectedMatches(
          new Set(
            matches
              .map((m, i) => (m.status === 'matched' && !m.mismatch ? i : -1))
              .filter((i) => i >= 0)
          )
        );
        toast.success(
          `OCR complete in ${(res.data.processing_ms / 1000).toFixed(1)}s — review matches before committing`
        );
      },
      onError: (err: unknown) => {
        const msg =
          (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data
            ?.message ||
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        toast.error(msg || 'OCR batch reconciliation failed');
      },
    }
  );

  const approveMutation = useMutation(
    (batchId: string) =>
      batchService.approveReconcile(batchId, {
        approved_match_indexes: [...selectedMatches],
      }),
    {
      onSuccess: (res) => {
        toast.success(
          `Committed ${res.data.payment_count} payments — Merkle root anchored (${res.data.processing_ms}ms total)`
        );
        setResult(null);
        setBankFile(null);
        setSlipFiles([]);
      },
      onError: () => {
        toast.error('Failed to commit batch reconciliation');
      },
    }
  );

  const toggleMatch = (idx: number) => {
    setSelectedMatches((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const matches: OcrMatchPair[] = result?.matching?.matches || [];

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
        Batch Reconciliation (OCR)
      </h1>
      <p className="text-slate-600 dark:text-slate-400 mb-8">
        Upload a bank statement PDF and student deposit slips (PNG, JPG, or PDF). Tesseract OCR extracts fields using
        Zanaco/ABSA templates, matches against bank transactions, then anchors a Merkle root on approval.
        The Python OCR service must be running on port 8000 (`npm run dev:python`).
      </p>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div className="card">
          <h2 className="font-display text-lg font-semibold mb-4">Upload Batch</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!bankFile || !slipFiles.length) {
                toast.error('Upload bank statement and at least one deposit slip');
                return;
              }
              previewMutation.mutate();
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium mb-1">Bank template</label>
              <BankPicker
                value={bankHint}
                onChange={setBankHint}
                options={BANK_TEMPLATES}
                name="bank_template"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Bank Statement (PDF)</label>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setBankFile(e.target.files?.[0] ?? null)}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Deposit Slips (images or PDF)</label>
              <input
                type="file"
                accept="image/*,.pdf,application/pdf"
                multiple
                onChange={(e) => setSlipFiles([...(e.target.files || [])])}
                className="input-field"
              />
            </div>
            <button type="submit" disabled={previewMutation.isLoading} className="btn-primary w-full">
              {previewMutation.isLoading ? (
                <span className="inline-flex justify-center w-full py-1">
                  <LoadingSpinner size="sm" label="OCR" />
                </span>
              ) : (
                'Run OCR & Match'
              )}
            </button>
          </form>
        </div>

        {result && (
          <div className="card">
            <h2 className="font-display text-lg font-semibold mb-4">Processing Metrics</h2>
            <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
              <div className="glass-subtle p-3 rounded-xl">
                <p className="text-slate-500">Total time</p>
                <p className="text-xl font-bold">{(result.processing_ms / 1000).toFixed(2)}s</p>
              </div>
              <div className="glass-subtle p-3 rounded-xl">
                <p className="text-slate-500">Python OCR</p>
                <p className="text-xl font-bold">
                  {result.timing?.python_ms ? `${(result.timing.python_ms / 1000).toFixed(2)}s` : '—'}
                </p>
              </div>
              <div className="glass-subtle p-3 rounded-xl">
                <p className="text-slate-500">Manual flag rate</p>
                <p className="text-xl font-bold">{(result.manual_flag_rate * 100).toFixed(1)}%</p>
              </div>
              <div className="glass-subtle p-3 rounded-xl">
                <p className="text-slate-500">Merkle payments</p>
                <p className="text-xl font-bold">{result.payment_count}</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Batch ID: {result.batch_id} · Merkle: {result.merkle_root?.slice(0, 16)}…
            </p>
            <button
              type="button"
              disabled={approveMutation.isLoading || selectedMatches.size === 0}
              onClick={() => approveMutation.mutate(result.batch_id)}
              className="btn-primary w-full"
            >
              {approveMutation.isLoading
                ? 'Committing...'
                : `Approve ${selectedMatches.size} match(es) & SubmitBatchRoot`}
            </button>
          </div>
        )}
      </div>

      {result && (
        <div className="card mt-8">
          <h2 className="font-display text-lg font-semibold mb-4">Side-by-Side OCR Review</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2 text-left">✓</th>
                  <th className="py-2 text-left">Slip</th>
                  <th className="py-2 text-left">Student ID</th>
                  <th className="py-2 text-left">Amount</th>
                  <th className="py-2 text-left">OCR conf.</th>
                  <th className="py-2 text-left">Bank ref</th>
                  <th className="py-2 text-left">Bank amt</th>
                  <th className="py-2 text-left">Match</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m, idx) => (
                  <tr
                    key={`m-${idx}`}
                    className={`border-b border-slate-100 dark:border-slate-700/50 ${
                      m.mismatch ? 'bg-amber-500/10' : ''
                    }`}
                  >
                    <td className="py-2">
                      <input
                        type="checkbox"
                        checked={selectedMatches.has(idx)}
                        onChange={() => toggleMatch(idx)}
                      />
                    </td>
                    <td className="py-2">{m.slip?.filename || '—'}</td>
                    <td className="py-2">{m.slip?.student_id || '—'}</td>
                    <td className="py-2">{m.slip?.amount ?? '—'}</td>
                    <td className={`py-2 font-medium ${confidenceClass(m.slip?.confidence ?? 0)}`}>
                      {((m.slip?.confidence ?? 0) * 100).toFixed(0)}%
                      {m.slip?.needs_manual_entry ? ' (manual)' : ''}
                    </td>
                    <td className="py-2">{m.transaction?.batch_number || '—'}</td>
                    <td className="py-2">{m.transaction?.amount ?? '—'}</td>
                    <td className="py-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          m.mismatch
                            ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                            : 'bg-green-500/20 text-green-700 dark:text-green-300'
                        }`}
                      >
                        {m.status} ({((m.match_confidence ?? 0) * 100).toFixed(0)}%)
                      </span>
                    </td>
                  </tr>
                ))}
                {(result.matching?.unmatched_slips || []).map((u, i) => (
                  <tr
                    key={`u-${i}`}
                    className="border-b border-slate-100 dark:border-slate-700/50 bg-amber-500/5"
                  >
                    <td className="py-2 text-slate-400">—</td>
                    <td className="py-2">{u.slip?.filename || '—'}</td>
                    <td className="py-2">{u.slip?.student_id || '—'}</td>
                    <td className="py-2">{u.slip?.amount ?? '—'}</td>
                    <td className={`py-2 font-medium ${confidenceClass(u.slip?.confidence ?? 0)}`}>
                      {((u.confidence ?? u.slip?.confidence ?? 0) * 100).toFixed(0)}%
                    </td>
                    <td className="py-2">{u.slip?.batch_reference || '—'}</td>
                    <td className="py-2">—</td>
                    <td className="py-2">
                      <span className="px-2 py-0.5 rounded text-xs bg-amber-500/20 text-amber-700 dark:text-amber-300">
                        {u.reason}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(result.matching?.unmatched_slips?.length ?? 0) > 0 && (
            <div className="mt-6">
              <h3 className="font-semibold text-amber-600 dark:text-amber-400 mb-2">
                Flagged for manual entry ({result.matching?.unmatched_slips?.length})
              </h3>
              <ul className="text-sm space-y-1 text-slate-600 dark:text-slate-400">
                {result.matching?.unmatched_slips?.map((u, i) => (
                  <li key={i}>
                    <span className="font-medium">{u.slip?.filename}</span>: {u.reason}
                    {u.slip?.batch_reference ? ` · ref ${u.slip.batch_reference}` : ''}
                    {u.slip?.raw_text ? (
                      <p className="text-xs mt-1 whitespace-pre-wrap max-h-24 overflow-auto">
                        OCR text: {u.slip.raw_text.slice(0, 400)}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
