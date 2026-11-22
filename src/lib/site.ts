// Public site details and per-page titles.

declare const __SURFACE__: 'site' | 'admin'
export const SURFACE: 'site' | 'admin' = typeof __SURFACE__ === 'undefined' ? 'site' : __SURFACE__

const clean = (v: unknown) => String(v ?? '').trim().replace(/\/$/, '')

export const SITE = {
  name: 'Campus Food',
  url: clean(import.meta.env.VITE_SITE_URL) || (typeof window !== 'undefined' ? window.location.origin : ''),
  adminUrl: clean(import.meta.env.VITE_ADMIN_URL),
  whatsappNumber: String(import.meta.env.VITE_WHATSAPP_NUMBER ?? '').replace(/\D/g, ''),
}

export function setTitle(title?: string) {
  document.title = title ? `${title} · ${SITE.name}` : `${SITE.name} · Hotel prices, M-Pesa checkout, delivered to your block`
}

/** WhatsApp link with a prefilled message (opening it never confirms an order or payment). */
export function whatsappLink(text: string, number = SITE.whatsappNumber): string | null {
  const n = number.replace(/\D/g, '')
  if (!/^\d{10,15}$/.test(n)) return null
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`
}

/** YouTube video id from watch, short, embed or youtu.be links; null for anything else. */
export function youtubeId(url: string): string | null {
  const m = url.match(/^https:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,20})/)
  return m ? m[1]! : null
}
