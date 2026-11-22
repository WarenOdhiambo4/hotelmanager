import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { PRESETS } from '../../components/DateRange'
import { useLoad } from '../../lib/data'
import { kes } from '../../lib/format'
import { setTitle } from '../../lib/site'
import { db, rpc, supabase } from '../../lib/supabase'
import type { DailySummaryRow } from '../../lib/types'
import { useFeeBalance } from './VendorFees'
import { useVendor } from './VendorLayout'

/**
 * The hotel's home: a greeting, then cards in the manner of an accounting dashboard. Fees owed and
 * orders waiting at the top, then sales over time, paid against delivered orders, and best sellers.
 * Each chart card has its own period. Colours follow the chosen theme.
 */
type Dish = { itemName: string; quantity: number; sales: number }
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const PERIODS = ['last7', 'last30', 'month', 'prevMonth', 'quarter', 'year', 'prevYear']
const periodRange = (key: string) => { const p = PRESETS.find((x) => x.key === key)!; const [a, b] = p.range(new Date()); return [iso(a), iso(b)] as const }
const compact = (n: number) => (Math.abs(n) >= 1e6 ? `${+(n / 1e6).toFixed(1)} M` : Math.abs(n) >= 1e3 ? `${+(n / 1e3).toFixed(1)} K` : String(Math.round(n)))
// Theme colours: the brand colour, then mixes of it so a chart stays in the theme.
const SHADES = ['var(--color-brand)', 'color-mix(in srgb, var(--color-brand) 60%, var(--color-ink))', 'color-mix(in srgb, var(--color-brand) 55%, white)',
  'color-mix(in srgb, var(--color-brand) 30%, var(--color-ink))', 'color-mix(in srgb, var(--color-brand) 30%, white)', 'color-mix(in srgb, var(--color-ink) 45%, white)']

export function VendorDashboard() {
  const { vendor } = useVendor()
  const { profile } = useAuth()
  useEffect(() => setTitle('Hotel dashboard'), [])
  const v = vendor!
  const first = (profile?.fullName || profile?.email || 'there').split(/[\s@]/)[0]
  return (
    <div className="mt-2">
      <section className="-mx-4 border-b glass-line px-4 pt-4 sm:-mx-6 sm:px-6"
        style={{ backgroundImage: 'radial-gradient(color-mix(in srgb, var(--color-brand) 10%, transparent) 1px, transparent 1px)', backgroundSize: '18px 18px' }}>
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl border glass-line bg-canvas text-lg font-extrabold text-brand">{v.name.slice(0, 1)}</span>
          <div>
            <p className="text-lg font-bold">Hello, {first}</p>
            <p className="text-xs uppercase tracking-[0.12em] text-muted">{v.name}</p>
          </div>
        </div>
        <nav className="mt-5 flex gap-6 text-sm" aria-label="Dashboard">
          {[['/hotel', 'Dashboard'], ['/hotel/orders', 'Live orders'], ['/hotel/reports', 'Sales and history']].map(([to, l]) => (
            <NavLink key={to} to={to!} end className={({ isActive }) => `-mb-px border-b-2 pb-2.5 font-semibold ${isActive ? 'border-brand text-ink' : 'border-transparent text-muted hover:text-ink'}`}>{l}</NavLink>
          ))}
        </nav>
      </section>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <FeesCard vendorId={v.id} />
        <WaitingCard vendorId={v.id} />
        <div className="lg:col-span-2"><SalesCard vendorId={v.id} /></div>
        <OrdersCard vendorId={v.id} />
        <TopDishesCard vendorId={v.id} />
      </div>
    </div>
  )
}

function Card({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border glass-line bg-canvas shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <header className="flex items-center justify-between gap-3 border-b glass-line bg-ink/[0.02] px-5 py-3.5">
        <h2 className="text-base font-bold">{title}</h2>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </section>
  )
}

function Period({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Period"
      className="cursor-pointer bg-transparent text-xs text-muted outline-none hover:text-ink">
      {PERIODS.map((k) => <option key={k} value={k}>{PRESETS.find((p) => p.key === k)!.label}</option>)}
    </select>
  )
}

function Legend({ items }: { items: [string, string, string][] }) {
  return (
    <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
      {items.map(([color, label, value]) => (
        <span key={label} className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} /><span className="text-muted">{label}:</span><strong>{value}</strong></span>
      ))}
    </div>
  )
}

