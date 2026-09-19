import { useEffect, useRef, useState } from 'react';

type Props = {
  size?: 'sm' | 'md' | 'lg';
  /** Explicit progress 0–100. If omitted, runs an indeterminate loop (never freezes at 95%). */
  percent?: number;
  label?: string;
};

export default function LoadingSpinner({ size = 'md', percent, label = 'Loading' }: Props) {
  const [simulated, setSimulated] = useState(20);
  const risingRef = useRef(true);
  const isDeterminate = typeof percent === 'number';
  const display = isDeterminate
    ? Math.min(100, Math.max(0, Math.round(percent)))
    : simulated;

  useEffect(() => {
    if (isDeterminate) return undefined;
    risingRef.current = true;
    setSimulated(20);
    const id = window.setInterval(() => {
      setSimulated((p) => {
        if (risingRef.current) {
          if (p >= 88) {
            risingRef.current = false;
            return 88;
          }
          return Math.min(88, p + (p < 40 ? 5 : 3));
        }
        if (p <= 18) {
          risingRef.current = true;
          return 18;
        }
        return Math.max(18, p - 4);
      });
    }, 140);
    return () => window.clearInterval(id);
  }, [isDeterminate]);

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
        {isDeterminate ? `${label} ${display}%` : `${label}…`}
      </p>
    </div>
  );
}
