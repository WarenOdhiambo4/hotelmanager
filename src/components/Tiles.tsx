import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { OrderStatus } from '../lib/types'
import { Stroke } from './Stroke'

/**
 * Card-like tiles without cards: each record is a self-contained block (a coloured top rule,
 * a picture or avatar, the key figure, details and actions) sitting straight on the canvas.
 * No box, border, background or shadow around it; tiles flow in a responsive grid, never a list.
 */

export type Tone = 'brand' | 'ok' | 'danger' | 'gold' | 'leaf' | 'muted'

// One accent colour only: the theme's brand for things that need action, red for problems,
// a clear neutral line for everything else (no multicolour).
const NEUTRAL = 'color-mix(in srgb, var(--color-ink) 16%, transparent)'
const RULE: Record<Tone, string> = { brand: 'var(--color-brand)', danger: 'var(--color-danger)', ok: NEUTRAL, gold: NEUTRAL, leaf: NEUTRAL, muted: NEUTRAL }
const TEXT: Record<Tone, string> = { brand: 'text-brand', danger: 'text-danger', ok: 'text-ink', gold: 'text-muted', leaf: 'text-muted', muted: 'text-muted' }

export function Tiles({ children, min = '17rem', className = '' }: { children: ReactNode; min?: string; className?: string }) {
  return (
    <div className={`grid gap-x-8 gap-y-10 ${className}`} style={{ gridTemplateColumns: `repeat(auto-fit, minmax(min(${min}, 100%), 1fr))` }}>
      {children}
    </div>
  )
}

export function Tile({ tone = 'muted', visual, kicker, title, to, figure, figureNote, children, wide = false, id }: {
  tone?: Tone
  visual?: ReactNode
  kicker?: ReactNode
  title: ReactNode
  to?: string
  figure?: ReactNode
  figureNote?: ReactNode
  children?: ReactNode
  wide?: boolean
  id?: string
}) {
  return (
    <article id={id} className={`flex min-w-0 flex-col gap-3 ${wide ? 'col-span-full' : ''}`}>
      <Stroke color={RULE[tone]} seed={typeof title === 'string' ? title : kicker as string} />
      <header className="flex items-start gap-3">
        {visual ? <div className="shrink-0">{visual}</div> : null}
        <div className="min-w-0 flex-1">
          {kicker ? <p className={`text-[0.65rem] font-extrabold uppercase tracking-[0.14em] ${TEXT[tone]}`}>{kicker}</p> : null}
          <p className="truncate text-base font-extrabold">{to ? <Link to={to} className="hover:text-brand">{title}</Link> : title}</p>
        </div>
        {figure !== undefined ? (
          <div className="shrink-0 text-right">
            <p className="text-lg font-extrabold leading-tight">{figure}</p>
            {figureNote ? <p className="text-[0.65rem] text-muted">{figureNote}</p> : null}
          </div>
        ) : null}
      </header>
      {children ? <div className="flex flex-col gap-2 text-sm">{children}</div> : null}
    </article>
  )
}

/** Small key/value facts inside a tile. */
export function Facts({ items }: { items: [ReactNode, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
      {items.map(([k, v], n) => (
        <div key={n} className="contents"><dt className="text-muted">{k}</dt><dd className="truncate text-right font-semibold">{v}</dd></div>
      ))}
    </dl>
  )
}

/** A headline number tile for dashboards. */
export function Stat({ label, value, tone = 'brand', note }: { label: string; value: ReactNode; tone?: Tone; note?: ReactNode }) {
  return (
    <div>
      <Stroke color={RULE[tone]} seed={label} className="mb-2.5" />
      <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-1 text-2xl font-extrabold leading-tight">{value}</p>
      {note ? <p className="story mt-0.5 text-xs text-muted">{note}</p> : null}
    </div>
  )
}

/** A round initial for records without a picture. */
export function Initial({ text, tone = 'brand' }: { text: string; tone?: Tone }) {
  return (
    <span className="flex h-11 w-11 items-center justify-center rounded-full border text-sm font-extrabold" style={{ borderColor: RULE[tone] }} aria-hidden="true">
      {text.trim().slice(0, 2).toUpperCase() || '·'}
    </span>
  )
}

export function Chip({ children, tone = 'muted' }: { children: ReactNode; tone?: Tone }) {
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[0.65rem] font-extrabold uppercase tracking-[0.08em] ${TEXT[tone]}`} style={{ borderColor: RULE[tone] }}>{children}</span>
}

export const orderTone = (s: OrderStatus): Tone =>
  ['delivered', 'refunded'].includes(s) ? 'ok'
    : ['rejected', 'cancelled', 'paymentFailed'].includes(s) ? 'danger'
      : ['paid', 'cancellationRequested', 'refundPending'].includes(s) ? 'brand'
        : ['draft', 'awaitingPayment', 'paymentPending'].includes(s) ? 'muted' : 'gold'

export const Empty = ({ children }: { children: ReactNode }) => <p className="py-6 text-sm text-muted">{children}</p>
