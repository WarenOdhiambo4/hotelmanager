import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useLoad } from '../lib/data'
import { kes } from '../lib/format'
import { rpc, supabase } from '../lib/supabase'
import type { DailySummaryRow } from '../lib/types'

/*
 * Live analysis for the staff portal (every hotel) and the hotel dashboard (one hotel).
 * Charts are drawn by hand in SVG/HTML so they follow the site's theme colours, and they redraw within
 * a couple of seconds of any order changing (Supabase Realtime on `orders`), with a slow poll as a fallback.
 * Every chart has a table view, a hover/keyboard readout, and text in ink colours (never the series colour).
 */

type Pattern = { weekday: number; hour: number; orders: number }
type Dish = { itemName: string; vendorName: string; quantity: number; sales: number }
type Speed = { day: string; delivered: number; medianMinutes: number | null; onTime: number }
type Day = { day: string; placed: number; paid: number; delivered: number; cancelled: number; sales: number; revenue: number }

const ACCENT = 'var(--color-brand)'
const GRID = 'color-mix(in srgb, var(--color-ink) 10%, var(--color-canvas))'
const NEUTRAL = '#8a8580'
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const compact = (n: number) => (Math.abs(n) >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : Math.abs(n) >= 1e4 ? `${+(n / 1e3).toFixed(1)}K` : n.toLocaleString('en-KE'))
const shortDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const hourLabel = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? 'am' : 'pm'}`

function daysBetween(from: string, to: string): string[] {
  const out: string[] = []
  const end = new Date(`${to}T00:00:00Z`).getTime()
  for (let t = new Date(`${from}T00:00:00Z`).getTime(); t <= end && out.length < 370; t += 86400000) out.push(new Date(t).toISOString().slice(0, 10))
  return out
}

/** Clean axis maximum and ticks (0 / 1,000 / 2,000 …). */
function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1]
  const raw = max / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag
  const ticks: number[] = []
  for (let v = 0; v < max + step * 0.999; v += step) ticks.push(Math.round(v * 100) / 100)
  return ticks
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e!.contentRect.width)))
    ro.observe(el)
    setWidth(Math.floor(el.getBoundingClientRect().width))
    return () => ro.disconnect()
  }, [])
  return { ref, width }
}

/* ------------------------------------------------------------------------------------------ */
/* Data: four RPCs, refreshed live                                                            */
/* ------------------------------------------------------------------------------------------ */
function useAnalytics(from: string, to: string, vendorId: string | null) {
  const args = { pFrom: from, pTo: to, pVendorId: vendorId }
  const { data, loading, error, reload } = useLoad(async () => {
    const [summary, patterns, dishes, speed] = await Promise.all([
      rpc<DailySummaryRow[]>('dailySummary', args),
      rpc<Pattern[]>('orderPatterns', args),
      rpc<Dish[]>('topDishes', { ...args, pLimit: 8 }),
      rpc<Speed[]>('deliverySpeed', args),
    ])
    return { summary: summary ?? [], patterns: patterns ?? [], dishes: dishes ?? [], speed: speed ?? [], at: new Date() }
  }, { summary: [] as DailySummaryRow[], patterns: [] as Pattern[], dishes: [] as Dish[], speed: [] as Speed[], at: null as Date | null }, [from, to, vendorId])

  // Live: any change to an order in scope triggers one refresh shortly after (bursts are merged).
  useEffect(() => {
    if (!supabase) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const soon = () => { clearTimeout(timer); timer = setTimeout(reload, 1500) }
    const ch = supabase.channel(`analytics-${vendorId ?? 'all'}-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', ...(vendorId ? { filter: `vendorId=eq.${vendorId}` } : {}) }, soon)
      .subscribe()
    const poll = setInterval(reload, 120000)
    return () => { clearTimeout(timer); clearInterval(poll); void supabase?.removeChannel(ch) }
  }, [vendorId, reload])

  return { data, loading, error }
}

