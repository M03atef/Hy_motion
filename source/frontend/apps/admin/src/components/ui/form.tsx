import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

export function Button({
  loading,
  children,
  className = '',
  type = 'button',
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean
  variant?: ButtonVariant
}) {
  const variants: Record<ButtonVariant, string> = {
    primary:
      'border-[var(--l500)] bg-[var(--l500)] text-[var(--c900)] hover:border-[var(--l400)] hover:bg-[var(--l400)] hover:shadow-[var(--shg)]',
    secondary:
      'border-[var(--lbd)] bg-white text-[var(--ltp)] hover:border-[var(--l500)] hover:text-[var(--l600)]',
    danger:
      'border-[var(--dng500)] bg-[var(--dng500)] text-white hover:border-[var(--dng600)] hover:bg-[var(--dng600)]',
    ghost:
      'border-transparent bg-transparent text-[var(--lts)] hover:bg-[var(--ls2)] hover:text-[var(--ltp)]',
  }

  return (
    <button
      type={type}
      {...props}
      disabled={props.disabled || loading}
      className={`relative inline-flex h-11 items-center justify-center gap-2 rounded-[var(--rpl)] border-2 px-5 text-sm font-semibold transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none disabled:active:scale-100 ${variants[variant]} ${className}`}
    >
      <span className={loading ? 'opacity-0' : ''}>{children}</span>
      {loading ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="h-[20px] w-[20px] animate-spin rounded-full border-[3px] border-[rgba(13,13,13,0.2)] border-t-[var(--c900)]" />
        </span>
      ) : null}
    </button>
  )
}

export function Input({
  label,
  hint,
  error,
  required,
  className = '',
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  hint?: string
  error?: string
  required?: boolean
}) {
  const inputId = id ?? props.name
  return (
    <div className="mb-5">
      {label ? (
        <label htmlFor={inputId} className="mb-1.5 block text-[13px] font-semibold text-[var(--lts)]">
          {label}
          {required ? <span className="text-[var(--dng500)]"> *</span> : null}
        </label>
      ) : null}
      <input
        id={inputId}
        {...props}
        className={`h-11 w-full rounded-[var(--rmd)] border-2 bg-white px-4 text-sm text-[var(--ltp)] outline-none transition-all duration-150 placeholder:text-[var(--ltt)] focus:border-[var(--l500)] focus:shadow-[0_0_0_3px_var(--lglow)] disabled:cursor-not-allowed disabled:bg-[var(--ls2)] disabled:text-[var(--ltt)] ${
          error ? 'border-[var(--dng500)]' : 'border-[var(--lbd)]'
        } ${className}`}
      />
      {error ? <p className="mt-1 text-xs text-[var(--dng600)]">{error}</p> : null}
      {!error && hint ? <p className="mt-1 text-[11px] text-[var(--ltt)]">{hint}</p> : null}
    </div>
  )
}

export function Select({
  label,
  hint,
  error,
  required,
  className = '',
  id,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string
  hint?: string
  error?: string
  required?: boolean
}) {
  const selectId = id ?? props.name
  return (
    <div className="mb-5">
      {label ? (
        <label htmlFor={selectId} className="mb-1.5 block text-[13px] font-semibold text-[var(--lts)]">
          {label}
          {required ? <span className="text-[var(--dng500)]"> *</span> : null}
        </label>
      ) : null}
      <select
        id={selectId}
        {...props}
        className={`h-11 w-full rounded-[var(--rmd)] border-2 bg-white px-3 text-sm text-[var(--ltp)] outline-none transition-all duration-150 focus:border-[var(--l500)] focus:shadow-[0_0_0_3px_var(--lglow)] disabled:cursor-not-allowed disabled:bg-[var(--ls2)] ${
          error ? 'border-[var(--dng500)]' : 'border-[var(--lbd)]'
        } ${className}`}
      >
        {children}
      </select>
      {error ? <p className="mt-1 text-xs text-[var(--dng600)]">{error}</p> : null}
      {!error && hint ? <p className="mt-1 text-[11px] text-[var(--ltt)]">{hint}</p> : null}
    </div>
  )
}

export function TextArea({
  label,
  hint,
  error,
  required,
  className = '',
  id,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string
  hint?: string
  error?: string
  required?: boolean
}) {
  const areaId = id ?? props.name
  return (
    <div className="mb-5">
      {label ? (
        <label htmlFor={areaId} className="mb-1.5 block text-[13px] font-semibold text-[var(--lts)]">
          {label}
          {required ? <span className="text-[var(--dng500)]"> *</span> : null}
        </label>
      ) : null}
      <textarea
        id={areaId}
        {...props}
        className={`min-h-[96px] w-full resize-y rounded-[var(--rmd)] border-2 bg-white px-4 py-3 text-sm text-[var(--ltp)] outline-none transition-all duration-150 placeholder:text-[var(--ltt)] focus:border-[var(--l500)] focus:shadow-[0_0_0_3px_var(--lglow)] disabled:cursor-not-allowed disabled:bg-[var(--ls2)] ${
          error ? 'border-[var(--dng500)]' : 'border-[var(--lbd)]'
        } ${className}`}
      />
      {error ? <p className="mt-1 text-xs text-[var(--dng600)]">{error}</p> : null}
      {!error && hint ? <p className="mt-1 text-[11px] text-[var(--ltt)]">{hint}</p> : null}
    </div>
  )
}

export function AlertError({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <div className="mb-5 flex items-start gap-2.5 rounded-[var(--rmd)] border border-[var(--dng500)] bg-[var(--dng100)] px-4 py-3 text-[13px] text-[var(--dngtxt)]">
      <svg className="mt-0.5 h-[18px] w-[18px] shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
          clipRule="evenodd"
        />
      </svg>
      <div>{children}</div>
    </div>
  )
}

export function AlertSuccess({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <div className="mb-5 rounded-[var(--rmd)] border border-[var(--l500)] bg-[rgba(160,224,64,0.12)] px-4 py-3 text-[13px] text-[var(--l600)]">
      {children}
    </div>
  )
}
