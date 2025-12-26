import React from 'react';
import { formatKRW } from '../../engine/utils';

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  disabled?: boolean;
  min?: number;
  max?: number;
  unit?: string;
  showFormatted?: boolean;
}

export function NumberInput({
  value,
  onChange,
  placeholder = '0',
  disabled = false,
  min,
  max,
  unit = '원',
  showFormatted = true,
}: NumberInputProps) {
  const [isFocused, setIsFocused] = React.useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9-]/g, '');
    const num = parseInt(raw, 10) || 0;

    let finalValue = num;
    if (min !== undefined && num < min) finalValue = min;
    if (max !== undefined && num > max) finalValue = max;

    onChange(finalValue);
  };

  const displayValue = isFocused ? String(value || '') : formatKRW(value);

  return (
    <div className="number-input-wrapper">
      <input
        type="text"
        inputMode="numeric"
        className="number-input"
        value={displayValue}
        onChange={handleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        disabled={disabled}
      />
      {unit && <span className="number-input-unit">{unit}</span>}
    </div>
  );
}
