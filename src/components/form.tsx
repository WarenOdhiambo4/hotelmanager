import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

/* Flat form primitives: no boxes, no backgrounds. One bottom line per field;
   grouping comes from whitespace and type, never from a container. */

type Base = { label: string; error?: string; hint?: string; className?: string }

function Shell({ id, label, error, className = '', children }: Base & { id: string; children: ReactNode }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={id} className="text-xs font-bold uppercase tracking-[0.14em] text-muted">{label}</label>
      {children}
      {error ? <p id={`${id}-error`} className="text-sm text-danger">{error}</p>
        : null}
    </div>
  )
}

type TextFieldProps = Base & Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'className'> & {
  value: string
  onChange: (value: string) => void
}

export function TextField({ label, error, hint, className, value, onChange, id, ...rest }: TextFieldProps) {
  const auto = useId()
  const fieldId = id ?? auto
  return (
    <Shell id={fieldId} label={label} error={error} hint={hint} className={className}>
      <input id={fieldId} className="field" value={value} onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined} aria-describedby={error ? `${fieldId}-error` : undefined} {...rest} />
    </Shell>
  )
}

type TextAreaProps = Base & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value' | 'className'> & {
  value: string
  onChange: (value: string) => void
}

export function TextArea({ label, error, hint, className, value, onChange, rows = 3, ...rest }: TextAreaProps) {
  const id = useId()
  return (
    <Shell id={id} label={label} error={error} hint={hint} className={className}>
      <textarea id={id} rows={rows} className="field resize-y" value={value} onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined} {...rest} />
    </Shell>
  )
}

type SelectProps = Base & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value' | 'className'> & {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
}

export function Select({ label, error, hint, className, value, onChange, options, placeholder, ...rest }: SelectProps) {
  const id = useId()
  return (
    <Shell id={id} label={label} error={error} hint={hint} className={className}>
      <select id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={error ? true : undefined} {...rest}>
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Shell>
  )
}

export function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  const id = useId()
  return (
    <div className="flex flex-col gap-0.5">
      <label htmlFor={id} className="flex cursor-pointer items-center gap-3">
        <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[var(--color-brand)]" />
        <span>{label}</span>
      </label>
      
    </div>
  )
}

/** Inline status line. Coloured text, never a box. */
export function Notice({ tone = 'info', children }: { tone?: 'error' | 'success' | 'info'; children: ReactNode }) {
  const color = tone === 'error' ? 'text-danger' : tone === 'success' ? 'text-ok' : 'text-muted'
  return <p role={tone === 'error' ? 'alert' : 'status'} className={`text-base ${color}`}>{children}</p>
}

/** Rating picker drawn as words of stars in the display font (no icon set). */
export function StarPicker({ value, onChange, error }: { value: number; onChange: (v: number) => void; error?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Your rating</span>
      <div className="flex gap-1" role="radiogroup" aria-label="Rating out of 5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} of 5`} onClick={() => onChange(n)}
            className={`font-display text-3xl leading-none transition-colors ${n <= value ? 'text-gold' : 'text-line hover:text-sun'}`}>★</button>
        ))}
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  )
}

export const Stars = ({ n }: { n: number }) => (
  <span className="tracking-[0.2em] text-gold" aria-label={`${n} out of 5`}>{'★'.repeat(n)}<span className="text-line">{'★'.repeat(5 - n)}</span></span>
)

/** Invisible bait field: people never see it, bots fill it in. */
export function Bait({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
      <label>Leave this empty<input tabIndex={-1} autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} name="website" /></label>
    </div>
  )
}
