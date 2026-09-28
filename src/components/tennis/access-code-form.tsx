import type { FormEvent } from 'react';
import { KeyRound, Loader2, LockKeyhole } from 'lucide-react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

type AccessRole = 'login' | 'referee-login' | 'admin';

export function AccessCodeForm({
  role,
  code,
  onCodeChange,
  onSubmit,
  busy,
}: {
  role: AccessRole;
  code: string;
  onCodeChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  busy: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="stack-form">
      <label>
        {role === 'referee-login'
          ? 'Kod sędziego'
          : role === 'login'
            ? 'Kod meczu'
            : 'Kod organizatora'}
      </label>
      {role !== 'admin' ? (
        <InputOTP
          aria-label={role === 'referee-login' ? 'Kod sędziego' : 'Kod meczu'}
          maxLength={5}
          inputMode="numeric"
          pattern="^[0-9]*$"
          value={code}
          onChange={(value) => onCodeChange(value.toUpperCase())}
          containerClassName="otp-container"
        >
          <InputOTPGroup>
            {Array.from({ length: 5 }, (_, index) => (
              <InputOTPSlot key={index} index={index} />
            ))}
          </InputOTPGroup>
        </InputOTP>
      ) : (
        <input
          aria-label="Kod organizatora"
          type="password"
          value={code}
          onChange={(event) => onCodeChange(event.target.value)}
          autoComplete="current-password"
          autoFocus
          required
        />
      )}
      <button className="button dark full" disabled={busy || code.length < 5}>
        {busy ? <Loader2 className="spin" size={18} /> : <KeyRound size={18} />} Odblokuj{' '}
        {role === 'admin' ? 'panel' : 'wpisywanie wyniku'}
      </button>
      <p className="form-note">
        <LockKeyhole size={14} /> Widzowie nie potrzebują kodu.
      </p>
    </form>
  );
}
