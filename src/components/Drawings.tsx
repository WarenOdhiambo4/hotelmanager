// Hand-drawn line art used wherever a photo is missing, and as playful accents beside headlines.
// Strokes draw themselves in (pathLength="1" + .draw); notes beside them use the hand font.

type Props = { className?: string; delay?: number }
const s = (delay = 0) => ({ animationDelay: `${delay}ms` })
const line = { fill: 'none', stroke: 'currentColor', strokeWidth: 3, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

export function PlateDrawing({ className = 'h-40 w-40', delay = 0 }: Props) {
  return (
    <svg viewBox="0 0 160 160" className={className} aria-hidden="true">
      <g {...line}>
        <path pathLength={1} className="draw" style={s(delay)} d="M20 98c0 26 27 40 60 40s60-14 60-40" />
        <path pathLength={1} className="draw" style={s(delay + 150)} d="M14 96h132" />
        <path pathLength={1} className="draw" style={s(delay + 300)} d="M36 96c2-22 20-38 44-38s42 16 44 38" />
        <path pathLength={1} className="draw" style={s(delay + 450)} d="M52 82c6-8 14-12 22-12M88 70c10 2 18 8 22 16" />
      </g>
      <g {...line} strokeWidth={2.5} className="text-brand">
        <path className="steam" style={s(0)} d="M62 46c-6-8 6-12 0-22" />
        <path className="steam" style={s(600)} d="M80 42c-6-8 6-12 0-22" />
        <path className="steam" style={s(1200)} d="M98 46c-6-8 6-12 0-22" />
      </g>
    </svg>
  )
}

export function BurgerDrawing({ className = 'h-24 w-24', delay = 0 }: Props) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
      <g {...line}>
        <path pathLength={1} className="draw" style={s(delay)} d="M18 54c0-22 19-34 42-34s42 12 42 34Z" />
        <path pathLength={1} className="draw" style={s(delay + 150)} d="M14 66c10-6 18 6 28 0s18 6 28 0 18 6 28 0 10 4 12 2" />
        <path pathLength={1} className="draw" style={s(delay + 300)} d="M20 78h80M24 88c0 8 6 12 14 12h44c8 0 14-4 14-12" />
        <path pathLength={1} className="draw" style={s(delay + 450)} d="M44 36l2 2M60 32l2 2M74 38l2 2" />
      </g>
    </svg>
  )
}

export function ChapatiDrawing({ className = 'h-24 w-24', delay = 0 }: Props) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
      <g {...line}>
        <ellipse pathLength={1} className="draw" style={s(delay)} cx="60" cy="74" rx="44" ry="16" />
        <path pathLength={1} className="draw" style={s(delay + 150)} d="M16 66c0-9 20-16 44-16s44 7 44 16" />
        <path pathLength={1} className="draw" style={s(delay + 300)} d="M18 58c0-9 19-16 42-16s42 7 42 16" />
        <path pathLength={1} className="draw" style={s(delay + 450)} d="M40 70c4 2 8 2 12 0M66 76c4 2 8 2 12 0M54 82h6" />
      </g>
    </svg>
  )
}

export function ChaiDrawing({ className = 'h-24 w-24', delay = 0 }: Props) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
      <g {...line}>
        <path pathLength={1} className="draw" style={s(delay)} d="M26 46h56v30c0 14-12 24-28 24S26 90 26 76Z" />
        <path pathLength={1} className="draw" style={s(delay + 150)} d="M82 54c12 0 16 6 16 12s-6 12-16 12" />
        <path pathLength={1} className="draw" style={s(delay + 300)} d="M16 104h76" />
      </g>
      <g {...line} strokeWidth={2.5} className="text-brand">
        <path className="steam" d="M44 36c-5-6 5-9 0-16" />
        <path className="steam" style={s(700)} d="M62 36c-5-6 5-9 0-16" />
      </g>
    </svg>
  )
}

export function ScooterDrawing({ className = 'h-24 w-36', delay = 0 }: Props) {
  return (
    <svg viewBox="0 0 180 120" className={className} aria-hidden="true">
      <g {...line}>
        <circle pathLength={1} className="draw" style={s(delay)} cx="40" cy="92" r="16" />
        <circle pathLength={1} className="draw" style={s(delay + 100)} cx="140" cy="92" r="16" />
        <path pathLength={1} className="draw" style={s(delay + 250)} d="M56 92h50l18-34h-26M124 58l8-20h14M70 92l-6-24h40" />
        <path pathLength={1} className="draw" style={s(delay + 400)} d="M58 66h-30v-26h30Z" />
      </g>
      <path {...line} strokeWidth={2} className="text-brand" strokeDasharray="4 8" d="M4 108h30M2 98h16" />
    </svg>
  )
}

export function PhoneDrawing({ className = 'h-28 w-20', delay = 0 }: Props) {
  return (
    <svg viewBox="0 0 80 120" className={className} aria-hidden="true">
      <g {...line}>
        <rect pathLength={1} className="draw" style={s(delay)} x="12" y="6" width="56" height="108" rx="10" />
        <path pathLength={1} className="draw" style={s(delay + 200)} d="M32 16h16M22 40h36M22 52h24M22 76h36M40 100h0" />
      </g>
    </svg>
  )
}

const DRAWINGS = [PlateDrawing, BurgerDrawing, ChapatiDrawing, ChaiDrawing]

/** A drawing chosen from the dish name, so the same dish always gets the same doodle. */
export function DishDrawing({ name, className }: { name: string; className?: string }) {
  const n = name.toLowerCase()
  const Pick = /burger|sandwich/.test(n) ? BurgerDrawing
    : /chapati|pancake|mandazi|bread/.test(n) ? ChapatiDrawing
      : /tea|chai|coffee|juice|drink|soda/.test(n) ? ChaiDrawing
        : DRAWINGS[[...n].reduce((a, c) => a + c.charCodeAt(0), 0) % DRAWINGS.length]!
  return <Pick className={className} />
}

/** Hand-written note with a little curved arrow pointing at something. */
export function HandNote({ children, className = '', flip = false }: { children: string; className?: string; flip?: boolean }) {
  return (
    <span className={`inline-flex items-end gap-1 text-brand ${className}`}>
      {flip ? null : <span className="hand text-xl leading-none sm:text-2xl">{children}</span>}
      <svg viewBox="0 0 60 40" className={`h-8 w-12 ${flip ? '-scale-x-100' : ''}`} aria-hidden="true">
        <path {...line} strokeWidth={2.5} pathLength={1} className="draw" d="M4 6c20 0 36 8 44 26M48 32l2-12M48 32l-11-4" />
      </svg>
      {flip ? <span className="hand text-xl leading-none sm:text-2xl">{children}</span> : null}
    </span>
  )
}
