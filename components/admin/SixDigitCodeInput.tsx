'use client';

interface SixDigitCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

export default function SixDigitCodeInput({
  value,
  onChange,
  disabled,
  autoFocus,
}: SixDigitCodeInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
    onChange(digits);
  };

  return (
    <input
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      value={value}
      onChange={handleChange}
      disabled={disabled}
      autoFocus={autoFocus}
      placeholder="000000"
      aria-label="Six digit verification code"
      className="w-full text-center text-2xl font-bold tracking-[0.6em] text-white placeholder-[#AAB7C4]/25 px-4 py-4 rounded-xl outline-none transition-all duration-200"
      style={{
        background: 'rgba(7,19,33,0.6)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = 'rgba(245,158,11,0.4)';
        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(245,158,11,0.08)';
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    />
  );
}