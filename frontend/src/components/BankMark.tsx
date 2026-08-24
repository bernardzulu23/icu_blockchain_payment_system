import { resolveBankIcon, resolveBankLabel } from '../constants/options';

type BankMarkProps = {
  bank: string | null | undefined;
  showLabel?: boolean;
  size?: 'sm' | 'md';
  className?: string;
};

const ICON = {
  sm: 'h-6 w-6',
  md: 'h-9 w-9',
} as const;

export default function BankMark({ bank, showLabel = true, size = 'sm', className = '' }: BankMarkProps) {
  const icon = resolveBankIcon(bank);
  const label = resolveBankLabel(bank);
  if (!icon && !label) {
    return <span className={className}>-</span>;
  }

  return (
    <span className={`inline-flex items-center gap-2 min-w-0 ${className}`}>
      {icon && (
        <img
          src={icon}
          alt=""
          className={`${ICON[size]} shrink-0 object-contain bg-white border border-ink/10`}
          aria-hidden
        />
      )}
      {showLabel && <span className="truncate">{label}</span>}
    </span>
  );
}
