import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { CloseIcon, PhoneIcon } from './Icons'
import { useSettings } from '../lib/data'
import { friendly, rpc } from '../lib/supabase'
import { whatsappLink } from '../lib/site'
import { callbackSchema } from '../lib/validation'

/** ElevenLabs voice agent (the AI receptionist "Amani"). Without it, the pop-up still offers a call-back and WhatsApp. */
const AGENT_ID = String(import.meta.env.VITE_ELEVENLABS_AGENT_ID ?? '').trim()

type Session = {
  endSession: () => Promise<void>
  setMicMuted?: (m: boolean) => void
  sendContextualUpdate?: (text: string) => void
  getInputVolume?: () => number
}
/** Call length limit, the "one minute left" warning and the goodbye cue. The student talk may add EXTRA seconds once
 *  (extend_call) for a caller who is struggling; ElevenLabs itself stops any call at 10 minutes. */
const MAX_CALL = 240
const EXTRA = 300
type CallState = 'idle' | 'ringing' | 'listening' | 'speaking' | 'ended'
const STATE_WORDS: Record<CallState, string> = {
  idle: '', ringing: 'Ringing…', listening: 'Amani is listening. Go ahead.', speaking: 'Amani is speaking…', ended: 'Call ended. Thank you for calling.',
}

/** A phone ringback tone (two short rings, a pause, repeated) made in the browser; returns a stop function. */
function ringTone(): () => void {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return () => undefined
  const ctx = new Ctx()
  const gain = ctx.createGain()
  gain.gain.value = 0
  gain.connect(ctx.destination)
  for (const f of [400, 450]) { const o = ctx.createOscillator(); o.frequency.value = f; o.connect(gain); o.start() }
  const t0 = ctx.currentTime
  for (let cycle = 0; cycle < 6; cycle++) {
    const c = t0 + cycle * 3
    for (const [on, off] of [[0, 0.4], [0.6, 1.0]] as const) {
      gain.gain.setValueAtTime(0.12, c + on)
      gain.gain.setValueAtTime(0, c + off)
    }
  }
  return () => { void ctx.close().catch(() => undefined) }
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

/**
 * A round phone button on every public page. It opens a small pop-up: a voice call with the AI
 * receptionist, "call me back" (supportRequests, via requestCallback), and the WhatsApp line.
 */
export function CallUs() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    if (!open) return
    const click = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', click)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', click); document.removeEventListener('keydown', key) }
  }, [open])
  if (/^\/(hotel|rider)(\/|$)/.test(pathname)) return null
  return (
    <div ref={ref} className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-40 sm:bottom-6 sm:right-6">
      {open ? (
        <div role="dialog" aria-label="Talk to Campus Food"
          className="drop-in absolute bottom-16 right-0 w-[min(19rem,calc(100vw-2rem))] rounded-2xl border border-line bg-canvas p-4 text-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.16em] text-brand">Talk to Campus Food</p>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="flex h-7 w-7 items-center justify-center rounded-full hover:text-brand"><CloseIcon /></button>
          </div>
          <CallPanel />
        </div>
      ) : null}
      {!open && AGENT_ID ? <AmaniNote /> : null}
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? 'Close' : 'Call us'}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white transition-transform hover:scale-105">
        {open ? <CloseIcon className="h-5 w-5" /> : <PhoneIcon />}
      </button>
    </div>
  )
}

/**
 * A hand-drawn note beside the phone button: italic line in a drawn circle, and an arrow curving down to the button.
 * Strokes use currentColor on text-brand, so they follow the active theme.
 */
