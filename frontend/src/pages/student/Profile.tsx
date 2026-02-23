import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { Upload, User, Lock } from 'lucide-react';
import { studentService, type StudentProfile } from '../../api/services';

const getProfilePictureUrl = (path: string | undefined) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const base = (import.meta.env.VITE_API_URL || '/api').replace(/\/api\/?$/, '');
  return `${base || window.location.origin}${path.startsWith('/') ? '' : '/'}${path}`;
};

const formatDate = (dateStr: string | undefined) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function Profile() {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    studentService
      .getProfile()
      .then((r) => setProfile(r.data))
      .catch(() => toast.error('Failed to load profile'))
      .finally(() => setLoading(false));
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a valid image (JPG or PNG)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a valid image (JPG or PNG)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }
    setUploading(true);
    try {
      const res = await studentService.uploadProfilePicture(file);
      setProfile((p) => (p ? { ...p, profile_picture_url: res.data.profile_picture_url } : null));
      setPreview(null);
      toast.success('Profile picture updated');
    } catch {
      toast.error('Failed to upload profile picture');
    } finally {
      setUploading(false);
      (e.target as HTMLInputElement).value = '';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-icu-accent" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="card p-8 text-center">
        <p className="text-slate-600 dark:text-slate-400">Profile not found.</p>
      </div>
    );
  }

  const displayUrl = preview || (profile.profile_picture_url ? getProfilePictureUrl(profile.profile_picture_url) : '');

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="font-display text-2xl font-bold text-slate-800 dark:text-slate-100 mb-8">
        My Profile
      </h1>

      <div className="card p-8 space-y-8">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative">
            <div className="w-32 h-32 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden border-4 border-slate-300 dark:border-slate-600">
              {displayUrl ? (
                <img src={displayUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User className="w-16 h-16 text-slate-400" />
              )}
            </div>
            <label
              className={`absolute bottom-0 right-0 bg-icu-accent text-white rounded-full p-2 cursor-pointer shadow-lg hover:opacity-90 transition-opacity ${uploading ? 'opacity-60 pointer-events-none' : ''}`}
            >
              <Upload className="w-5 h-5" />
              <input
                type="file"
                className="hidden"
                accept="image/jpeg,image/jpg,image/png"
                onChange={(e) => {
                  handleFileChange(e);
                  handleUpload(e);
                }}
                disabled={uploading}
              />
            </label>
          </div>
          <div className="flex-1 text-center sm:text-left">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
              You can update your profile picture
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-500 flex items-center justify-center sm:justify-start gap-1">
              <Lock className="w-3 h-3" />
              Other fields are set by admin and cannot be changed
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
              First Name
            </label>
            <p className="text-slate-800 dark:text-slate-100 font-medium">
              {profile.first_name || '—'}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
              Last Name
            </label>
            <p className="text-slate-800 dark:text-slate-100 font-medium">
              {profile.last_name || '—'}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
              Date of Birth
            </label>
            <p className="text-slate-800 dark:text-slate-100 font-medium">
              {formatDate(profile.date_of_birth)}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
              Program
            </label>
            <p className="text-slate-800 dark:text-slate-100 font-medium">
              {profile.program || '—'}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
              Department
            </label>
            <p className="text-slate-800 dark:text-slate-100 font-medium">
              {profile.department || '—'}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
              Semester
            </label>
            <p className="text-slate-800 dark:text-slate-100 font-medium">
              {profile.current_semester != null ? `Semester ${profile.current_semester}` : '—'}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
              Term
            </label>
            <p className="text-slate-800 dark:text-slate-100 font-medium">
              {profile.current_term != null ? `Term ${profile.current_term}` : '—'}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
              Student Number
            </label>
            <p className="text-slate-800 dark:text-slate-100 font-medium">
              {profile.student_number || '—'}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
              Email
            </label>
            <p className="text-slate-800 dark:text-slate-100 font-medium">
              {profile.email || '—'}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
              Phone
            </label>
            <p className="text-slate-800 dark:text-slate-100 font-medium">
              {profile.phone || '—'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