/* ------------------------------------------------------------------------------------------ */
/* Frame: title, one-line reading, chart or table                                             */
/* ------------------------------------------------------------------------------------------ */
function ChartFrame({ title, reading, table, children, wide }: { title: string; reading?: ReactNode; table: ReactNode; children: ReactNode; wide?: boolean }) {
  const [asTable, setAsTable] = useState(false)
  return (
    <figure className={`min-w-0 ${wide ? 'lg:col-span-2' : ''}`}>
      <figcaption className="flex items-baseline justify-between gap-3">
        <span>
          <span className="block text-xs font-extrabold uppercase tracking-[0.14em] text-ink">{title}</span>
          {reading ? <span className="story mt-0.5 block text-xs text-muted">{reading}</span> : null}
        </span>
        <button type="button" className="shrink-0 text-[0.7rem] font-bold text-muted underline-offset-2 hover:text-ink hover:underline" onClick={() => setAsTable(!asTable)} aria-pressed={asTable}>
          {asTable ? 'Chart' : 'Table'}
        </button>
      </figcaption>
      <div className="mt-4">{asTable ? <div className="max-h-72 overflow-auto">{table}</div> : children}</div>
    </figure>
  )
}

function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full text-left text-xs">
      <thead><tr>{head.map((h, i) => <th key={h} className={`border-b glass-line py-1.5 font-bold text-muted ${i ? 'text-right' : ''}`}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={`border-b glass-line py-1.5 ${j ? 'text-right tabular-nums' : ''}`}>{c}</td>)}</tr>)}</tbody>
    </table>
  )
}

