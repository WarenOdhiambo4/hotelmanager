import { payoutSchema, reversalSchema } from '../../lib/validation'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { HeaderActions, Sheet } from '../../components/HeaderBar'
import { Stat, Tile, Tiles, type Tone } from '../../components/Tiles'
import { Notice, Select, TextField } from '../../components/form'
import { useLoad } from '../../lib/data'
import { dateTime, kes } from '../../lib/format'
import { setTitle } from '../../lib/site'
import { db, friendly, rpc, supabase } from '../../lib/supabase'

function Page({ title, children, tools }: { title: string; children: ReactNode; tools?: ReactNode }) {
  useEffect(() => setTitle(`Admin · ${title}`), [title])
  return (<div><h1 className="sr-only">{title}</h1>{tools ? <HeaderActions>{tools}</HeaderActions> : null}{children}</div>)
}

type Fee = { id: string; vendorId: string | null; method: string; amount: number; status: string; mpesaReceipt: string | null; accountReference: string | null; payerName: string | null; phone: string | null; resultDesc: string | null; createdAt: string }
type Balance = { id: number; status: string; workingAccount: number | null; utilityAccount: number | null; chargesPaidAccount: number | null; detail: string | null; createdAt: string; receivedAt: string | null }
type Payout = { id: string; reference: string; kind: 'b2c' | 'b2b'; recipient: string; recipientType: string; accountReference: string | null; amount: number; reason: string; status: string; requestedBy: string | null; mpesaReceipt: string | null; resultDesc: string | null; createdAt: string }
type Hotel = { vendorId: string; vendorName: string; balance: number }
const FEE_TONE: Record<string, Tone> = { paid: 'ok', unmatched: 'brand', reversalRequested: 'gold', reversed: 'muted', failed: 'danger', cancelled: 'muted' }
const PAYOUT_TONE: Record<string, Tone> = { requested: 'brand', approved: 'gold', sent: 'gold', completed: 'ok', failed: 'danger', rejected: 'muted' }

