import { useQuery } from 'react-query';
import { feedbackService } from '../../api/services';

export default function FeedbackList() {
  const { data, isLoading, error } = useQuery(
    'admin-feedback',
    () => feedbackService.getAll().then((r) => r.data),
    { retry: 1 }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card border-red-500/30 bg-red-500/5">
        <p className="text-red-600 dark:text-red-400">Failed to load feedback.</p>
      </div>
    );
  }

  const feedback = data?.feedback ?? [];

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-slate-800 dark:text-slate-100 mb-8">
        User Feedback
      </h1>
      <p className="text-slate-600 dark:text-slate-400 mb-6">
        Feedback from students, accountants, and registrars about the payment system.
      </p>

      {feedback.length === 0 ? (
        <div className="card">
          <p className="text-slate-500 dark:text-slate-400">No feedback yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {feedback.map((f) => (
            <div
              key={f.feedback_id}
              className="card border-white/10 hover:border-cyan-500/20 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 uppercase">
                      {f.user_type}
                    </span>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {f.user_name || f.user_id}
                    </span>
                    {f.rating != null && (
                      <span className="text-amber-500 text-sm">
                        {'★'.repeat(f.rating)}{'☆'.repeat(5 - f.rating)}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                    {f.message}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">
                    {new Date(f.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
