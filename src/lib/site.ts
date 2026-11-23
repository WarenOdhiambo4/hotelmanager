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

/** The home page title and the description used wherever a page gives none (also in index.html for crawlers). */
export const HOME_TITLE = 'Campus Food · Order from Verified Kisii University Hotels, Pay by M-PESA, Delivered to Your Hostel'
export const DEFAULT_DESCRIPTION =
  'Order from verified Kisii University hotels at their own menu prices. You pay the hotel directly by M-PESA, every order is tracked and receipted, and we deliver to your hostel.'

/** Pages Google may index. Everything else (receipts, cart, account, orders, sign-in, hotel and rider pages) is noindex. */
const PUBLIC_PAGE = /^\/(?:|menu|deals(?:\/[^/]+)?|about|contact|privacy|terms)\/?$/

function meta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el) }
  el.content = content
}

/** Sets the tab title plus the search and social metadata for the current page. */
export function setTitle(title?: string, description = DEFAULT_DESCRIPTION) {
  const full = title ? `${title} · ${SITE.name}` : HOME_TITLE
  document.title = full
  if (typeof window === 'undefined') return
  const path = window.location.pathname
  const url = `${SITE.url || window.location.origin}${path === '/' ? '/' : path.replace(/\/$/, '')}`
  meta('name', 'description', description)
  meta('name', 'robots', PUBLIC_PAGE.test(path) ? 'index, follow, max-image-preview:large' : 'noindex, nofollow')
  meta('property', 'og:title', full)
  meta('property', 'og:description', description)
  meta('property', 'og:url', url)
  meta('name', 'twitter:title', full)
  meta('name', 'twitter:description', description)
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical) }
  canonical.href = url
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
