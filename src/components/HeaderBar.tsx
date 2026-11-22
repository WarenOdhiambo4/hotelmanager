import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon } from './Icons'

/**
 * Page controls live in the header, never in the page body. Each page puts its buttons, search,
 * filters and dates into <HeaderActions>; they render in a thin bar under the navbar. Forms for
 * adding things open in a <Sheet> that slides in from the side.
 */
const SlotContext = createContext<HTMLElement | null>(null)

export function HeaderSlotProvider({ children }: { children: ReactNode }) {
  const [node, setNode] = useState<HTMLElement | null>(null)
  return (
    <SlotContext.Provider value={node}>
      <SetSlot.Provider value={setNode}>{children}</SetSlot.Provider>
    </SlotContext.Provider>
  )
}
const SetSlot = createContext<(n: HTMLElement | null) => void>(() => undefined)

/** Placed once inside each header. Hidden when no page has put anything in it. */
export function HeaderSlot() {
  const set = useContext(SetSlot)
  return <div ref={set} className="header-slot mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-3 gap-y-1.5 border-t glass-line px-4 py-1.5 text-xs empty:hidden sm:px-6" />
}

export function HeaderActions({ children }: { children: ReactNode }) {
  const node = useContext(SlotContext)
  return node ? createPortal(children, node) : null
}

/** Side sheet for add/edit forms (flat, no shadow). */
export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', key)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = '' }
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[80] flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-ink/20" onClick={onClose} />
      <div className="drop-in relative h-full w-full max-w-xl overflow-y-auto border-l glass-line bg-canvas px-5 pb-10 pt-4 text-sm sm:px-8">
        <div className="sticky top-0 z-10 -mx-5 mb-6 flex items-center justify-between bg-canvas px-5 py-3 sm:-mx-8 sm:px-8">
          <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.16em] text-brand">{title}</p>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full hover:text-brand"><CloseIcon /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
