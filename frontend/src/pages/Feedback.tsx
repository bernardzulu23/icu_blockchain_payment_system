import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { feedbackService } from '../api/services';
import { useAuth } from '../hooks/useAuth';

type FormData = { message: string; rating?: number };

export default function Feedback() {
  const { user } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>();

  const isAdmin = user?.role === 'admin';

  const onSubmit = async (data: FormData) => {
    try {
      await feedbackService.submit({ message: data.message, rating: data.rating });
      toast.success('Thank you for your feedback!');
      setSubmitted(true);
      reset();
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
    </div>
  );
}