function AmaniNote() {
  return (
    <div aria-hidden="true" className="amani-note pointer-events-none absolute bottom-[3.4rem] right-[4.6rem] hidden w-[15rem] text-brand sm:block">
      <div className="relative px-5 py-4">
        <svg viewBox="0 0 240 110" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" fill="none">
          <path pathLength={1} className="draw" style={{ animationDelay: '600ms' }}
            d="M128 8C70 3 14 20 9 52c-5 34 52 52 118 50 64-2 108-22 104-54C227 16 176 5 112 12 92 14 78 18 66 24"
            stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
        <p className="menu-font relative text-center text-[1.02rem] leading-snug text-ink">
          Please talk to <span className="text-brand">Amani</span>, our receptionist. She&apos;s always available to help you.
        </p>
      </div>
      {/* Arrow from the circle down and to the right, into the phone button. */}
      <svg viewBox="0 0 70 60" className="absolute -bottom-10 -right-5 h-12 w-12" fill="none">
        <path pathLength={1} className="draw" style={{ animationDelay: '1500ms' }} d="M6 6c10 24 28 38 54 44M60 50l-14 4M60 50l-9-11"
          stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

function CallPanel() {
  const [state, setState] = useState<CallState>('idle')
  const [problem, setProblem] = useState<string | null>(null)
  const [seconds, setSeconds] = useState(0)
  const [muted, setMuted] = useState(false)
  const session = useRef<Session | null>(null)
  const stopRing = useRef<(() => void) | null>(null)
  const cancelled = useRef(false)
  useEffect(() => () => { cancelled.current = true; stopRing.current?.(); void session.current?.endSession().catch(() => undefined) }, [])

  const [cantHear, setCantHear] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const talking = state === 'listening' || state === 'speaking'
  useEffect(() => {
    if (!talking) return
    const t = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [talking])

  // Calls last at most MAX_CALL seconds (ElevenLabs also cuts them there). Amani is told when time is nearly up,
  // so she can wrap up and say goodbye herself; the page hangs up at the limit as a backup.
  const connectedAt = useRef(0)
  const [limit, setLimit] = useState(MAX_CALL)
  const extended = useRef(false)
  useEffect(() => {
    if (!talking || !session.current) return
    if (seconds === limit - 60) session.current.sendContextualUpdate?.('Time check: about one minute of this call is left. Help the caller finish, then wrap up.')
    if (seconds === limit - 15) session.current.sendContextualUpdate?.('Time is up in 15 seconds. Say the call is about to end, invite them to call again if they need more help, say goodbye and end the call now.')
    if (seconds >= limit) { setTimedOut(true); void end() }
  }, [seconds, talking, limit]) // eslint-disable-line react-hooks/exhaustive-deps

  // Microphone check: if nothing at all comes from the microphone in the first seconds, say so on screen.
  useEffect(() => {
    if (!talking) { setCantHear(false); return }
    let loudest = 0
    const t = setInterval(() => {
      loudest = Math.max(loudest, session.current?.getInputVolume?.() ?? 1)
      if (Date.now() - connectedAt.current > 9000) setCantHear(loudest < 0.01)
    }, 500)
    return () => clearInterval(t)
  }, [talking])

  async function start() {
    setProblem(null); setSeconds(0); setMuted(false); setTimedOut(false); setCantHear(false); cancelled.current = false
    setLimit(MAX_CALL); extended.current = false
    setState('ringing')
    stopRing.current = ringTone()
    try {
      // While it rings: ask for the microphone and load the voice client, then let it ring at least twice.
      const [, { Conversation }] = await Promise.all([
        navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => s.getTracks().forEach((t) => t.stop())),
        import('@elevenlabs/client'),
        wait(3600),
      ])
      if (cancelled.current) return
      stopRing.current?.(); stopRing.current = null
      session.current = await Conversation.startSession({
        agentId: AGENT_ID,
        clientTools: {
          // The student talk asks for more time when a caller is struggling: once per call.
          extend_call: async () => {
            if (extended.current) return 'This call was already extended once. Do not extend again.'
            extended.current = true
            setLimit((l) => l + EXTRA)
            return 'Five more minutes added.'
          },
        },
        onConnect: () => { connectedAt.current = Date.now(); setState('speaking') }, // Amani answers with the greeting
        onDisconnect: () => { session.current = null; setState('ended') },
        onError: () => { setProblem('The call dropped. Try again, or ask us to call you.'); setState('idle') },
        onModeChange: ({ mode }: { mode: string }) => setState(mode === 'speaking' ? 'speaking' : 'listening'),
      }) as unknown as Session
    } catch (e) {
      stopRing.current?.(); stopRing.current = null
      const denied = e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'SecurityError')
      setProblem(denied ? 'Allow the microphone to talk to us, or ask us to call you.' : 'We could not start the call. Ask us to call you instead.')
      setState('idle')
    }
  }
  async function end() {
    cancelled.current = true
    stopRing.current?.(); stopRing.current = null
    await session.current?.endSession().catch(() => undefined)
    session.current = null; setState('ended')
  }
  function toggleMute() {
    const next = !muted
    session.current?.setMicMuted?.(next)
    setMuted(next)
  }

  const live = state === 'ringing' || talking
  const { data: settings } = useSettings()
  const wa = whatsappLink('Hi Campus Food', settings.whatsappNumber ?? undefined)
  return (
    <div className="flex flex-col gap-4">
      {AGENT_ID ? (
        <div className="flex flex-col gap-2">
          {live ? (
            <>
              <div className="flex items-center gap-3">
                <span className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand text-white ${state === 'ringing' ? 'ring-shake' : ''}`}>
                  {state === 'speaking' ? <span className="absolute inset-0 animate-ping rounded-full bg-brand/40" aria-hidden="true" /> : null}
                  <PhoneIcon />
                </span>
                <div className="min-w-0">
                  <p className="font-bold">Amani · Campus Food</p>
                  <p className="text-xs text-muted" aria-live="polite">{STATE_WORDS[state]}{talking ? ` · ${clock(Math.max(limit - seconds, 0))} left` : ''}</p>
                </div>
              </div>
              {talking && seconds >= limit - 60 ? <p className="text-xs font-bold text-brand">Less than a minute left on this call.</p> : null}
              {cantHear && !muted ? <p className="text-xs font-bold text-danger">We can't hear you. Check that your microphone is on and allowed for this site.</p> : null}
              <div className="flex gap-2">
                {talking ? <button type="button" className="btn btn-ghost flex-1 py-2" onClick={toggleMute} aria-pressed={muted}>{muted ? 'Unmute' : 'Mute'}</button> : null}
                <button type="button" className="btn flex-1 !bg-danger py-2" onClick={end}>{state === 'ringing' ? 'Cancel' : 'End call'}</button>
              </div>
            </>
          ) : (
            <>
              <button type="button" className="btn w-full py-2" onClick={start}>{state === 'ended' ? 'Call again' : 'Call now'}</button>
              {state === 'ended'
                ? <p className="text-[0.7rem] text-muted">{timedOut ? 'Calls last up to 4 minutes. Call again if you need more help.' : STATE_WORDS.ended}</p>
                : <p className="text-[0.7rem] text-muted">Switch on your microphone first. Calls last up to 4 minutes.</p>}
            </>
          )}
          {problem ? <p className="text-xs font-bold text-danger">{problem}</p> : null}
        </div>
      ) : null}
      <CallbackForm />
      {wa ? <a className="link text-xs font-bold" href={wa} target="_blank" rel="noreferrer">Or message us on WhatsApp</a> : null}
    </div>
  )
}

function CallbackForm() {
  const [phone, setPhone] = useState('')
  const [topic, setTopic] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  async function submit(e: FormEvent) {
    e.preventDefault()
    const parsed = callbackSchema.safeParse({ phone, topic })
    if (!parsed.success) { setMsg({ ok: false, text: parsed.error.issues[0]?.message ?? 'Check the form.' }); return }
    setBusy(true); setMsg(null)
    try {
      const res = await rpc<{ message: string }>('requestCallback', { pName: '', pPhone: parsed.data.phone, pTopic: parsed.data.topic })
      setMsg({ ok: true, text: res.message }); setPhone(''); setTopic('')
    } catch (err) {
      setMsg({ ok: false, text: friendly(err) })
    } finally { setBusy(false) }
  }
  if (msg?.ok) return <p className="font-bold" aria-live="polite">{msg.text}</p>
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-2">
      <p className="text-xs font-bold">{AGENT_ID ? 'Or we call you' : 'We call you back'}</p>
      <input className="field !py-1.5 !text-sm" type="tel" inputMode="tel" autoComplete="tel" placeholder="Your phone, e.g. 0712 345 678"
        value={phone} onChange={(e) => setPhone(e.target.value)} aria-label="Your phone number" />
      <input className="field !py-1.5 !text-sm" placeholder="What is it about?" maxLength={200}
        value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="What is it about?" />
      {msg ? <p className="text-xs font-bold text-danger">{msg.text}</p> : null}
      <button type="submit" className={`btn w-full py-2 ${AGENT_ID ? 'btn-ghost' : ''}`} disabled={busy}>{busy ? 'Sending…' : 'Call me back'}</button>
    </form>
  )
}