function FeesCard({ vendorId }: { vendorId: string }) {
  const { data: owed } = useFeeBalance(vendorId)
  const { data: paid } = useLoad(async () => {
    const start = iso(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
    const { data } = await db().from('feePayments').select('amount').eq('vendorId', vendorId).eq('status', 'paid').gte('completedAt', start)
    return (data ?? []).reduce((n, r) => n + Number(r.amount), 0)
  }, 0, [vendorId])
  const total = Math.max(owed, 0) + paid
  const owedPct = total ? (Math.max(owed, 0) / total) * 100 : 0
  return (
    <Card title="Campus Food fees" action={<Link to="/hotel/reports" className="flex items-center gap-1 text-sm font-semibold text-brand hover:underline"><span className="text-lg leading-none">+</span> Pay</Link>}>
      <p className="text-sm text-muted">Owed now</p>
      <p className="mt-1 text-2xl font-bold">{kes(Math.max(owed, 0))}</p>
      <div className="mt-4 flex h-2.5 overflow-hidden rounded bg-ink/10">
        <span style={{ width: `${owedPct}%`, background: 'var(--color-brand)' }} />
        <span style={{ width: `${100 - owedPct}%`, background: SHADES[4] }} />
      </div>
      <Legend items={[[SHADES[0]!, 'Owed', kes(Math.max(owed, 0))], [SHADES[4]!, 'Paid this month', kes(paid)]]} />
    </Card>
  )
}

function WaitingCard({ vendorId }: { vendorId: string }) {
  const { data, reload } = useLoad(async () => {
    const since = new Date(Date.now() - 36 * 3600_000).toISOString()
    const { data } = await db().from('orders').select('status,foodSubtotal').eq('vendorId', vendorId).gte('createdAt', since)
    const rows = (data ?? []) as { status: string; foodSubtotal: number }[]
    const count = (s: string[]) => rows.filter((r) => s.includes(r.status))
    return { waiting: count(['paid']), kitchen: count(['accepted', 'preparing']), out: count(['readyForPickup', 'assignedForDelivery', 'outForDelivery']) }
  }, { waiting: [], kitchen: [], out: [] } as Record<'waiting' | 'kitchen' | 'out', { status: string; foodSubtotal: number }[]>, [vendorId])
  useEffect(() => {
    if (!supabase) return
    const ch = supabase.channel(`dash-${vendorId}-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `vendorId=eq.${vendorId}` }, () => reload()).subscribe()
    return () => { void supabase?.removeChannel(ch) }
  }, [vendorId, reload])
  const n = data.waiting.length + data.kitchen.length + data.out.length
  const pct = (x: number) => (n ? (x / n) * 100 : 0)
  return (
    <Card title="Orders now" action={<Link to="/hotel/orders" className="flex items-center gap-1 text-sm font-semibold text-brand hover:underline"><span className="text-lg leading-none">+</span> Open live orders</Link>}>
      <p className="text-sm text-muted">Paid, waiting for you</p>
      <p className="mt-1 text-2xl font-bold">{data.waiting.length} <span className="text-base font-semibold text-muted">· {kes(data.waiting.reduce((s, r) => s + Number(r.foodSubtotal), 0))}</span></p>
      <div className="mt-4 flex h-2.5 overflow-hidden rounded bg-ink/10">
        <span style={{ width: `${pct(data.waiting.length)}%`, background: SHADES[0] }} />
        <span style={{ width: `${pct(data.kitchen.length)}%`, background: SHADES[1] }} />
        <span style={{ width: `${pct(data.out.length)}%`, background: SHADES[4] }} />
      </div>
      <Legend items={[[SHADES[0]!, 'Waiting', String(data.waiting.length)], [SHADES[1]!, 'In the kitchen', String(data.kitchen.length)], [SHADES[4]!, 'Ready or on the way', String(data.out.length)]]} />
    </Card>
  )
}

function useSummary(vendorId: string, period: string) {
  return useLoad(async () => {
    const [from, to] = periodRange(period)
    const rows = (await rpc<DailySummaryRow[]>('dailySummary', { pFrom: from, pTo: to, pVendorId: vendorId })) ?? []
    return { rows, from, to }
  }, { rows: [] as DailySummaryRow[], from: '', to: '' }, [vendorId, period])
}

/** Days for short periods, months for long ones. */
function buckets(rows: DailySummaryRow[], from: string, to: string) {
  if (!from) return []
  const byMonth = (Date.parse(to) - Date.parse(from)) / 86400000 > 62
  const keys: string[] = []
  for (let t = Date.parse(from + 'T00:00:00Z'); t <= Date.parse(to + 'T00:00:00Z'); t += 86400000) {
    const k = new Date(t).toISOString().slice(0, byMonth ? 7 : 10)
    if (!keys.includes(k)) keys.push(k)
  }
  return keys.map((k) => {
    const rs = rows.filter((r) => r.day.startsWith(k))
    const sum = (f: keyof DailySummaryRow) => rs.reduce((n, r) => n + Number(r[f] ?? 0), 0)
    const d = new Date(k + (byMonth ? '-01' : '') + 'T00:00:00Z')
    return { key: k, label: byMonth ? d.toLocaleDateString('en-KE', { month: 'short', timeZone: 'UTC' }) : String(d.getUTCDate()),
             sub: byMonth ? String(d.getUTCFullYear()) : d.toLocaleDateString('en-KE', { month: 'short', timeZone: 'UTC' }),
             sales: sum('foodSales'), paid: sum('ordersPaid'), delivered: sum('ordersDelivered'), fees: sum('deliveryCollections') + sum('platformFees') }
  })
}

function niceMax(v: number) { if (v <= 0) return 1; const p = 10 ** Math.floor(Math.log10(v)); return Math.ceil(v / p) * p }

function SalesCard({ vendorId }: { vendorId: string }) {
  const [period, setPeriod] = useState('last30')
  const { data } = useSummary(vendorId, period)
  const b = useMemo(() => buckets(data.rows, data.from, data.to), [data])
  let run = 0
  const cumulative = b.map((x) => (run += x.sales))
  const max = niceMax(Math.max(...cumulative, 0))
  const W = 640, H = 240, L = 44, B = 30
  const x = (i: number) => L + (b.length <= 1 ? 0 : (i * (W - L - 10)) / (b.length - 1))
  const y = (v: number) => H - B - (v / max) * (H - B - 10)
  const line = cumulative.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const total = (k: 'sales' | 'paid' | 'fees') => b.reduce((n, r) => n + r[k], 0)
  const every = Math.max(1, Math.ceil(b.length / 12))
  return (
    <Card title="Sales" action={<Period value={period} onChange={setPeriod} />}>
      <div className="grid gap-6 md:grid-cols-[1fr_15rem]">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Food sales over the period, running total">
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <g key={f}><line x1={L} x2={W - 6} y1={y(max * f)} y2={y(max * f)} stroke="currentColor" strokeOpacity="0.08" />
              <text x={L - 6} y={y(max * f) + 3} textAnchor="end" fontSize="10" fill="currentColor" opacity="0.55">{compact(max * f)}</text></g>
          ))}
          {b.length ? <path d={`${line} L${x(b.length - 1)},${H - B} L${x(0)},${H - B} Z`} fill="var(--color-brand)" opacity="0.1" /> : null}
          <path d={line} fill="none" stroke="var(--color-brand)" strokeWidth="2" />
          {cumulative.map((v, i) => (i % every === 0 || i === b.length - 1 ? <circle key={i} cx={x(i)} cy={y(v)} r="3" fill="var(--color-brand)" /> : null))}
          {b.map((r, i) => (i % every === 0 ? (
            <g key={r.key}><text x={x(i)} y={H - B + 13} textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.6">{r.label}</text>
              <text x={x(i)} y={H - B + 24} textAnchor="middle" fontSize="8" fill="currentColor" opacity="0.45">{r.sub}</text></g>) : null))}
        </svg>
        <dl className="flex flex-col justify-center gap-4 text-right">
          {([[SHADES[3], 'Orders paid', String(total('paid'))], [SHADES[0], 'Food sales', kes(total('sales'))],
             [SHADES[1], 'Campus Food fees', `${kes(total('fees'))} ( − )`]] as [string, string, string][]).map(([c, l, v2]) => (
            <div key={l}><dt className="flex items-center justify-end gap-1.5 text-sm text-muted"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: c }} />{l}</dt>
              <dd className="mt-0.5 text-lg font-bold">{v2}</dd></div>
          ))}
        </dl>
      </div>
    </Card>
  )
}

function OrdersCard({ vendorId }: { vendorId: string }) {
  const [period, setPeriod] = useState('last7')
  const { data } = useSummary(vendorId, period)
  const b = useMemo(() => buckets(data.rows, data.from, data.to), [data])
  const max = niceMax(Math.max(...b.map((r) => Math.max(r.paid, r.delivered)), 0))
  const W = 520, H = 220, L = 30, B = 30
  const slot = (W - L - 6) / Math.max(1, b.length), bw = Math.max(2, Math.min(14, slot / 3))
  const y = (v: number) => H - B - (v / max) * (H - B - 10)
  const every = Math.max(1, Math.ceil(b.length / 12))
  return (
    <Card title="Orders paid and delivered" action={<Period value={period} onChange={setPeriod} />}>
      <Legend items={[[SHADES[0]!, 'Paid', String(b.reduce((n, r) => n + r.paid, 0))], [SHADES[3]!, 'Delivered', String(b.reduce((n, r) => n + r.delivered, 0))]]} />
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label="Paid and delivered orders">
        {[0, 0.5, 1].map((f) => (
          <g key={f}><line x1={L} x2={W - 6} y1={y(max * f)} y2={y(max * f)} stroke="currentColor" strokeOpacity="0.08" />
            <text x={L - 5} y={y(max * f) + 3} textAnchor="end" fontSize="10" fill="currentColor" opacity="0.55">{compact(max * f)}</text></g>
        ))}
        {b.map((r, i) => {
          const cx = L + slot * i + slot / 2
          return (
            <g key={r.key}>
              <rect x={cx - bw - 1} y={y(r.paid)} width={bw} height={H - B - y(r.paid)} fill={SHADES[0]} rx="1.5"><title>{`${r.label} ${r.sub}: ${r.paid} paid`}</title></rect>
              <rect x={cx + 1} y={y(r.delivered)} width={bw} height={H - B - y(r.delivered)} fill={SHADES[3]} rx="1.5"><title>{`${r.label} ${r.sub}: ${r.delivered} delivered`}</title></rect>
              {i % every === 0 ? <text x={cx} y={H - B + 14} textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.6">{r.label}</text> : null}
            </g>
          )
        })}
      </svg>
    </Card>
  )
}

function TopDishesCard({ vendorId }: { vendorId: string }) {
  const [period, setPeriod] = useState('month')
  const { data: dishes } = useLoad(async () => {
    const [from, to] = periodRange(period)
    return ((await rpc<Dish[]>('topDishes', { pFrom: from, pTo: to, pVendorId: vendorId, pLimit: 6 })) ?? []).map((d) => ({ ...d, sales: Number(d.sales) }))
  }, [] as Dish[], [vendorId, period])
  const total = dishes.reduce((n, d) => n + d.sales, 0)
  const R = 70, C = 2 * Math.PI * R
  let offset = 0
  return (
    <Card title="Best sellers" action={<Period value={period} onChange={setPeriod} />}>
      <div className="flex flex-col items-center gap-6 sm:flex-row">
        <svg viewBox="0 0 200 200" className="h-44 w-44 shrink-0" role="img" aria-label="Sales by dish">
          <circle cx="100" cy="100" r={R} fill="none" stroke="currentColor" strokeOpacity="0.08" strokeWidth="26" />
          {dishes.map((d, i) => {
            const len = total ? (d.sales / total) * C : 0
            const el = <circle key={d.itemName} cx="100" cy="100" r={R} fill="none" stroke={SHADES[i % SHADES.length]} strokeWidth="26"
              strokeDasharray={`${Math.max(len - 2, 0)} ${C}`} strokeDashoffset={-offset} transform="rotate(-90 100 100)"><title>{`${d.itemName}: ${kes(d.sales)}`}</title></circle>
            offset += len
            return el
          })}
          <text x="100" y="94" textAnchor="middle" fontSize="11" fill="currentColor" opacity="0.6">All dishes</text>
          <text x="100" y="114" textAnchor="middle" fontSize="15" fontWeight="700" fill="currentColor">{kes(total)}</text>
        </svg>
        <ul className="w-full min-w-0 flex-1 space-y-3 text-sm">
          {dishes.map((d, i) => (
            <li key={d.itemName} className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2"><i className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: SHADES[i % SHADES.length] }} /><span className="truncate">{d.itemName}</span></span>
              <strong className="shrink-0">{kes(d.sales)}</strong>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}
