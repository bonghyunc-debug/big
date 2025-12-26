import React from 'react';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  tooltip?: string;
}

export function Checkbox({
  checked,
  onChange,
  label,
  disabled = false,
  tooltip,
}: CheckboxProps) {
  return (
    <label className="checkbox-wrapper" title={tooltip}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span className="checkbox-label">{label}</span>
    </label>
  );
}
