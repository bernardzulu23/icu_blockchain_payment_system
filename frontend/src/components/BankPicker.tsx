import { BANKS } from '../constants/options';

type BankOption = { value: string; label: string; icon: string };

type BankPickerProps = {
  value: string;
  onChange: (value: string) => void;
  options?: readonly BankOption[];
  name?: string;
  error?: string;
};

export default function BankPicker({
  value,
  onChange,
  options = BANKS,
  name,
  error,
}: BankPickerProps) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Bank">
        {options.map((bank) => {
          const selected = value === bank.value;
          return (
            <button
              key={bank.value}
              type="button"
              role="radio"
              aria-checked={selected}
              name={name}
              onClick={() => onChange(bank.value)}
              className={`flex items-center gap-3 border-2 border-ink p-3 text-left transition-colors ${
                selected ? 'bg-accent text-white brutal-shadow' : 'bg-white text-ink hover:bg-paper'
              }`}
            >
              <img
                src={bank.icon}
                alt=""
                className="h-10 w-10 shrink-0 object-contain bg-white border border-ink/10 p-0.5"
                aria-hidden
              />
              <span className="font-semibold text-sm leading-tight">{bank.label}</span>
            </button>
          );
        })}
      </div>
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  );
}