/** Finance: the Campus Food Paybill (every Daraja action runs in n8n; this page asks and shows). */
export function AdminMpesa() {
  const { session } = useAuth()
  const [sheet, setSheet] = useState<null | { kind: 'reverse'; fee: Fee } | { kind: 'assign'; fee: Fee } | { kind: 'payout' }>(null)
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  const { data, reload } = useLoad(async () => {
    const [f, b, p, h] = await Promise.all([
      db().from('feePayments').select('*').order('createdAt', { ascending: false }).limit(60),
      db().from('mpesaBalances').select('*').order('id', { ascending: false }).limit(1),
      db().from('mpesaPayouts').select('*').order('createdAt', { ascending: false }).limit(40),
      rpc<Hotel[]>('vendorBalances'),
    ])
    return { fees: (f.data ?? []) as Fee[], balance: ((b.data ?? [])[0] ?? null) as Balance | null, payouts: (p.data ?? []) as Payout[], hotels: (h ?? []) as Hotel[] }
  }, { fees: [] as Fee[], balance: null as Balance | null, payouts: [] as Payout[], hotels: [] as Hotel[] }, [])
  useEffect(() => {
    if (!supabase) return
    const ch = supabase.channel(`mpesa-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feePayments' }, () => reload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mpesaBalances' }, () => reload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mpesaPayouts' }, () => reload())
      .subscribe()
    return () => { void supabase?.removeChannel(ch) }
  }, [reload])
  const hotelName = (id: string | null) => data.hotels.find((h) => h.vendorId === id)?.vendorName ?? 'Not matched'
  const act = async (fn: () => PromiseLike<{ error: unknown }>, ok: string) => {
    setMsg(null); const { error } = await fn()
    setMsg(error ? { tone: 'error', text: friendly(error) } : { tone: 'success', text: ok }); setSheet(null); reload()
  }
  const b = data.balance
  const owed = data.hotels.reduce((n, h) => n + Math.max(Number(h.balance), 0), 0)
  return (
    <Page title="M-PESA Paybill" tools={<>
      <button type="button" className="btn" onClick={() => act(() => db().from('mpesaBalances').insert({}), 'Asked Safaricom for the balance. It appears here in under a minute.')}>Check balance</button>
      <button type="button" className="btn btn-ghost" onClick={() => setSheet({ kind: 'payout' })}>+ Payout</button>
    </>}>
      {msg ? <div className="mb-6"><Notice tone={msg.tone}>{msg.text}</Notice></div> : null}
      <Tiles min="11rem" className="mb-12">
        <Stat label="Paybill balance" value={b?.utilityAccount != null ? kes(b.utilityAccount) : '—'} tone="brand"
          note={b ? (b.status === 'received' ? `as of ${dateTime(b.receivedAt ?? b.createdAt)}` : b.status === 'failed' ? `failed: ${b.detail ?? ''}` : 'asking Safaricom…') : 'not checked yet'} />
        <Stat label="Hotels owe" value={kes(owed)} tone="gold" note="delivery and platform fees" />
        <Stat label="Waiting to be matched" value={data.fees.filter((f) => f.status === 'unmatched').length} tone="danger" />
        <Stat label="Payouts to approve" value={data.payouts.filter((p) => p.status === 'requested' && p.requestedBy !== session?.user.id).length} tone="muted" />
      </Tiles>

      <h2 className="mb-4 text-xs font-extrabold uppercase tracking-[0.14em] text-brand">Fee payments</h2>
      {data.fees.length === 0 ? null : (
        <Tiles min="17rem" className="mb-14">
          {data.fees.map((f) => (
            <Tile key={f.id} tone={FEE_TONE[f.status] ?? 'muted'} kicker={`${f.status} · ${f.method}`} title={hotelName(f.vendorId)} figure={kes(f.amount)} figureNote={dateTime(f.createdAt)}>
              <p className="text-xs">{f.mpesaReceipt ?? 'no code yet'}{f.accountReference ? ` · account ${f.accountReference}` : ''}{f.payerName ? ` · ${f.payerName}` : ''}</p>
              
              <div className="flex gap-4 text-xs font-bold">
                {f.status === 'unmatched' ? <button type="button" className="link" onClick={() => setSheet({ kind: 'assign', fee: f })}>Give to a hotel</button> : null}
                {f.status === 'paid' && f.mpesaReceipt ? <button type="button" className="link text-danger" onClick={() => setSheet({ kind: 'reverse', fee: f })}>Reverse</button> : null}
              </div>
            </Tile>
          ))}
        </Tiles>
      )}

      <h2 className="mb-4 text-xs font-extrabold uppercase tracking-[0.14em] text-brand">Payouts (B2C and B2B)</h2>
      {data.payouts.length === 0 ? null : (
        <Tiles min="17rem">
          {data.payouts.map((p) => (
            <Tile key={p.id} tone={PAYOUT_TONE[p.status] ?? 'muted'} kicker={`${p.reference} · ${p.status}`} title={p.kind === 'b2c' ? `To ${p.recipient}` : `To ${p.recipientType} ${p.recipient}`}
              figure={kes(p.amount)} figureNote={dateTime(p.createdAt)}>
              <p className="text-sm">{p.reason}</p>
              {p.mpesaReceipt ? <p className="text-xs">M-PESA {p.mpesaReceipt}</p> : null}
              
              {p.status === 'requested' ? (p.requestedBy === session?.user.id ? <p className="text-xs text-muted">Another finance person approves this.</p> : (
                <div className="flex gap-4 text-xs font-bold">
                  <button type="button" className="link" onClick={() => act(() => db().from('mpesaPayouts').update({ status: 'approved' }).eq('id', p.id), `${p.reference} approved. n8n sends it now.`)}>Approve and send</button>
                  <button type="button" className="link text-danger" onClick={() => act(() => db().from('mpesaPayouts').update({ status: 'rejected' }).eq('id', p.id), `${p.reference} rejected.`)}>Reject</button>
                </div>
              )) : null}
            </Tile>
          ))}
        </Tiles>
      )}

      <Sheet open={!!sheet} title={sheet?.kind === 'reverse' ? 'Reverse a payment' : sheet?.kind === 'assign' ? 'Give the payment to a hotel' : 'New payout'} onClose={() => setSheet(null)}>
        {sheet?.kind === 'reverse' ? <ReverseForm fee={sheet.fee} onSubmit={(reason) => act(() => db().from('feePayments').update({ status: 'reversalRequested', reversalReason: reason }).eq('id', sheet.fee.id), 'Reversal sent to Safaricom through n8n.')} /> : null}
        {sheet?.kind === 'assign' ? <AssignForm fee={sheet.fee} hotels={data.hotels} onSubmit={(vendorId) => act(() => db().from('feePayments').update({ vendorId }).eq('id', sheet.fee.id), 'Recorded for the hotel; its balance is updated.')} /> : null}
        {sheet?.kind === 'payout' ? <PayoutForm hotels={data.hotels} onSubmit={(row) => act(() => db().from('mpesaPayouts').insert(row), 'Payout requested. Another finance person approves it.')} /> : null}
      </Sheet>
    </Page>
  )
}

function ReverseForm({ fee, onSubmit }: { fee: Fee; onSubmit: (reason: string) => void }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | undefined>()
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const parsed = reversalSchema.safeParse({ reason })
    if (!parsed.success) { setError(parsed.error.issues[0]?.message); return }
    setError(undefined); onSubmit(parsed.data.reason)
  }
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <p>Send {kes(fee.amount)} ({fee.mpesaReceipt}) back to the payer. The hotel's balance goes back up by the same amount when Safaricom confirms.</p>
      <TextField label="Reason" value={reason} onChange={setReason} placeholder="Paid twice by mistake" error={error} />
      <button type="submit" className="btn self-start" disabled={reason.trim().length < 3}>Reverse it</button>
    </form>
  )
}

function AssignForm({ fee, hotels, onSubmit }: { fee: Fee; hotels: Hotel[]; onSubmit: (vendorId: string) => void }) {
  const [vendorId, setVendorId] = useState('')
  return (
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); onSubmit(vendorId) }} className="flex flex-col gap-6">
      <p>{kes(fee.amount)} · {fee.mpesaReceipt} · account “{fee.accountReference}”{fee.payerName ? ` · ${fee.payerName}` : ''}</p>
      <Select label="Hotel that paid" value={vendorId} onChange={setVendorId} placeholder="Choose a hotel" options={hotels.map((h) => ({ value: h.vendorId, label: h.vendorName }))} />
      <button type="submit" className="btn self-start" disabled={!vendorId}>Record for this hotel</button>
    </form>
  )
}

function PayoutForm({ hotels, onSubmit }: { hotels: Hotel[]; onSubmit: (row: Record<string, unknown>) => void }) {
  const [f, setF] = useState({ kind: 'b2c', recipient: '', recipientType: 'paybill', accountReference: '', amount: '', reason: '', vendorId: '' })
  const [error, setError] = useState<string | null>(null)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const parsed = payoutSchema.safeParse(f)
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Check the form.'); return }
    setError(null)
    onSubmit({ kind: parsed.data.kind, recipient: parsed.data.recipient, recipientType: parsed.data.kind === 'b2c' ? 'phone' : f.recipientType,
      accountReference: f.accountReference.trim().slice(0, 20) || null, amount: parsed.data.amount, reason: parsed.data.reason, vendorId: f.vendorId || null })
  }
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <Select label="Pay" value={f.kind} onChange={(v) => setF({ ...f, kind: v })} options={[{ value: 'b2c', label: 'A person (M-PESA number, B2C)' }, { value: 'b2b', label: 'A business (Paybill or Till, B2B)' }]} />
      {f.kind === 'b2b' ? <Select label="Their number is a" value={f.recipientType} onChange={(v) => setF({ ...f, recipientType: v })} options={[{ value: 'paybill', label: 'Paybill' }, { value: 'till', label: 'Till' }]} /> : null}
      <TextField label={f.kind === 'b2c' ? 'M-PESA number' : `${f.recipientType === 'till' ? 'Till' : 'Paybill'} number`} value={f.recipient} onChange={(v) => setF({ ...f, recipient: v })} />
      {f.kind === 'b2b' ? <TextField label="Account number (Paybill)" value={f.accountReference} onChange={(v) => setF({ ...f, accountReference: v })} /> : null}
      <TextField label="Amount (KES)" inputMode="numeric" value={f.amount} onChange={(v) => setF({ ...f, amount: v.replace(/[^\d]/g, '') })} />
      <TextField label="Reason" value={f.reason} onChange={(v) => setF({ ...f, reason: v })} placeholder="Refund for a double payment" />
      <Select label="About a hotel (optional)" value={f.vendorId} onChange={(v) => setF({ ...f, vendorId: v })} placeholder="None" options={hotels.map((h) => ({ value: h.vendorId, label: h.vendorName }))} />
      {error ? <p className="text-sm font-bold text-danger">{error}</p> : null}
      <button type="submit" className="btn self-start" disabled={!f.recipient || Number(f.amount) < 10 || f.reason.trim().length < 3}>Request payout</button>
    </form>
  )
}
