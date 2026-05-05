/**
 * Input.tsx
 * Controlled input with label, error message, and hint.
 * All form inputs in the app use this component.
 */

import '@/styles/components/Input.css'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  required?: boolean
}

export function Input({ label, error, hint, required, className = '', id, ...rest }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="field">
      {label && (
        <label
          htmlFor={inputId}
          className={`field__label${required ? ' field__label--required' : ''}`}
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`field__control${error ? ' field__control--error' : ''} ${className}`}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        required={required}
        {...rest}
      />
      {error && (
        <span id={`${inputId}-error`} className="field__error" role="alert">
          {error}
        </span>
      )}
      {hint && !error && (
        <span id={`${inputId}-hint`} className="field__hint">
          {hint}
        </span>
      )}
    </div>
  )
}
