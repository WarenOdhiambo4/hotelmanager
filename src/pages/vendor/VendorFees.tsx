import { useEffect, useState, type FormEvent } from 'react'
import { Notice, TextField } from '../../components/form'
import { Stat, Tiles } from '../../components/Tiles'
import { useLoad, useSettings } from '../../lib/data'
import { dateTime, kes } from '../../lib/format'
import { db, friendly, rpc, supabase } from '../../lib/supabase'
import { useVendor } from './VendorLayout'

type FeeRow = { id: string; method: 'stk' | 'paybill' | 'verified'; amount: number; status: string; mpesaReceipt: string | null; resultDesc: string | null; createdAt: string; completedAt: string | null }
const STATUS_WORDS: Record<string, string> = {
  initiated: 'Sending the prompt…', pending: 'Waiting for your PIN', verifying: 'Checking with Safaricom', paid: 'Paid', failed: 'Not paid',
  cancelled: 'Cancelled on the phone', reversalRequested: 'Being reversed', reversed: 'Reversed', unmatched: 'Waiting for Campus Food',
}
const METHOD_WORDS: Record<FeeRow['method'], string> = { stk: 'M-PESA prompt', paybill: 'Paybill', verified: 'Code checked' }

/** What the hotel owes Campus Food, updated live after every paid order and every fee payment. */
export function useFeeBalance(vendorId: string | undefined) {
  const state = useLoad(async () => (vendorId ? Number(await rpc<number>('vendorFeeBalance', { pVendorId: vendorId })) : 0), 0, [vendorId])
  const { reload } = state
  useEffect(() => {
    if (!supabase || !vendorId) return
    const ch = supabase.channel(`fees-${vendorId}-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ledgerEntries', filter: `vendorId=eq.${vendorId}` }, () => reload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feePayments', filter: `vendorId=eq.${vendorId}` }, () => reload())
      .subscribe()
    return () => { void supabase?.removeChannel(ch) }
  }, [vendorId, reload])
  return state
}

/** Campus Food fees: balance, pay by M-PESA prompt, pay by Paybill, confirm a code, recent payments. */
export function VendorFees() {
  const { vendor } = useVendor()
  const v = vendor! as typeof vendor & { feeCode?: string | null }
  const { data: settings } = useSettings()
  const paybill = (settings as typeof settings & { feePaybill?: string | null }).feePaybill
  const { data: balance } = useFeeBalance(v.id)
  const { data: rows, reload } = useLoad(async () => {
    const { data, error } = await db().from('feePayments').select('id,method,amount,status,mpesaReceipt,resultDesc,createdAt,completedAt')
      .eq('vendorId', v.id).order('createdAt', { ascending: false }).limit(8)
    if (error) throw error
    return (data ?? []) as FeeRow[]
  }, [] as FeeRow[], [v.id])
  useEffect(() => {
    if (!supabase) return
    const ch = supabase.channel(`feerows-${v.id}-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feePayments', filter: `vendorId=eq.${v.id}` }, () => reload()).subscribe()
    return () => { void supabase?.removeChannel(ch) }
  }, [v.id, reload])

  const [phone, setPhone] = useState(v.phone ?? '')
  const [amount, setAmount] = useState('')
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const pay = async (e: FormEvent) => {
    e.preventDefault(); setMsg(null); setBusy(true)
    const value = Number(amount || balance)
    const { error } = await db().from('feePayments').insert({ vendorId: v.id, method: 'stk', phone, amount: value })
    setBusy(false)
    setMsg(error ? { tone: 'error', text: friendly(error) } : { tone: 'success', text: `An M-PESA prompt for ${kes(Math.ceil(value))} is on its way to ${phone}. Enter the M-PESA PIN; your balance updates as soon as Safaricom confirms.` })
    setAmount(''); reload()
  }
  const verify = async (e: FormEvent) => {
    e.preventDefault(); setMsg(null); setBusy(true)
    const { error } = await db().from('feePayments').insert({ vendorId: v.id, method: 'verified', amount: 1, mpesaReceipt: code })
    setBusy(false)
    setMsg(error ? { tone: 'error', text: friendly(error) } : { tone: 'success', text: `Checking ${code.toUpperCase()} with Safaricom. Your balance updates when it is confirmed.` })
    setCode(''); reload()
  }
  const owed = Math.max(balance, 0)
  return (
    <section className="mb-14">
      <h2 className="mb-4 text-xs font-extrabold uppercase tracking-[0.14em] text-brand">Campus Food fees</h2>
      <Tiles min="12rem">
        <Stat label="You owe now" value={kes(owed)} tone={owed > 0 ? 'brand' : 'ok'} note="delivery and platform fees, updated live" />
        {balance < 0 ? <Stat label="Credit" value={kes(-balance)} tone="ok" note="paid ahead" /> : null}
        {paybill ? <Stat label="Paybill" value={paybill} tone="muted" note={<>Account number <strong>{v.feeCode ?? '—'}</strong></>} /> : null}
      </Tiles>
      {!paybill ? <p className="mt-6 text-muted">Campus Food has not set its fees Paybill yet.</p> : (
        <div className="mt-8 grid gap-10 lg:grid-cols-2">
          <form onSubmit={pay} noValidate className="flex flex-col gap-4">
            <p className="font-bold">Pay now with an M-PESA prompt</p>
            <div className="grid grid-cols-2 gap-4">
              <TextField label="Safaricom number" type="tel" value={phone} onChange={setPhone} />
              <TextField label="Amount (KES)" inputMode="numeric" value={amount} onChange={(x) => setAmount(x.replace(/[^\d]/g, ''))} placeholder={String(Math.ceil(owed))} />
            </div>
            <button type="submit" className="btn self-start" disabled={busy || owed <= 0}>{owed <= 0 ? 'Nothing to pay' : `Pay ${kes(Math.ceil(Number(amount || owed)))}`}</button>
          </form>
          <form onSubmit={verify} noValidate className="flex flex-col gap-4">
            <p className="font-bold">Paid with Paybill {paybill}?</p>
            <TextField label="M-PESA code" value={code} onChange={(x) => setCode(x.toUpperCase().slice(0, 10))} placeholder="TKL4QX92ZB" />
            <button type="submit" className="btn btn-ghost self-start" disabled={busy || code.length !== 10}>Check this code</button>
          </form>
        </div>
      )}
      {msg ? <div className="mt-4"><Notice tone={msg.tone}>{msg.text}</Notice></div> : null}
      {rows.length ? (
        <ul className="mt-8">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap justify-between gap-2 border-b border-line py-2 text-sm">
              <span>{dateTime(r.createdAt)} · {METHOD_WORDS[r.method]}{r.mpesaReceipt ? ` · ${r.mpesaReceipt}` : ''}</span>
              <span className={`font-bold ${r.status === 'paid' ? 'text-ok' : ['failed', 'cancelled'].includes(r.status) ? 'text-danger' : ''}`}>
                {STATUS_WORDS[r.status] ?? r.status}{r.status === 'verifying' ? '' : ` · ${kes(r.amount)}`}{r.status === 'failed' && r.resultDesc ? ` (${r.resultDesc})` : ''}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
