export default function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'sm' ? 'w-6 h-6' : size === 'lg' ? 'w-12 h-12' : 'w-8 h-8';
  return (
    <div className="flex items-center justify-center">
      <div
        className={`${sizeClass} border-2 border-icu-accent/30 border-t-icu-accent rounded-full animate-spin`}
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}
