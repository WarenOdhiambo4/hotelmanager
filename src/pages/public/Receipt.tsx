import QRCode from 'qrcode'
import { useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { useLoad, useSettings } from '../../lib/data'
import { ORDER_STATUS_LABEL } from '../../lib/format'
import { setTitle } from '../../lib/site'
import { supabase } from '../../lib/supabase'
import type { Receipt as ReceiptData } from '../../lib/types'

const money = (n: number | string | null | undefined) =>
  `Ksh ${Number(n ?? 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
/** "27th Dec '25 18:19" in Nairobi time, as printed on till slips. */
const slipDate = (iso?: string | null) => {
  if (!iso) return ''
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Nairobi', day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
    .formatToParts(new Date(iso)).map((x) => [x.type, x.value]))
  const d = Number(p.day)
  const th = d % 10 === 1 && d !== 11 ? 'st' : d % 10 === 2 && d !== 12 ? 'nd' : d % 10 === 3 && d !== 13 ? 'rd' : 'th'
  return `${d}${th} ${p.month} '${p.year} ${p.hour}:${p.minute}`
}

const DEMO = {
  reference: 'ORD-1042', status: 'delivered', customerName: 'Brian Otieno', createdAt: '2026-11-22T15:02:00Z', paidAt: '2026-11-22T15:03:00Z',
  vendorName: 'Mama Oliech Hotel', vendorLocation: 'Main Gate, Kisii', vendorLogoPath: null, deliveryLocation: 'Hostel B, Room 214',
  foodSubtotal: 450, deliveryFee: 50, platformFee: 10, totalAmount: 510, refundedAmount: 0, mpesaReceipt: 'TKL4QX92ZB',
  items: [{ name: 'Chips and chicken', quantity: 1, unitPrice: 350, lineTotal: 350, imagePath: null }, { name: 'Soda 500ml', quantity: 2, unitPrice: 50, lineTotal: 100, imagePath: null }],
} as unknown as ReceiptData

const Rule = () => <hr className="my-2 border-0 border-t border-dashed border-black/60" />
const Row = ({ left, right, bold }: { left: ReactNode; right: ReactNode; bold?: boolean }) => (
  <div className={`flex justify-between gap-3 ${bold ? 'font-bold' : ''}`}><span>{left}</span><span className="shrink-0 text-right">{right}</span></div>
)

/**
 * Public receipt opened from the SMS link (no sign-in; the long random token is the key).
 * Styled as a thermal till slip: narrow paper, monospace type, dashed rules, QR back to this link.
 */
export function Receipt() {
  const { token = '' } = useParams()
  const { data: settings } = useSettings()
  useEffect(() => setTitle('Receipt'), [])
  const { data: r, loading, error } = useLoad(async () => {
    if (import.meta.env.DEV && token === 'demo') return DEMO // local design check only; stripped from production builds
    if (!supabase) return null
    const { data, error } = await supabase.rpc('getReceipt', { pToken: token })
    if (error) throw error
    return data as ReceiptData | null
  }, null as ReceiptData | null, [token])

  const [qr, setQr] = useState('')
  useEffect(() => {
    void QRCode.toDataURL(window.location.href, { margin: 0, width: 260, color: { dark: '#000000', light: '#ffffff' } }).then(setQr).catch(() => setQr(''))
  }, [token])

  return (
    <main className="min-h-screen bg-neutral-200 px-3 py-6 print:bg-white print:p-0">
      {loading ? <p className="py-32 text-center font-mono text-sm text-neutral-600">Loading receipt…</p>
        : error || !r ? <p className="py-32 text-center font-mono text-sm text-neutral-600">{error ?? 'This receipt link is not valid.'}</p>
        : (
          <>
            <article className="thermal mx-auto w-full max-w-[22rem] bg-white px-5 pb-8 pt-6 font-mono text-[12.5px] leading-snug text-black shadow-sm print:max-w-[80mm] print:px-2 print:shadow-none">
              <h1 className="sr-only">Receipt {r.reference}</h1>
              <header className="text-center">
                <p className="text-base font-bold uppercase tracking-wide">Campus Food</p>
                <p className="font-bold">{r.vendorName}</p>
                {r.vendorLocation ? <p>{r.vendorLocation}</p> : null}
                <p className="mt-2">Kisii University, Kenya</p>
                {settings.supportPhone ? <p>Tel: {settings.supportPhone}</p> : null}
                <p className="mt-2">{slipDate(r.paidAt)}</p>
                <p className="mt-1 font-bold uppercase">Delivery</p>
              </header>
              <Rule />
              {r.items.map((i) => (
                <Row key={i.name} left={`${i.quantity}x ${i.name}`} right={money(i.lineTotal)} />
              ))}
              <Rule />
              <Row left="Food" right={money(r.foodSubtotal)} />
              <Row left="Delivery" right={money(r.deliveryFee)} />
              <Row left="Platform fee" right={money(r.platformFee)} />
              <Rule />
              <Row bold left="TOTAL PAID" right={money(r.totalAmount)} />
              {Number(r.refundedAmount) > 0 ? <Row left="Refunded" right={`-${money(r.refundedAmount)}`} /> : null}
              <Rule />
              <p className="text-center">Payment Data</p>
              <Rule />
              <Row left="Paid by" right="M-PESA" />
              {r.mpesaReceipt ? <Row left="M-PESA code" right={r.mpesaReceipt} /> : null}
              <Row left="Customer" right={r.customerName} />
              <Row left="Deliver to" right={r.deliveryLocation} />
              <Row left="Status" right={ORDER_STATUS_LABEL[r.status]} />
              <Rule />
              <p className="text-center">Issued Date: {slipDate(r.paidAt)}</p>
              <p className="mt-1 text-center">Verification Number</p>
              <p className="text-center">{r.mpesaReceipt ?? r.reference}</p>
              {qr ? <img src={qr} alt="QR code for this receipt" className="mx-auto mt-2 h-32 w-32 [image-rendering:pixelated]" /> : null}
              <p className="mt-3 overflow-hidden whitespace-nowrap text-center">----------Order Information----------</p>
              <p>Order# {r.reference}</p>
              <p>Placed {slipDate(r.createdAt)}</p>
              <p className="mt-5 text-center text-2xl font-bold">Your Order#: {r.reference.replace(/^\D+-?/, '')}</p>
              <p className="mt-3 text-center">How are we doing? Tell us at {window.location.host}/contact</p>
              {settings.supportPhone || settings.supportEmail ? (
                <p className="mt-3 text-center">For help call Campus Food on {settings.supportPhone ?? ''}{settings.supportPhone && settings.supportEmail ? ', email ' : ''}{settings.supportEmail ?? ''}.</p>
              ) : null}
              <p className="mt-5 text-center font-bold">THANK YOU</p>
              <p className="text-center font-bold">KARIBU TENA</p>
            </article>
            <p className="no-print mx-auto mt-4 max-w-[22rem] text-center font-mono text-xs">
              <button type="button" onClick={() => window.print()} className="underline">Print or save as PDF</button>
            </p>
          </>
        )}
    </main>
  )
}
