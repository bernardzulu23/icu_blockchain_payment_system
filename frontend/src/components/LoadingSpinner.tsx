import { useEffect, useState } from 'react';

type Props = {
  size?: 'sm' | 'md' | 'lg';
  /** Explicit progress 0–100. If omitted, animates toward 95% until unmounted. */
  percent?: number;
  label?: string;
};

export default function LoadingSpinner({ size = 'md', percent, label = 'Loading' }: Props) {
  const [simulated, setSimulated] = useState(0);
  const display = typeof percent === 'number' ? Math.min(100, Math.max(0, Math.round(percent))) : simulated;

  useEffect(() => {
    if (typeof percent === 'number') return undefined;
    setSimulated(0);
    const id = window.setInterval(() => {
      setSimulated((p) => {
        if (p >= 95) return 95;
        const step = p < 40 ? 4 : p < 70 ? 2 : 1;
        return Math.min(95, p + step);
      });
    }, 120);
    return () => window.clearInterval(id);
  }, [percent]);

  const barWidth = size === 'sm' ? 'w-24' : size === 'lg' ? 'w-56' : 'w-40';
  const textSize = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base' : 'text-sm';

  return (
    <div className="flex flex-col items-center justify-center gap-2" role="status" aria-live="polite">
      <div className={`${barWidth} h-2 border-2 border-ink bg-white overflow-hidden`}>
        <div
          className="h-full bg-accent transition-[width] duration-150 ease-out"
          style={{ width: `${display}%` }}
        />
      </div>
      <p className={`font-mono font-bold text-ink ${textSize}`}>
        {label} {display}%
      </p>
    </div>
  );
}
