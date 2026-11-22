/*
 * Checkout progress, as on large Kenyan marketplaces: Cart → Your details → Payment → Complete.
 * Done steps and the current one are in the theme colour; the rest stay grey.
 */
const STEPS = ['Cart', 'Your details', 'Payment', 'Complete']

export function OrderSteps({ step, className = '' }: { step: 0 | 1 | 2 | 3; className?: string }) {
  return (
    <nav aria-label="Order progress" className={`w-full ${className}`}>
      <ol className="grid grid-cols-4">
        {STEPS.map((label, i) => {
          const reached = i <= step
          return (
            <li key={label} aria-current={i === step ? 'step' : undefined} className="relative flex flex-col items-center gap-2 text-center">
              {/* connector to the previous step */}
              {i > 0 ? <span aria-hidden="true" className={`absolute right-1/2 top-[0.32rem] h-[2px] w-full ${reached ? 'bg-brand' : 'bg-ink/15'}`} /> : null}
              <span aria-hidden="true" className={`relative z-10 flex h-3 w-3 items-center justify-center rounded-full ${reached ? 'bg-brand' : 'bg-ink/20'} ${i === step ? 'ring-4 ring-brand/20' : ''}`} />
              <span className={`text-[0.7rem] font-bold sm:text-xs ${i === step ? 'text-brand' : reached ? 'text-ink' : 'text-muted'}`}>{label}</span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/** The payment method, shown selected: M-PESA, paid straight to the hotel. */
export function MpesaMethod({ hotel }: { hotel?: string | null }) {
  return (
    <div className="flex items-center gap-3 rounded-[0.8rem] border-2 border-brand px-3 py-2.5" role="radio" aria-checked="true" aria-label="Pay with M-PESA">
      <span className="flex h-10 w-16 shrink-0 items-center justify-center rounded-md bg-white px-1">
        <img src="/brand/mpesa-logo.svg" alt="M-PESA" className="h-full w-full object-contain" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-extrabold">M-PESA</span>
        <span className="block truncate text-xs text-muted">Paid straight to {hotel ?? 'the hotel'}</span>
      </span>
      <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-white">
        <svg viewBox="0 0 12 12" className="h-3 w-3"><path d="M2.5 6.2l2.3 2.3 4.7-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
    </div>
  )
}
