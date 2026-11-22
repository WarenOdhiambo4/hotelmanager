// The few navbar icons the owner asked for: search, cart, and a cartoon avatar.

type P = { className?: string }
const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

export function SearchIcon({ className = 'h-4 w-4' }: P) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true"><circle cx="11" cy="11" r="6.5" {...stroke} /><path d="m16 16 4.5 4.5" {...stroke} /></svg>
}

export function CartIcon({ className = 'h-5 w-5' }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M3 4h2.2l2.1 10.3a1.6 1.6 0 0 0 1.6 1.3h8.3a1.6 1.6 0 0 0 1.6-1.2L20.5 8H6.1" {...stroke} />
      <circle cx="9.5" cy="19.5" r="1.4" fill="currentColor" /><circle cx="17" cy="19.5" r="1.4" fill="currentColor" />
    </svg>
  )
}

export function MenuIcon({ className = 'h-4 w-4' }: P) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10" {...stroke} /></svg>
}

export function CloseIcon({ className = 'h-4 w-4' }: P) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" {...stroke} /></svg>
}

export function PhoneIcon({ className = 'h-6 w-6' }: P) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true"><path d="M5 4h3.2l1.6 4.2-2 1.4a11 11 0 0 0 6.6 6.6l1.4-2 4.2 1.6V19a1.6 1.6 0 0 1-1.7 1.6A16.4 16.4 0 0 1 3.4 5.7 1.6 1.6 0 0 1 5 4Z" {...stroke} /></svg>
}

export function ChevronIcon({ className = 'h-3 w-3' }: P) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true"><path d="m6 9 6 6 6-6" {...stroke} /></svg>
}

/** Cartoon avatar: a smiling comrade with a chef's toque, drawn in the theme colours. */
export function CartoonAvatar({ className = 'h-9 w-9' }: P) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="23" fill="var(--color-sun)" />
      <path d="M11 44c2-8 7-11 13-11s11 3 13 11" fill="var(--color-brand)" />
      <circle cx="24" cy="24" r="10" fill="#f3c9a0" />
      <path d="M14.5 20c0-6 4.5-9 9.5-9s9.5 3 9.5 9c-2-2.5-5-3.5-9.5-3.5S16.5 17.5 14.5 20Z" fill="#3b2416" />
      <path d="M15 13.5c-2.5-1-2.8-4.6-.3-5.5 1.3-.5 2.7 0 3.4 1 .7-2.4 3.6-3.4 5.6-2 1.8-1.7 4.8-1 5.6 1.2 2.4-.5 4.3 2 3.1 4.1-.5.9-1.4 1.4-2.4 1.4l-.3 1.6H15.6Z" fill="#fff" stroke="var(--color-gold)" strokeWidth="1" />
      <circle cx="20.5" cy="24.5" r="1.2" fill="#3b2416" /><circle cx="27.5" cy="24.5" r="1.2" fill="#3b2416" />
      <path d="M20.5 28.2c1.9 1.8 5.1 1.8 7 0" fill="none" stroke="#3b2416" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="18.6" cy="27.4" r="1.3" fill="#f29a7a" opacity=".7" /><circle cx="29.4" cy="27.4" r="1.3" fill="#f29a7a" opacity=".7" />
    </svg>
  )
}
