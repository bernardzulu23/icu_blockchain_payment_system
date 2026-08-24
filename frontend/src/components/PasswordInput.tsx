import { useState, forwardRef, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

/**
 * Password field with show/hide toggle. Works with react-hook-form register()
 * and with controlled value/onChange inputs.
 */
const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ className = '', ...props }, ref) {
    const [visible, setVisible] = useState(false);

    return (
      <div className="relative w-full">
        <input
          ref={ref}
          {...props}
          type={visible ? 'text' : 'password'}
          className={`pr-10 ${className}`.trim()}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/50 hover:text-accent dark:text-slate-400 dark:hover:text-slate-200"
          aria-label={visible ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          {visible ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
        </button>
      </div>
    );
  }
);

export default PasswordInput;
