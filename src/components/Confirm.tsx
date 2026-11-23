import { useEffect, useState } from 'react'

/**
 * In-page "are you sure?" box in the site's own style, instead of the browser's confirm() pop-up.
 * Call askConfirm() anywhere; <ConfirmHost /> (mounted once in App) shows the question.
 */
type Ask = { message: string; yes: string; no: string; danger: boolean; resolve: (ok: boolean) => void }
let show: ((a: Ask) => void) | null = null

export function askConfirm(message: string, opts: { yes?: string; no?: string; danger?: boolean } = {}): Promise<boolean> {
  return new Promise((resolve) => {
    if (!show) { resolve(false); return }
    show({ message, yes: opts.yes ?? 'Yes', no: opts.no ?? 'Keep it', danger: opts.danger ?? false, resolve })
  })
}

export function ConfirmHost() {
  const [ask, setAsk] = useState<Ask | null>(null)
  useEffect(() => { show = setAsk; return () => { show = null } }, [])
  const answer = (ok: boolean) => { ask?.resolve(ok); setAsk(null) }
  useEffect(() => {
    if (!ask) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { ask.resolve(false); setAsk(null) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ask])
  if (!ask) return null
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-ink/25 p-4 backdrop-blur-[2px] sm:items-center" onClick={() => answer(false)}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-text" onClick={(e) => e.stopPropagation()}
        className="drop-in menu-font w-full max-w-sm rounded-2xl bg-canvas p-5 shadow-xl">
        <p id="confirm-text" className="text-base leading-snug text-ink">{ask.message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" autoFocus onClick={() => answer(false)} className="btn btn-ghost !px-3 !py-1.5 !text-xs">{ask.no}</button>
          <button type="button" onClick={() => answer(true)} className={`btn !px-3 !py-1.5 !text-xs ${ask.danger ? '!bg-danger' : ''}`}>{ask.yes}</button>
        </div>
      </div>
    </div>
  )
}
