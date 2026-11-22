import { useLoad } from '../lib/data'
import { daysAgoIso, kes, todayIso } from '../lib/format'
import { rpc } from '../lib/supabase'

/** The case study's success measures for a date range (all hotels for staff, one hotel for its team). */
type Metrics = Record<string, number | null>

const ROWS: [key: string, label: string, kind: 'n' | 'pct' | 'min' | 'kes' | 'rating'][] = [
  ['ordersPlaced', 'Orders placed', 'n'],
  ['ordersCompleted', 'Delivered', 'n'],
  ['activeStudents', 'Customers who paid', 'n'],
  ['paymentSuccessRate', 'Payment success', 'pct'],
  ['paymentFailureRate', 'Payment failure', 'pct'],
  ['avgAcceptMinutes', 'Paid to accepted', 'min'],
  ['avgPrepMinutes', 'Prep time', 'min'],
  ['avgDeliveryMinutes', 'Paid to delivered', 'min'],
  ['onTimeRate', 'Delivered within estimate', 'pct'],
  ['cancellationRate', 'Cancelled or rejected', 'pct'],
  ['refundRate', 'Refunded', 'pct'],
  ['repeatRate', 'Repeat buyers', 'pct'],
  ['averageOrderValue', 'Average order value', 'kes'],
  ['fulfilmentRate', 'Hotel fulfilment', 'pct'],
  ['averageRating', 'Average rating', 'rating'],
  ['netPlatformRevenue', 'Platform fees earned', 'kes'],
]

const show = (v: number | null | undefined, kind: string) =>
  v === null || v === undefined ? '—'
    : kind === 'pct' ? `${v}%` : kind === 'min' ? `${v} min` : kind === 'kes' ? kes(v) : kind === 'rating' ? `${v} / 5` : String(v)

/** Dates come from the page's header bar (no controls in the body). */
export function MetricsPanel({ vendorId = null, title = 'Success measures', from = daysAgoIso(29), to = todayIso() }: { vendorId?: string | null; title?: string; from?: string; to?: string }) {
  const { data, error } = useLoad(() => rpc<Metrics>('platformMetrics', { pFrom: from, pTo: to, pVendorId: vendorId }), {} as Metrics, [from, to, vendorId])
  return (
    <section>
      <h2 className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand">{title} <span className="font-semibold normal-case tracking-normal text-muted">· {from} to {to}</span></h2>
      {error ? <p className="mt-3 text-xs text-danger">{error}</p> : null}
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        {ROWS.map(([key, label, kind]) => (
          <div key={key} className="border-t glass-line pt-2">
            <dt className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-muted">{label}</dt>
            <dd className="text-base font-extrabold">{show(data[key], kind)}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
