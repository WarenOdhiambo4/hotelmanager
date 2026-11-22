// Small data hooks shared by pages. Public data (menu, hotels, settings, videos, offers) loads
// without signing in, and the menu stays live through Supabase Realtime.
import { useCallback, useEffect, useRef, useState } from 'react'
import { friendly, supabase } from './supabase'
import type { DeliveryZone, MenuCategory, MenuItem, Offer, PlatformSettings, SiteVideo, Testimonial, Vendor } from './types'

export type Loadable<T> = { data: T; loading: boolean; error: string | null; reload: () => void }

/** Runs an async loader on mount and whenever deps change; keeps the last good data on reload. */
export function useLoad<T>(loader: () => Promise<T>, initial: T, deps: unknown[] = []): Loadable<T> {
  const [data, setData] = useState<T>(initial)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const ref = useRef(loader)
  ref.current = loader
  useEffect(() => {
    let alive = true
    setLoading(true)
    ref.current()
      .then((d) => { if (alive) { setData(d); setError(null) } })
      .catch((e) => { if (alive) setError(friendly(e)) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps])
  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, loading, error, reload }
}

const PUBLIC_VENDOR_COLUMNS = 'id,name,slug,description,location,logoPath,coverPath,openingHours,prepMinutes,isOpen,isActive'

export type PublicMenu = { vendors: Vendor[]; items: MenuItem[]; categories: MenuCategory[] }

async function loadMenu(): Promise<PublicMenu> {
  if (!supabase) return { vendors: [], items: [], categories: [] }
  const [v, i, c] = await Promise.all([
    supabase.from('vendors').select(PUBLIC_VENDOR_COLUMNS).eq('isActive', true).order('name'),
    supabase.from('menuItems').select('*').eq('isAvailable', true).order('sortOrder').order('name'),
    supabase.from('menuCategories').select('*').order('sortOrder').order('name'),
  ])
  if (v.error) throw v.error
  if (i.error) throw i.error
  const vendors = (v.data ?? []) as Vendor[]
  const live = new Set(vendors.map((x) => x.id))
  return {
    vendors,
    items: ((i.data ?? []) as MenuItem[]).filter((x) => live.has(x.vendorId)).map((x) => ({ ...x, price: Number(x.price), previousPrice: x.previousPrice === null ? null : Number(x.previousPrice) })),
    categories: (c.data ?? []) as MenuCategory[],
  }
}

/** The live public menu: reloads when any menu item changes (prices, availability, new dishes). */
export function usePublicMenu(): Loadable<PublicMenu> {
  const state = useLoad(loadMenu, { vendors: [], items: [], categories: [] })
  const { reload } = state
  useEffect(() => {
    if (!supabase) return
    let timer: ReturnType<typeof setTimeout> | undefined
    // Each subscriber needs its own channel name (the header, hero and footer all watch the menu).
    const channel = supabase.channel(`publicMenu-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menuItems' }, () => { clearTimeout(timer); timer = setTimeout(reload, 400) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendors' }, () => { clearTimeout(timer); timer = setTimeout(reload, 400) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menuCategories' }, () => { clearTimeout(timer); timer = setTimeout(reload, 400) })
      .subscribe()
    return () => { clearTimeout(timer); void supabase?.removeChannel(channel) }
  }, [reload])
  return state
}

export const DEFAULT_SETTINGS: PlatformSettings = {
  platformName: 'Campus Food',
  platformFee: 20,
  refundWindowMinutes: 5,
  draftLifetimeMinutes: 120,
  serviceHours: 'Daily service · 7:00 AM – 11:00 PM',
  supportPhone: null,
  supportEmail: null,
  whatsappNumber: null,
  feePaybill: null,
  feeAccountName: null,
  heroTagline: 'Verified kitchens. Transparent pricing. Direct M-PESA settlement. Dependable delivery.',
}

export function useSettings(): Loadable<PlatformSettings> {
  return useLoad(async () => {
    if (!supabase) return DEFAULT_SETTINGS
    const { data, error } = await supabase.from('platformSettings').select('*').maybeSingle()
    if (error) throw error
    return data ? ({ ...DEFAULT_SETTINGS, ...data, platformFee: Number(data.platformFee) } as PlatformSettings) : DEFAULT_SETTINGS
  }, DEFAULT_SETTINGS)
}

export function useZones(): Loadable<DeliveryZone[]> {
  return useLoad(async () => {
    if (!supabase) return []
    const { data, error } = await supabase.from('deliveryZones').select('*').eq('isActive', true).order('sortOrder').order('name')
    if (error) throw error
    return ((data ?? []) as DeliveryZone[]).map((z) => ({ ...z, fee: Number(z.fee) }))
  }, [])
}

export function useVideos(): Loadable<SiteVideo[]> {
  return useLoad(async () => {
    if (!supabase) return []
    const { data, error } = await supabase.from('siteVideos').select('*').eq('isPublished', true).order('sortOrder')
    if (error) throw error
    return (data ?? []) as SiteVideo[]
  }, [])
}

export function useOffers(): Loadable<Offer[]> {
  return useLoad(async () => {
    if (!supabase) return []
    const from = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    const { data, error } = await supabase.from('offers').select('*').eq('isPublished', true).gte('eventDate', from).order('eventDate').limit(4)
    if (error) throw error
    return (data ?? []) as Offer[]
  }, [])
}

export function useTestimonials(): Loadable<Testimonial[]> {
  return useLoad(async () => {
    if (!supabase) return []
    const { data, error } = await supabase.rpc('getTestimonials', { pLimit: 8 })
    if (error) throw error
    return (data ?? []) as Testimonial[]
  }, [])
}

export type SiteImage = { id: string; imagePath: string; caption: string | null; placement: string; sortOrder: number; isPublished: boolean }

/** Photos an administrator uploaded for the public pages (Storage: media/site/...). */
export function useSiteImages(): Loadable<SiteImage[]> {
  return useLoad(async () => {
    if (!supabase) return []
    const { data, error } = await supabase.from('siteImages').select('*').eq('isPublished', true).order('sortOrder')
    if (error) throw error
    return (data ?? []) as SiteImage[]
  }, [])
}
