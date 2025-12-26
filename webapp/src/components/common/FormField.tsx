import React from 'react';

interface FormFieldProps {
  label: string;
  required?: boolean;
  tooltip?: string;
  evidence?: { text: string; url?: string };
  error?: string;
  children: React.ReactNode;
}

export function FormField({
  label,
  required = false,
  tooltip,
  evidence,
  error,
  children,
}: FormFieldProps) {
  const [showEvidence, setShowEvidence] = React.useState(false);

  return (
    <div className="form-field">
      <div className="form-field-header">
        <label className="form-field-label">
          {label}
          {required && <span className="required-mark">*</span>}
        </label>
        <div className="form-field-icons">
          {tooltip && (
            <span className="tooltip-icon" title={tooltip}>
              ?
            </span>
          )}
          {evidence && (
            <button
              type="button"
              className="evidence-icon"
              onClick={() => setShowEvidence(!showEvidence)}
              title="법적근거 보기"
            >
              §
            </button>
          )}
        </div>
      </div>

      <div className="form-field-input">{children}</div>

      {error && <div className="form-field-error">{error}</div>}

      {showEvidence && evidence && (
        <div className="form-field-evidence">
          <span>{evidence.text}</span>
          {evidence.url && (
            <a href={evidence.url} target="_blank" rel="noopener noreferrer">
              [상세보기]
            </a>
          )}
        </div>
      )}
    </div>
  );
}