function Tip({ x, width, children }: { x: number; width: number; children: ReactNode }) {
  const left = Math.max(0, Math.min(width - 150, x - 75))
  return (
    <div role="status" className="pointer-events-none absolute top-0 z-10 w-[150px] rounded-lg border glass-line bg-canvas px-2.5 py-1.5 text-xs" style={{ left }}>
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------------------------------ */
/* Trend: one series over days, area wash, crosshair readout                                  */
/* ------------------------------------------------------------------------------------------ */
function TrendChart({ points, format, name }: { points: { x: string; y: number | null }[]; format: (n: number) => string; name: string }) {
  const { ref, width } = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const H = 200, L = 44, R = 16, T = 34, B = 24
  const w = Math.max(0, width - L - R), h = H - T - B
  const values = points.map((p) => p.y ?? 0)
  const ticks = niceTicks(Math.max(...values, 0))
  const top = ticks[ticks.length - 1]!
  const xAt = (i: number) => L + (points.length <= 1 ? w / 2 : (i / (points.length - 1)) * w)
  const yAt = (v: number) => T + h - (v / top) * h
  const defined = points.map((p, i) => ({ ...p, i })).filter((p) => p.y !== null)
  const line = defined.map((p, k) => `${k ? 'L' : 'M'}${xAt(p.i).toFixed(1)},${yAt(p.y!).toFixed(1)}`).join('')
  const area = defined.length ? `${line}L${xAt(defined[defined.length - 1]!.i).toFixed(1)},${T + h}L${xAt(defined[0]!.i).toFixed(1)},${T + h}Z` : ''
  const last = defined[defined.length - 1]
  const every = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(w / 70))))
  const pick = (clientX: number, el: Element) => {
    const r = el.getBoundingClientRect()
    const i = Math.round(((clientX - r.left - L) / Math.max(1, w)) * (points.length - 1))
    setHover(Math.max(0, Math.min(points.length - 1, i)))
  }
  const key = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') setHover((i) => Math.min(points.length - 1, (i ?? -1) + 1))
    if (e.key === 'ArrowLeft') setHover((i) => Math.max(0, (i ?? points.length) - 1))
    if (e.key === 'Escape') setHover(null)
  }
  const hp = hover !== null ? points[hover] : null
  return (
    <div ref={ref} className="relative">
      {width > 0 ? (
        <svg width={width} height={H} role="img" aria-label={`${name}, ${points.length} days${last ? `, latest ${format(last.y!)}` : ''}`} tabIndex={0}
          className="block touch-none outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          onPointerMove={(e) => pick(e.clientX, e.currentTarget)} onPointerLeave={() => setHover(null)} onKeyDown={key} onBlur={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={L} x2={L + w} y1={yAt(t)} y2={yAt(t)} stroke={GRID} strokeWidth={1} />
              <text x={L - 8} y={yAt(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[10px] tabular-nums">{compact(t)}</text>
            </g>
          ))}
          {points.map((p, i) => (i % every === 0 || i === points.length - 1) ? (
            <text key={p.x} x={xAt(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'} className="fill-muted text-[10px]">{shortDay(p.x)}</text>
          ) : null)}
          <path d={area} fill={ACCENT} fillOpacity={0.1} />
          <path d={line} fill="none" stroke={ACCENT} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {last ? (
            <>
              <circle cx={xAt(last.i)} cy={yAt(last.y!)} r={4} fill={ACCENT} stroke="var(--color-canvas)" strokeWidth={2} />
              <text x={xAt(last.i) - 6} y={yAt(last.y!) - 12} textAnchor="end" paintOrder="stroke" stroke="var(--color-canvas)" strokeWidth={4} strokeLinejoin="round" className="fill-ink text-[11px] font-bold">{format(last.y!)}</text>
            </>
          ) : null}
          {hp ? (
            <>
              <line x1={xAt(hover!)} x2={xAt(hover!)} y1={T} y2={T + h} stroke="var(--color-ink)" strokeOpacity={0.35} strokeWidth={1} />
              {hp.y !== null ? <circle cx={xAt(hover!)} cy={yAt(hp.y)} r={4.5} fill={ACCENT} stroke="var(--color-canvas)" strokeWidth={2} /> : null}
            </>
          ) : null}
        </svg>
      ) : <div style={{ height: H }} />}
      {hp ? (
        <Tip x={xAt(hover!)} width={width}>
          <span className="block font-extrabold text-ink">{hp.y === null ? 'No data' : format(hp.y)}</span>
          <span className="flex items-center gap-1.5 text-muted"><span className="inline-block h-0.5 w-3 rounded" style={{ background: ACCENT }} />{name} · {shortDay(hp.x)}</span>
        </Tip>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------------------------------ */
/* Columns: a count per day, each bar its own hover target                                    */
/* ------------------------------------------------------------------------------------------ */
function ColumnChart({ points, name }: { points: { x: string; y: number }[]; name: string }) {
  const { ref, width } = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const H = 200, L = 36, R = 8, T = 16, B = 24
  const w = Math.max(0, width - L - R), h = H - T - B
  const ticks = niceTicks(Math.max(...points.map((p) => p.y), 0))
  const top = ticks[ticks.length - 1]!
  const band = w / Math.max(1, points.length)
  const bw = Math.max(2, Math.min(24, band - 2))
  const yAt = (v: number) => T + h - (v / top) * h
  const every = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(w / 70))))
  const peak = points.reduce((m, p, i) => (p.y > (points[m]?.y ?? -1) ? i : m), 0)
  const bar = (x: number, y: number) => {
    const ht = T + h - y
    if (ht <= 0) return ''
    const r = Math.min(4, bw / 2, ht)
    return `M${x},${T + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + bw - r}Q${x + bw},${y} ${x + bw},${y + r}V${T + h}Z`
  }
  return (
    <div ref={ref} className="relative">
      {width > 0 ? (
        <svg width={width} height={H} role="img" aria-label={`${name} per day`} className="block">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={L} x2={L + w} y1={yAt(t)} y2={yAt(t)} stroke={GRID} strokeWidth={1} />
              <text x={L - 8} y={yAt(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[10px] tabular-nums">{compact(t)}</text>
            </g>
          ))}
          {points.map((p, i) => {
            const x = L + i * band + (band - bw) / 2
            return (
              <g key={p.x} tabIndex={0} role="img" aria-label={`${shortDay(p.x)}: ${p.y} ${name.toLowerCase()}`} className="outline-none"
                onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}>
                <rect x={L + i * band} y={T} width={band} height={h} fill="transparent" />
                <path d={bar(x, yAt(p.y))} fill={ACCENT} fillOpacity={hover === null || hover === i ? 1 : 0.55} />
                {i === peak && p.y > 0 && bw >= 10 ? <text x={x + bw / 2} y={yAt(p.y) - 5} textAnchor="middle" className="fill-ink text-[10px] font-bold">{p.y}</text> : null}
              </g>
            )
          })}
          {points.map((p, i) => (i % every === 0 || i === points.length - 1) ? (
            <text key={`l-${p.x}`} x={L + i * band + band / 2} y={H - 6} textAnchor="middle" className="fill-muted text-[10px]">{shortDay(p.x)}</text>
          ) : null)}
        </svg>
      ) : <div style={{ height: H }} />}
      {hover !== null ? (
        <Tip x={L + hover * band + band / 2} width={width}>
          <span className="block font-extrabold text-ink">{points[hover]!.y}</span>
          <span className="text-muted">{name} · {shortDay(points[hover]!.x)}</span>
        </Tip>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------------------------------ */
/* Heatmap: paid orders by weekday and hour, one hue light to dark                            */
/* ------------------------------------------------------------------------------------------ */
const STEPS = [0, 22, 42, 62, 82, 100]
function Heatmap({ patterns }: { patterns: Pattern[] }) {
  const [hover, setHover] = useState<Pattern | null>(null)
  const map = new Map(patterns.map((p) => [`${p.weekday}-${p.hour}`, Number(p.orders)]))
  const max = Math.max(1, ...patterns.map((p) => Number(p.orders)))
  const used = patterns.map((p) => p.hour)
  const first = Math.min(6, ...used), last = Math.max(22, ...used)
  const hours = Array.from({ length: last - first + 1 }, (_, i) => first + i)
  const fill = (n: number) => {
    if (!n) return 'color-mix(in srgb, var(--color-ink) 5%, var(--color-canvas))'
    const step = STEPS[Math.min(5, Math.max(1, Math.ceil((n / max) * 5)))]!
    return `color-mix(in srgb, var(--color-brand) ${step}%, var(--color-canvas))`
  }
  return (
    <div>
      <div className="overflow-x-auto pb-1">
        <div className="grid min-w-[34rem] gap-[2px]" style={{ gridTemplateColumns: `2.25rem repeat(${hours.length}, minmax(0, 1fr))` }}>
          <span />
          {hours.map((h) => <span key={h} className="text-center text-[10px] text-muted">{h % 3 === 0 ? hourLabel(h) : ''}</span>)}
          {WEEKDAYS.map((d, wi) => (
            <div key={d} className="contents">
              <span className="self-center text-[10px] font-bold text-muted">{d}</span>
              {hours.map((h) => {
                const n = map.get(`${wi + 1}-${h}`) ?? 0
                return (
                  <span key={h} tabIndex={0} aria-label={`${d} ${hourLabel(h)}: ${n} orders`}
                    className="h-6 rounded-[3px] outline-none sm:h-7 transition-[outline] hover:outline hover:outline-2 hover:outline-ink/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink/50"
                    style={{ background: fill(n) }}
                    onPointerEnter={() => setHover({ weekday: wi + 1, hour: h, orders: n })} onPointerLeave={() => setHover(null)}
                    onFocus={() => setHover({ weekday: wi + 1, hour: h, orders: n })} onBlur={() => setHover(null)} />
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[11px] text-muted">
        <span aria-live="polite">{hover ? <><strong className="text-ink">{hover.orders} paid orders</strong> · {WEEKDAYS[hover.weekday - 1]} {hourLabel(hover.hour)}–{hourLabel((hover.hour + 1) % 24)}</> : 'Point at a square for the count.'}</span>
        <span className="flex items-center gap-1">Fewer{STEPS.slice(1).map((s) => <span key={s} className="h-2.5 w-4 rounded-[2px]" style={{ background: `color-mix(in srgb, var(--color-brand) ${s}%, var(--color-canvas))` }} />)}More</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------------------------------ */
/* Ranked bars: largest first, one hue, value at the tip                                      */
/* ------------------------------------------------------------------------------------------ */
function RankedBars({ rows }: { rows: { label: string; sub?: string; value: number; shown: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <ol className="flex flex-col gap-3">
      {rows.map((r, i) => (
        <li key={`${r.label}-${i}`} className="grid grid-cols-[minmax(0,11rem)_1fr] items-center gap-3 max-sm:grid-cols-1 max-sm:gap-1" title={`${r.label}: ${r.shown}`}>
          <span className="min-w-0 truncate text-xs"><strong className="font-bold text-ink">{r.label}</strong>{r.sub ? <span className="text-muted"> · {r.sub}</span> : null}</span>
          <span className="flex items-center gap-2">
            <span className="h-3 rounded-r-[4px]" style={{ width: `${Math.max(1.5, (r.value / max) * 85)}%`, background: ACCENT }} />
            <span className="shrink-0 text-xs font-bold tabular-nums text-ink">{r.shown}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

/* ------------------------------------------------------------------------------------------ */
/* Outcomes: one whole split into delivered / in progress / cancelled                         */
/* ------------------------------------------------------------------------------------------ */
function OutcomeBar({ delivered, open, cancelled }: { delivered: number; open: number; cancelled: number }) {
  const total = delivered + open + cancelled
  const parts = [
    { name: 'Delivered', n: delivered, color: 'var(--color-ok)', ink: 'var(--color-canvas)' },
    { name: 'In progress', n: open, color: NEUTRAL, ink: 'var(--color-canvas)' },
    { name: 'Cancelled, rejected or refunded', n: cancelled, color: 'var(--color-danger)', ink: 'var(--color-canvas)' },
  ]
  return (
    <div>
      <div className="flex h-7 w-full gap-[2px]" role="img" aria-label={parts.map((p) => `${p.name} ${p.n}`).join(', ')}>
        {parts.filter((p) => p.n > 0).map((p) => {
          const share = (p.n / total) * 100
          return (
            <span key={p.name} className="flex items-center overflow-visible rounded-[4px] px-2 text-[11px] font-bold" style={{ width: `${share}%`, background: p.color, color: p.ink }} title={`${p.name}: ${p.n} (${Math.round(share)}%)`}>
              {share >= 12 ? `${Math.round(share)}%` : ''}
            </span>
          )
        })}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs">
        {parts.map((p) => (
          <li key={p.name} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: p.color }} /><span className="text-muted">{p.name}</span> <strong className="tabular-nums text-ink">{p.n}</strong></li>
        ))}
      </ul>
    </div>
  )
}

/* ------------------------------------------------------------------------------------------ */
/* Board                                                                                      */
/* ------------------------------------------------------------------------------------------ */
export function AnalyticsBoard({ from, to, vendorId = null }: { from: string; to: string; vendorId?: string | null }) {
  const { data, loading, error } = useAnalytics(from, to, vendorId)
  const hotelView = vendorId !== null

  const days: Day[] = useMemo(() => {
    const by = new Map<string, Day>()
    for (const d of daysBetween(from, to)) by.set(d, { day: d, placed: 0, paid: 0, delivered: 0, cancelled: 0, sales: 0, revenue: 0 })
    for (const r of data.summary) {
      const d = by.get(String(r.day).slice(0, 10))
      if (!d) continue
      d.placed += Number(r.ordersPlaced); d.paid += Number(r.ordersPaid); d.delivered += Number(r.ordersDelivered)
      d.cancelled += Number(r.ordersCancelled); d.sales += Number(r.foodSales); d.revenue += Number(r.platformRevenue)
    }
    return [...by.values()]
  }, [data.summary, from, to])

  const byHotel = useMemo(() => {
    const m = new Map<string, { name: string; sales: number; orders: number }>()
    for (const r of data.summary) {
      const v = m.get(r.vendorId) ?? { name: r.vendorName, sales: 0, orders: 0 }
      v.sales += Number(r.foodSales); v.orders += Number(r.ordersPaid)
      m.set(r.vendorId, v)
    }
    return [...m.values()].sort((a, b) => b.sales - a.sales)
  }, [data.summary])

  if (error && !data.at) return null

  const total = (k: keyof Day) => days.reduce((n, d) => n + Number(d[k]), 0)
  const paid = total('paid'), delivered = total('delivered'), cancelled = total('cancelled')
  const open = Math.max(0, paid - delivered - cancelled)
  const sales = total('sales')
  const best = days.reduce((m, d) => (d.sales > m.sales ? d : m), days[0] ?? { day: from, sales: 0 } as Day)
  const busiest = data.patterns.reduce<Pattern | null>((m, p) => (!m || Number(p.orders) > Number(m.orders) ? p : m), null)
  const speedByDay = new Map(data.speed.map((s) => [String(s.day).slice(0, 10), s]))
  const speedPoints = days.map((d) => ({ x: d.day, y: speedByDay.get(d.day)?.medianMinutes != null ? Number(speedByDay.get(d.day)!.medianMinutes) : null }))
  const onTime = data.speed.reduce((n, s) => n + Number(s.onTime), 0)
  const deliveredTimed = data.speed.reduce((n, s) => n + Number(s.delivered), 0)
  const medians = data.speed.map((s) => Number(s.medianMinutes)).filter((n) => !Number.isNaN(n)).sort((a, b) => a - b)
  const typical = medians.length ? medians[Math.floor(medians.length / 2)]! : null

  return (
    <section aria-label="Analysis" className={`transition-opacity ${loading && data.at ? 'opacity-60' : ''}`}>
      <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.14em] text-brand">
        Analysis
        <span className="flex items-center gap-1.5 font-semibold normal-case tracking-normal text-muted">
          <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-ok" /></span>
          live{data.at ? ` · updated ${data.at.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}
        </span>
      </p>
      <div className="mt-6 grid gap-x-12 gap-y-14 lg:grid-cols-2">
        <ChartFrame title={hotelView ? 'Your food sales' : 'Food sales, all hotels'}
          reading={sales ? <>{kes(sales)} in {days.length} days · best day {shortDay(best.day)} at {kes(best.sales)}</> : 'No paid food sales in these dates yet.'}
          table={<DataTable head={['Day', 'Food sales']} rows={days.map((d) => [shortDay(d.day), kes(d.sales)])} />}>
          <TrendChart name="Food sales" points={days.map((d) => ({ x: d.day, y: d.sales }))} format={(n) => kes(n)} />
        </ChartFrame>

        <ChartFrame title="Paid orders per day"
          reading={paid ? <>{paid} paid of {total('placed')} placed · {Math.round((paid / Math.max(1, total('placed'))) * 100)}% went through M-Pesa</> : 'No paid orders in these dates yet.'}
          table={<DataTable head={['Day', 'Placed', 'Paid', 'Delivered']} rows={days.map((d) => [shortDay(d.day), d.placed, d.paid, d.delivered])} />}>
          <ColumnChart name="Paid orders" points={days.map((d) => ({ x: d.day, y: d.paid }))} />
        </ChartFrame>

        <ChartFrame wide title="When people order"
          reading={busiest ? <>Busiest: {WEEKDAYS[busiest.weekday - 1]} around {hourLabel(busiest.hour)} ({busiest.orders} paid orders). Staff the kitchen and riders for that window.</> : 'The busy hours show here once orders are paid.'}
          table={<DataTable head={['Day', 'Hour', 'Paid orders']} rows={data.patterns.map((p) => [WEEKDAYS[p.weekday - 1]!, hourLabel(p.hour), p.orders])} />}>
          <Heatmap patterns={data.patterns} />
        </ChartFrame>

        <ChartFrame title={hotelView ? 'Your best sellers' : 'Best sellers, all hotels'}
          reading={data.dishes[0] ? <>{data.dishes[0].itemName} leads with {data.dishes[0].quantity} sold</> : 'Dishes rank here once orders are paid.'}
          table={<DataTable head={['Dish', 'Sold', 'Sales']} rows={data.dishes.map((d) => [hotelView ? d.itemName : `${d.itemName} (${d.vendorName})`, d.quantity, kes(d.sales)])} />}>
          {data.dishes.length ? <RankedBars rows={data.dishes.map((d) => ({ label: d.itemName, sub: hotelView ? undefined : d.vendorName, value: Number(d.quantity), shown: `${d.quantity} sold` }))} /> : null}
        </ChartFrame>

        {hotelView ? null : (
          <ChartFrame title="Food sales by hotel"
            reading={byHotel[0] ? <>{byHotel[0].name} leads with {kes(byHotel[0].sales)} · {byHotel.length} hotel{byHotel.length === 1 ? '' : 's'} sold</> : 'Hotels rank here once orders are paid.'}
            table={<DataTable head={['Hotel', 'Paid orders', 'Food sales']} rows={byHotel.map((h) => [h.name, h.orders, kes(h.sales)])} />}>
            {byHotel.length ? <RankedBars rows={byHotel.slice(0, 8).map((h) => ({ label: h.name, sub: `${h.orders} orders`, value: h.sales, shown: kes(h.sales) }))} /> : null}
          </ChartFrame>
        )}

        <ChartFrame title="How orders ended"
          reading={paid ? <>{Math.round((delivered / Math.max(1, paid)) * 100)}% of paid orders delivered</> : 'Outcomes show here once orders are paid.'}
          table={<DataTable head={['Outcome', 'Orders']} rows={[['Delivered', delivered], ['In progress', open], ['Cancelled, rejected or refunded', cancelled]]} />}>
          {paid ? <OutcomeBar delivered={delivered} open={open} cancelled={cancelled} /> : null}
        </ChartFrame>

        <ChartFrame title="Payment to doorstep"
          reading={typical !== null ? <>Typical day: {typical} minutes · {Math.round((onTime / Math.max(1, deliveredTimed)) * 100)}% arrived by the promised time</> : 'Delivery times show here once orders are delivered.'}
          table={<DataTable head={['Day', 'Delivered', 'Median minutes', 'On time']} rows={data.speed.map((s) => [shortDay(String(s.day).slice(0, 10)), s.delivered, s.medianMinutes ?? '—', s.onTime])} />}>
          <TrendChart name="Median minutes" points={speedPoints} format={(n) => `${n} min`} />
        </ChartFrame>
      </div>
    </section>
  )
}

