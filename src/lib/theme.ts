// Themes (the COMPLIANCE365 approach): one attribute on <html> swaps every colour token.
// The choice is remembered on this device and, when signed in, on the profile.
import { useCallback, useEffect, useState } from 'react'

export const THEMES = [
  { id: 'sunrise', label: 'Midnight', note: 'Navy and antique gold', swatch: ['#1f3b5c', '#c29b40', '#f6f3ec'] },
  { id: 'garden', label: 'Emerald', note: 'Deep emerald and gold', swatch: ['#0f5c4d', '#c29b40', '#eef4f1'] },
  { id: 'berry', label: 'Berry', note: 'Bold tomato red (default)', swatch: ['#d7263d', '#ffb627', '#fff8f7'] },
  { id: 'ocean', label: 'Ocean', note: 'Cool lakeside blue', swatch: ['#0b7a99', '#f7b538', '#f6fbfd'] },
  { id: 'night', label: 'Night', note: 'Dark, for late study sessions', swatch: ['#ff8a3d', '#f5c33b', '#15120f'] },
] as const

export type ThemeId = (typeof THEMES)[number]['id']
const KEY = 'campusFoodTheme'
const EVENT = 'campusFood:theme'

export function currentTheme(): ThemeId {
  const t = document.documentElement.dataset.theme
  return (THEMES.some((x) => x.id === t) ? t : 'berry') as ThemeId
}

export function applyTheme(id: string | undefined | null) {
  const theme = THEMES.some((x) => x.id === id) ? (id as ThemeId) : 'berry'
  document.documentElement.dataset.theme = theme
  try { localStorage.setItem(KEY, theme) } catch { /* private mode: still applied for this visit */ }
  window.dispatchEvent(new Event(EVENT))
}

export function useTheme(): [ThemeId, (id: ThemeId) => void] {
  const [theme, setTheme] = useState<ThemeId>(currentTheme)
  useEffect(() => {
    const on = () => setTheme(currentTheme())
    window.addEventListener(EVENT, on)
    return () => window.removeEventListener(EVENT, on)
  }, [])
  const change = useCallback((id: ThemeId) => applyTheme(id), [])
  return [theme, change]
}
