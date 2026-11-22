import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { HeaderActions, Sheet } from '../../components/HeaderBar'
import { Stat, Tile, Tiles, type Tone } from '../../components/Tiles'
import { Checkbox, Notice, TextArea, TextField } from '../../components/form'
import { useLoad } from '../../lib/data'
import { dateTime } from '../../lib/format'
import { setTitle } from '../../lib/site'
import { db, friendly, supabase } from '../../lib/supabase'

function Page({ title, children, tools }: { title: string; children: ReactNode; tools?: ReactNode }) {
  useEffect(() => setTitle(`Admin · ${title}`), [title])
  return (
    <div>
      <h1 className="sr-only">{title}</h1>
      {tools ? <HeaderActions>{tools}</HeaderActions> : null}
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------------------------------ */
/* Call-backs: everyone who asked for a real person (voice receptionist, WhatsApp, website)    */
/* ------------------------------------------------------------------------------------------ */
type SupportRow = {
  id: string; reference: string; phone: string; name: string; channel: 'call' | 'whatsapp' | 'web'; topic: string; summary: string | null
  transcript: string | null; orderReference: string | null; status: 'open' | 'inProgress' | 'resolved'; resolution: string | null; createdAt: string; resolvedAt: string | null
}
const CHANNEL_WORDS: Record<SupportRow['channel'], string> = { call: 'Phone call', whatsapp: 'WhatsApp', web: 'Website form' }
const SUPPORT_TONE: Record<SupportRow['status'], Tone> = { open: 'brand', inProgress: 'gold', resolved: 'ok' }

export function AdminCallbacks() {
  const { session } = useAuth()
  const [show, setShow] = useState<'waiting' | 'all'>('waiting')
  const [open, setOpen] = useState<SupportRow | null>(null)
  const { data: rows, reload } = useLoad(async () => {
    let q = db().from('supportRequests').select('*').order('createdAt', { ascending: false }).limit(200)
    if (show === 'waiting') q = q.neq('status', 'resolved')
    const { data, error } = await q
    if (error) throw error
    return (data ?? []) as SupportRow[]
  }, [] as SupportRow[], [show])
  // New requests appear without a refresh.
  useEffect(() => {
    if (!supabase) return
    const ch = supabase.channel(`support-${crypto.randomUUID()}`).on('postgres_changes', { event: '*', schema: 'public', table: 'supportRequests' }, () => reload()).subscribe()
    const t = setInterval(reload, 60000)
    return () => { void supabase?.removeChannel(ch); clearInterval(t) }
  }, [reload])
  const move = async (r: SupportRow, status: SupportRow['status'], resolution?: string) => {
    const patch: Record<string, unknown> = { status, assignedTo: session?.user.id ?? null }
    if (status === 'resolved') { patch.resolution = resolution ?? r.resolution; patch.resolvedAt = new Date().toISOString() }
    await db().from('supportRequests').update(patch).eq('id', r.id)
    setOpen(null); reload()
  }
  return (
    <Page title="Call-backs" tools={
      <div className="flex gap-2 text-xs font-bold">
        {(['waiting', 'all'] as const).map((s) => (
          <button key={s} type="button" onClick={() => setShow(s)} className={`rounded-full px-3 py-1.5 ${show === s ? 'bg-ink text-canvas' : 'hover:text-brand'}`}>{s === 'waiting' ? 'Waiting' : 'All'}</button>
        ))}
      </div>
    }>
      <Tiles min="10rem" className="mb-10">
        <Stat label="Waiting" value={rows.filter((r) => r.status === 'open').length} tone="brand" />
        <Stat label="Being handled" value={rows.filter((r) => r.status === 'inProgress').length} tone="gold" />
        <Stat label="From phone calls" value={rows.filter((r) => r.channel === 'call').length} tone="muted" />
      </Tiles>
      {rows.length === 0 ? null : (
        <Tiles min="18rem">
          {rows.map((r) => (
            <Tile key={r.id} tone={SUPPORT_TONE[r.status]} kicker={`${r.reference} · ${CHANNEL_WORDS[r.channel]}`} title={r.name || 'Customer'}
              figure={<a className="link" href={`tel:${r.phone}`}>{r.phone}</a>} figureNote={dateTime(r.createdAt)}>
              <p className="font-bold">{r.topic}</p>
              {r.summary ? <p className="text-sm text-muted">{r.summary}</p> : null}
              {r.orderReference ? <p className="text-xs">Order <strong>{r.orderReference}</strong></p> : null}
              {r.status === 'resolved' && r.resolution ? <p className="text-xs">Resolved: {r.resolution}</p> : null}
              <div className="flex flex-wrap gap-4 text-xs font-bold">
                {r.status === 'open' ? <button type="button" className="link" onClick={() => move(r, 'inProgress')}>I am calling</button> : null}
                {r.status !== 'resolved' ? <button type="button" className="link" onClick={() => setOpen(r)}>Mark resolved</button> : null}
                {r.transcript && r.status === 'resolved' ? <button type="button" className="link" onClick={() => setOpen(r)}>Read the conversation</button> : null}
              </div>
            </Tile>
          ))}
        </Tiles>
      )}
      <Sheet open={!!open} title={open ? `${open.reference} · ${open.name || open.phone}` : ''} onClose={() => setOpen(null)}>
        {open ? <ResolveCallback row={open} onResolve={(text) => move(open, 'resolved', text)} /> : null}
      </Sheet>
    </Page>
  )
}

function ResolveCallback({ row, onResolve }: { row: SupportRow; onResolve: (resolution: string) => void }) {
  const [text, setText] = useState(row.resolution ?? '')
  return (
    <div className="flex flex-col gap-6">
      <p className="text-base font-bold">{row.topic}</p>
      <p><a className="link font-bold" href={`tel:${row.phone}`}>Call {row.phone}</a></p>
      {row.summary ? <p>{row.summary}</p> : null}
      {row.transcript ? <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap font-sans text-xs text-muted">{row.transcript}</pre> : null}
      {row.status !== 'resolved' ? (
        <>
          <TextArea label="What you did" value={text} onChange={setText} rows={3} />
          <button type="button" className="btn self-start" disabled={text.trim().length < 3} onClick={() => onResolve(text.trim())}>Mark resolved</button>
        </>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------------------------------ */
/* Help answers: the knowledge base the WhatsApp agent and the voice receptionist answer from  */
/* ------------------------------------------------------------------------------------------ */
type KnowledgeRow = { id: string; question: string; answer: string; category: string; keywords: string | null; isPublished: boolean; sortOrder: number; updatedAt: string }
const EMPTY_ANSWER = { question: '', answer: '', category: 'General', keywords: '' }

export function AdminKnowledge() {
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<KnowledgeRow | 'new' | null>(null)
  const { data: rows, reload } = useLoad(async () => {
    const { data, error } = await db().from('knowledgeBase').select('*').order('category').order('sortOrder')
    if (error) throw error
    return (data ?? []) as KnowledgeRow[]
  }, [] as KnowledgeRow[], [])
  const term = q.trim().toLowerCase()
  const shown = term ? rows.filter((r) => `${r.question} ${r.answer} ${r.keywords ?? ''} ${r.category}`.toLowerCase().includes(term)) : rows
  const categories = [...new Set(shown.map((r) => r.category))]
  const toggle = async (r: KnowledgeRow, v: boolean) => { await db().from('knowledgeBase').update({ isPublished: v }).eq('id', r.id); reload() }
  return (
    <Page title="Help answers" tools={<>
      <button type="button" className="btn" onClick={() => setEdit('new')}>+ Answer</button>
      <input className="glass ml-auto w-60 rounded-full px-4 py-1.5 text-xs outline-none" placeholder="Search answers" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search answers" />
    </>}>
      {categories.map((c) => (
        <section key={c} className="mb-14">
          <h2 className="mb-4 text-xs font-extrabold uppercase tracking-[0.14em] text-brand">{c}</h2>
          <Tiles min="20rem">
            {shown.filter((r) => r.category === c).map((r) => (
              <Tile key={r.id} tone={r.isPublished ? 'muted' : 'danger'} kicker={r.isPublished ? 'Live' : 'Hidden'} title={r.question}>
                <p className="text-sm">{r.answer}</p>
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <Checkbox label="Live" checked={r.isPublished} onChange={(v) => toggle(r, v)} />
                  <button type="button" className="link font-bold" onClick={() => setEdit(r)}>Edit</button>
                </div>
              </Tile>
            ))}
          </Tiles>
        </section>
      ))}
      {shown.length === 0 ? null : null}
      <Sheet open={!!edit} title={edit === 'new' ? 'Add an answer' : 'Edit answer'} onClose={() => setEdit(null)}>
        {edit ? <KnowledgeForm row={edit === 'new' ? null : edit} onDone={() => { setEdit(null); reload() }} /> : null}
      </Sheet>
    </Page>
  )
}

function KnowledgeForm({ row, onDone }: { row: KnowledgeRow | null; onDone: () => void }) {
  const [form, setForm] = useState(row ? { question: row.question, answer: row.answer, category: row.category, keywords: row.keywords ?? '' } : EMPTY_ANSWER)
  const [msg, setMsg] = useState<string | null>(null)
  async function save(e: FormEvent) {
    e.preventDefault()
    if (form.question.trim().length < 3 || form.answer.trim().length < 3) { setMsg('Write the question and the answer.'); return }
    const values = { question: form.question.trim(), answer: form.answer.trim(), category: form.category.trim() || 'General', keywords: form.keywords.trim() || null }
    const { error } = row ? await db().from('knowledgeBase').update(values).eq('id', row.id) : await db().from('knowledgeBase').insert(values)
    if (error) { setMsg(friendly(error)); return }
    onDone()
  }
  async function remove() {
    if (!row || !window.confirm('Delete this answer?')) return
    const { error } = await db().from('knowledgeBase').delete().eq('id', row.id)
    if (error) { setMsg(friendly(error)); return }
    onDone()
  }
  return (
    <form onSubmit={save} noValidate className="flex flex-col gap-6">
      <TextField label="Question, as people ask it" value={form.question} onChange={(v) => setForm({ ...form, question: v })} />
      <TextArea label="Answer" value={form.answer} onChange={(v) => setForm({ ...form, answer: v })} rows={6} />
      <TextField label="Topic" value={form.category} onChange={(v) => setForm({ ...form, category: v })} placeholder="Ordering, Payment, Delivery" />
      <TextField label="Other ways people say it" value={form.keywords} onChange={(v) => setForm({ ...form, keywords: v })} placeholder="refund money back reverse" />
      {msg ? <Notice tone="error">{msg}</Notice> : null}
      <div className="flex gap-4">
        <button type="submit" className="btn">Save</button>
        {row ? <button type="button" className="btn btn-ghost text-danger" onClick={remove}>Delete</button> : null}
      </div>
    </form>
  )
}
