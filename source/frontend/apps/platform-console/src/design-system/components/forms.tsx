import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Eye, EyeOff, Search } from 'lucide-react'
import { useState } from 'react'
import { cx } from '../lib'

interface FieldShellProps {
  label: string
  hint?: string
  error?: string
  required?: boolean
  htmlFor?: string
  children: ReactNode
}

export function FieldShell({ label, hint, error, required, htmlFor, children }: FieldShellProps) {
  return (
    <div className="ds-field">
      <label className="ds-label" htmlFor={htmlFor}>
        {label}
        {required ? (
          <span className="ds-req" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <span className="ds-error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="ds-help">{hint}</span>
      ) : null}
    </div>
  )
}

export function TextInput({
  label,
  hint,
  error,
  required,
  className,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  const genId = useId()
  const inputId = id ?? genId
  return (
    <FieldShell label={label} hint={hint} error={error} required={required} htmlFor={inputId}>
      <input
        id={inputId}
        className={cx('ds-input', className)}
        aria-invalid={error ? true : undefined}
        aria-required={required || undefined}
        {...props}
      />
    </FieldShell>
  )
}

export function PasswordInput({
  label,
  hint,
  error,
  required,
  showPasswordLabel = 'Show password',
  hidePasswordLabel = 'Hide password',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string
  hint?: string
  error?: string
  showPasswordLabel?: string
  hidePasswordLabel?: string
}) {
  const [visible, setVisible] = useState(false)
  const id = useId()
  return (
    <FieldShell label={label} hint={hint} error={error} required={required} htmlFor={id}>
      <div className="ds-input-wrap">
        <input
          id={id}
          className="ds-input"
          type={visible ? 'text' : 'password'}
          autoComplete="current-password"
          aria-invalid={error ? true : undefined}
          {...props}
        />
        <button
          type="button"
          className="ds-btn ds-btn--ghost ds-btn--icon ds-btn--sm ds-input-suffix"
          aria-label={visible ? hidePasswordLabel : showPasswordLabel}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
        </button>
      </div>
    </FieldShell>
  )
}

export function SearchInput({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const id = useId()
  return (
    <FieldShell label={label} htmlFor={id}>
      <div className="ds-input-wrap">
        <Search
          size={16}
          aria-hidden
          className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-[var(--ds-text-faint)]"
          style={{ insetInlineStart: 12 }}
        />
        <input id={id} className="ds-input" type="search" style={{ paddingInlineStart: 36 }} {...props} />
      </div>
    </FieldShell>
  )
}

export function SelectField({
  label,
  hint,
  error,
  required,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string; error?: string; children: ReactNode }) {
  const id = useId()
  return (
    <FieldShell label={label} hint={hint} error={error} required={required} htmlFor={id}>
      <select id={id} className="ds-select" aria-invalid={error ? true : undefined} {...props}>
        {children}
      </select>
    </FieldShell>
  )
}

export function TextAreaField({
  label,
  hint,
  error,
  required,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string; error?: string }) {
  const id = useId()
  return (
    <FieldShell label={label} hint={hint} error={error} required={required} htmlFor={id}>
      <textarea id={id} className="ds-textarea" aria-invalid={error ? true : undefined} {...props} />
    </FieldShell>
  )
}

export function CheckboxField({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string
  checked?: boolean
  onChange?: (checked: boolean) => void
  disabled?: boolean
}) {
  const id = useId()
  return (
    <label className="ds-check" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      {label}
    </label>
  )
}

export function RadioGroup({
  legend,
  name,
  value,
  onChange,
  options,
}: {
  legend: string
  name: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <fieldset className="ds-field" style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="ds-label">{legend}</legend>
      {options.map((opt) => (
        <label key={opt.value} className="ds-radio">
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
          />
          {opt.label}
        </label>
      ))}
    </fieldset>
  )
}

export function SwitchField({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  const id = useId()
  return (
    <label className="ds-switch" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="ds-switch-track" />
      {label}
    </label>
  )
}
