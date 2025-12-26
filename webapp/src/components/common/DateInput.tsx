import React from 'react';

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
}

export function DateInput({
  value,
  onChange,
  min,
  max,
  disabled = false,
}: DateInputProps) {
  return (
    <input
      type="date"
      className="date-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      min={min}
      max={max}
      disabled={disabled}
    />
  );
}
