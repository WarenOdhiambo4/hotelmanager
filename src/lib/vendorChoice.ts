// Which hotel a staff member is working in, shared by the navbar dropdown and the hotel pages.
import { useEffect, useState } from 'react'

const KEY = 'campusFoodVendor'
const EVENT = 'campusFood:vendor'

export function readVendorChoice(): string {
  try { return localStorage.getItem(KEY) ?? '' } catch { return '' }
}

export function setVendorChoice(id: string) {
  try { localStorage.setItem(KEY, id) } catch { /* storage blocked: still switch for this visit */ }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: id }))
}

export function useVendorChoice(): [string, (id: string) => void] {
  const [id, setId] = useState(readVendorChoice)
  useEffect(() => {
    const on = (e: Event) => setId((e as CustomEvent<string>).detail)
    window.addEventListener(EVENT, on)
    return () => window.removeEventListener(EVENT, on)
  }, [])
  return [id, setVendorChoice]
}
