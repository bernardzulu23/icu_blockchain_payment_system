import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import { feedbackService, type Feedback as FeedbackItem } from '../api/services';
import CrudTable from '../components/CrudTable';
import { useAuth } from '../hooks/useAuth';

type FormData = { message: string; rating?: number };

export default function Feedback() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [submitted, setSubmitted] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>();

  const isAdmin = user?.role === 'admin';

  const { data: myFeedback, isLoading: loadingMine } = useQuery(
    'my-feedback',
    () => feedbackService.getMine().then((r) => r.data),
    { enabled: !isAdmin }
  );

  const deleteMutation = useMutation((id: string) => feedbackService.remove(id), {
    onSuccess: () => {
      toast.success('Feedback deleted');
      queryClient.invalidateQueries('my-feedback');
    },
  });

  const onSubmit = async (data: FormData) => {
    try {
      await feedbackService.submit({ message: data.message, rating: data.rating });
      toast.success('Thank you for your feedback!');
      setSubmitted(true);
      reset();
      queryClient.invalidateQueries('my-feedback');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed to submit feedback');
    }
  };

  if (isAdmin) {
    return (
      <div className="max-w-2xl">
        <h1 className="font-display text-2xl font-bold text-slate-800 dark:text-slate-100 mb-8">
          Feedback
        </h1>
        <div className="card border-amber-500/30 bg-amber-500/5">
          <p className="text-slate-600 dark:text-slate-400">
            Admins cannot submit feedback. View all feedback in the{' '}
            <Link to="/admin/feedback" className="text-cyan-500 hover:underline">
              Admin Feedback
            </Link>{' '}
            section.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl font-bold text-slate-800 dark:text-slate-100 mb-8">
        Send Feedback
      </h1>
      <p className="text-slate-600 dark:text-slate-400 mb-6">
        Help us improve the ICU Payment System. Share your experience and suggestions.
      </p>

      {submitted ? (
        <div className="card border-green-500/30 bg-green-500/5">
          <p className="text-green-600 dark:text-green-400 font-medium">
            Thank you! Your feedback has been submitted successfully.
          </p>
          <button
            onClick={() => setSubmitted(false)}
            className="mt-4 text-sm text-cyan-500 hover:underline"
          >
            Submit another feedback
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="card space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Your feedback *
            </label>
            <textarea
              {...register('message', { required: 'Message is required', minLength: { value: 10, message: 'Please provide at least 10 characters' } })}
              rows={5}
              className="input-field w-full"
              placeholder="Tell us what works well, what could be improved, or any suggestions..."
            />
            {errors.message && (
              <p className="text-red-500 text-sm mt-1">{errors.message.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Rating (optional)
            </label>
            <select {...register('rating', { setValueAs: (v) => (v === '' ? undefined : parseInt(v, 10)) })} className="input-field w-full max-w-xs">
              <option value="">Select a rating</option>
              <option value="5">5 - Excellent</option>
              <option value="4">4 - Good</option>
              <option value="3">3 - Average</option>
              <option value="2">2 - Below average</option>
              <option value="1">1 - Poor</option>
            </select>
          </div>
          <button type="submit" className="btn-primary">
            Submit Feedback
          </button>
        </form>
      )}

      {!isAdmin && (
        <div className="mt-10">
          <h2 className="font-display text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">My Feedback</h2>
          <div className="card">
            <CrudTable<FeedbackItem>
              loading={loadingMine}
              rows={myFeedback?.items ?? []}
              rowKey={(f) => f.feedback_id}
              columns={[
                {
                  key: 'rating',
                  label: 'Rating',
                  render: (f) => (f.rating != null ? '★'.repeat(f.rating) : '—'),
                },
                { key: 'message', label: 'Message' },
                { key: 'created_at', label: 'Date', render: (f) => new Date(f.created_at).toLocaleString() },
              ]}
              onDelete={(f) => {
                if (confirm('Delete this feedback?')) deleteMutation.mutate(f.feedback_id);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
