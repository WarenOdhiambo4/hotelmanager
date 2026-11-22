import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronIcon } from './Icons'

/**
 * Date range for reports: a "Date range: This Month" button with a list of presets (today, weeks,
 * months, quarters, years, previous periods) and Custom, which opens two month calendars with From and
 * To boxes and Apply / Cancel. Values are ISO dates (YYYY-MM-DD).
 */
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y!, (m ?? 1) - 1, d ?? 1) }
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const startOfWeek = (d: Date) => addDays(d, -((d.getDay() + 6) % 7))            // weeks start on Monday
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0)
const startOfQuarter = (d: Date) => new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1)
const display = (s: string) => { const d = parse(s); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` }

export const PRESETS: { key: string; label: string; range: (t: Date) => [Date, Date] }[] = [
  { key: 'today', label: 'Today', range: (t) => [t, t] },
  { key: 'yesterday', label: 'Previous Day', range: (t) => [addDays(t, -1), addDays(t, -1)] },
  { key: 'week', label: 'This Week', range: (t) => [startOfWeek(t), addDays(startOfWeek(t), 6)] },
  { key: 'prevWeek', label: 'Previous Week', range: (t) => [addDays(startOfWeek(t), -7), addDays(startOfWeek(t), -1)] },
  { key: 'last7', label: 'Last 7 Days', range: (t) => [addDays(t, -6), t] },
  { key: 'last14', label: 'Last 14 Days', range: (t) => [addDays(t, -13), t] },
  { key: 'last30', label: 'Last 30 Days', range: (t) => [addDays(t, -29), t] },
  { key: 'month', label: 'This Month', range: (t) => [startOfMonth(t), endOfMonth(t)] },
  { key: 'mtd', label: 'Month To Date', range: (t) => [startOfMonth(t), t] },
  { key: 'prevMonth', label: 'Previous Month', range: (t) => [startOfMonth(new Date(t.getFullYear(), t.getMonth() - 1, 1)), endOfMonth(new Date(t.getFullYear(), t.getMonth() - 1, 1))] },
  { key: 'quarter', label: 'This Quarter', range: (t) => [startOfQuarter(t), endOfMonth(new Date(startOfQuarter(t).getFullYear(), startOfQuarter(t).getMonth() + 2, 1))] },
  { key: 'qtd', label: 'Quarter To Date', range: (t) => [startOfQuarter(t), t] },
  { key: 'prevQuarter', label: 'Previous Quarter', range: (t) => { const s = new Date(startOfQuarter(t).getFullYear(), startOfQuarter(t).getMonth() - 3, 1); return [s, endOfMonth(new Date(s.getFullYear(), s.getMonth() + 2, 1))] } },
  { key: 'year', label: 'This Year', range: (t) => [new Date(t.getFullYear(), 0, 1), new Date(t.getFullYear(), 11, 31)] },
  { key: 'ytd', label: 'Year To Date', range: (t) => [new Date(t.getFullYear(), 0, 1), t] },
  { key: 'prevYear', label: 'Previous Year', range: (t) => [new Date(t.getFullYear() - 1, 0, 1), new Date(t.getFullYear() - 1, 11, 31)] },
]

function matchPreset(from: string, to: string): string {
  const t = new Date()
  const p = PRESETS.find((x) => { const [a, b] = x.range(t); return iso(a) === from && iso(b) === to })
  return p?.label ?? 'Custom'
}

export function DateRange({ from, to, onChange, label = 'Date range' }: { from: string; to: string; onChange: (from: string, to: string) => void; label?: string }) {
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const click = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setCustom(false) } }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); setCustom(false) } }
    document.addEventListener('mousedown', click); document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', click); document.removeEventListener('keydown', key) }
  }, [open])
  const current = matchPreset(from, to)
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => { setOpen(!open); setCustom(false) }} aria-expanded={open} aria-haspopup="listbox"
        className="flex items-center gap-2 rounded-lg border glass-line bg-canvas px-3 py-1.5 text-xs hover:border-brand">
        <span className="text-muted">{label}:</span><span className="font-bold">{current}</span><ChevronIcon />
      </button>
      <span className="ml-2 hidden text-xs text-muted sm:inline">From {display(from)} To {display(to)}</span>
      {open ? (
        <div className="drop-in absolute left-0 z-[75] mt-1 flex max-w-[calc(100vw-1.5rem)] rounded-xl border glass-line bg-canvas text-sm shadow-[0_12px_32px_-12px_rgba(0,0,0,0.25)]">
          <ul role="listbox" className="max-h-80 w-44 shrink-0 overflow-y-auto p-1.5">
            {PRESETS.map((p) => (
              <li key={p.key}>
                <button type="button" role="option" aria-selected={current === p.label}
                  className={`w-full rounded-lg px-3 py-1.5 text-left ${current === p.label && !custom ? 'bg-brand text-white' : 'hover:bg-ink/5'}`}
                  onClick={() => { const [a, b] = p.range(new Date()); onChange(iso(a), iso(b)); setOpen(false) }}>{p.label}</button>
              </li>
            ))}
            <li>
              <button type="button" role="option" aria-selected={custom || current === 'Custom'}
                className={`w-full rounded-lg px-3 py-1.5 text-left ${custom || current === 'Custom' ? 'bg-brand text-white' : 'hover:bg-ink/5'}`}
                onClick={() => setCustom(true)}>Custom</button>
            </li>
          </ul>
          {custom ? <CustomRange from={from} to={to} onCancel={() => setCustom(false)} onApply={(a, b) => { onChange(a, b); setCustom(false); setOpen(false) }} /> : null}
        </div>
      ) : null}
    </div>
  )
}

function CustomRange({ from, to, onApply, onCancel }: { from: string; to: string; onApply: (a: string, b: string) => void; onCancel: () => void }) {
  const [a, setA] = useState(from)
  const [b, setB] = useState(to)
  const [picking, setPicking] = useState<'from' | 'to'>('from')
  const [left, setLeft] = useState(() => startOfMonth(parse(from)))
  const [right, setRight] = useState(() => { const r = startOfMonth(parse(to)); return r <= startOfMonth(parse(from)) ? new Date(r.getFullYear(), r.getMonth() + 1, 1) : r })
  const pick = (d: string) => {
    if (picking === 'from') { setA(d); if (d > b) setB(d); setPicking('to') }
    else if (d < a) { setA(d); setPicking('to') }
    else { setB(d); setPicking('from') }
  }
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(a) && /^\d{4}-\d{2}-\d{2}$/.test(b) && a <= b
  return (
    <div className="border-l glass-line p-4">
      <div className="flex flex-wrap gap-3">
        <input type="date" value={a} onChange={(e) => { setA(e.target.value); if (e.target.value) setLeft(startOfMonth(parse(e.target.value))) }}
          onFocus={() => setPicking('from')} className={`field !w-40 !py-1 !text-xs ${picking === 'from' ? '!border-brand' : ''}`} aria-label="From" />
        <input type="date" value={b} onChange={(e) => { setB(e.target.value); if (e.target.value) setRight(startOfMonth(parse(e.target.value))) }}
          onFocus={() => setPicking('to')} className={`field !w-40 !py-1 !text-xs ${picking === 'to' ? '!border-brand' : ''}`} aria-label="To" />
      </div>
      <div className="mt-4 flex flex-col gap-6 md:flex-row">
        <Month month={left} setMonth={setLeft} from={a} to={b} onPick={pick} />
        <div className="hidden md:block"><Month month={right} setMonth={setRight} from={a} to={b} onPick={pick} /></div>
      </div>
      <div className="mt-4 flex items-center justify-end gap-3 text-xs">
        <span className="mr-auto text-muted">{a} – {b}</span>
        <button type="button" className="font-bold hover:text-brand" onClick={onCancel}>Cancel</button>
        <button type="button" className="rounded-md bg-brand px-3 py-1.5 font-bold text-white disabled:opacity-50" disabled={!valid} onClick={() => onApply(a, b)}>Apply</button>
      </div>
    </div>
  )
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function Month({ month, setMonth, from, to, onPick }: { month: Date; setMonth: (d: Date) => void; from: string; to: string; onPick: (d: string) => void }) {
  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1)
    const start = addDays(first, -first.getDay())          // calendar grid starts on Sunday
    return Array.from({ length: 42 }, (_, i) => addDays(start, i))
  }, [month])
  const today = iso(new Date())
  const years = Array.from({ length: 9 }, (_, i) => new Date().getFullYear() - 6 + i)
  return (
    <div className="w-64">
      <div className="mb-2 flex items-center justify-between gap-1">
        <button type="button" aria-label="Previous month" className="rounded px-2 py-1 hover:bg-ink/5" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button>
        <select className="rounded border glass-line bg-canvas px-1 py-0.5 text-xs" value={month.getMonth()} onChange={(e) => setMonth(new Date(month.getFullYear(), Number(e.target.value), 1))} aria-label="Month">
          {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
        </select>
        <select className="rounded border glass-line bg-canvas px-1 py-0.5 text-xs" value={month.getFullYear()} onChange={(e) => setMonth(new Date(Number(e.target.value), month.getMonth(), 1))} aria-label="Year">
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <button type="button" aria-label="Next month" className="rounded px-2 py-1 hover:bg-ink/5" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button>
      </div>
      <div className="grid grid-cols-7 text-center text-[0.7rem] font-bold text-muted">{['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => <span key={d} className="py-1">{d}</span>)}</div>
      <div className="grid grid-cols-7 text-center text-xs">
        {days.map((d) => {
          const v = iso(d); const inMonth = d.getMonth() === month.getMonth()
          const edge = v === from || v === to; const inside = v > from && v < to
          return (
            <button key={v} type="button" onClick={() => onPick(v)}
              className={`py-1.5 ${edge ? 'rounded-md bg-brand font-bold text-white' : inside ? 'bg-brand/10' : 'hover:bg-ink/5'} ${inMonth ? '' : 'text-muted/60'} ${v === today && !edge ? 'font-bold text-brand' : ''}`}>
              {d.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}
