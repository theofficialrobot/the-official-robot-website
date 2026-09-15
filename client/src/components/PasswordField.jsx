import { useState } from 'react';
import ReqLabel from './ReqLabel';

export default function PasswordField({
  value,
  onChange,
  autoComplete = 'current-password',
  required = true,
  minLength,
  name = 'password',
  id,
  label = 'Password',
  helper,
  className = ''
}) {
  const [show, setShow] = useState(false);

  return (
    <label className={'block text-sm font-semibold ' + className}>
      <ReqLabel required={required}>{label}</ReqLabel>
      <span className="relative mt-1 block">
        <input
          id={id}
          name={name}
          type={show ? 'text' : 'password'}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border border-line rounded-[10px] px-3 py-2.5 pr-16 font-normal"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-accent px-2 py-1 rounded-md hover:bg-soft"
          aria-pressed={show}
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? 'Hide' : 'Show'}
        </button>
      </span>
      {helper ? <span className="block text-xs text-dim font-normal mt-1">{helper}</span> : null}
    </label>
  );
}
