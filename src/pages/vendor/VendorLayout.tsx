import { createContext, useContext, useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth, type Membership } from '../../auth/AuthProvider'
import { db } from '../../lib/supabase'
import type { Vendor } from '../../lib/types'
import { useVendorChoice } from '../../lib/vendorChoice'
import { RailIcons, SideRail, type RailItem } from '../../components/SideRail'

type VendorCtx = { vendor: Vendor | null; membership: Membership | null; reloadVendor: () => void; isManager: boolean }
const Ctx = createContext<VendorCtx>({ vendor: null, membership: null, reloadVendor: () => undefined, isManager: false })
export const useVendor = () => useContext(Ctx)

/**
 * Hotel workspace. No heading, tab row or panel in the body: pages are chosen (and the hotel
 * switched) from the avatar dropdown in the navbar, which also shows the hotel's live status.
 */
export function VendorLayout() {
  const { memberships } = useAuth()
  const [vendorId, setVendorId] = useVendorChoice()
  const membership = memberships.find((m) => m.vendorId === vendorId) ?? memberships[0] ?? null
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!membership) return
    if (membership.vendorId !== vendorId) setVendorId(membership.vendorId)
    db().from('vendors').select('*').eq('id', membership.vendorId).maybeSingle().then(({ data }) => setVendor(data as Vendor | null))
  }, [membership, vendorId, setVendorId, tick])

  const manager = membership?.memberRole === 'manager'
  const items: RailItem[] = [
    { to: '/hotel', label: 'Dashboard', icon: RailIcons.home, end: true },
    { to: '/hotel/orders', label: 'Live orders', icon: RailIcons.orders },
    { to: '/hotel/menu', label: 'Dishes', icon: RailIcons.dishes },
    { to: '/hotel/reports', label: 'Sales', icon: RailIcons.sales },
    ...(manager ? [
      { to: '/hotel/settings', label: 'M-Pesa', icon: RailIcons.mpesa },
      { to: '/hotel/staff', label: 'Staff', icon: RailIcons.staff },
      { to: '/hotel/offers', label: 'Offers', icon: RailIcons.offers },
    ] : []),
  ]
  return (
    <Ctx.Provider value={{ vendor, membership, reloadVendor: () => setTick((t) => t + 1), isManager: manager }}>
      <SideRail items={items} label={`${vendor?.name ?? 'Hotel'} pages`} />
      <div className="lg:pl-[5.5rem]">
        <div className="mx-auto max-w-7xl px-4 pb-16 pt-2 text-sm sm:px-6">
          <h1 className="sr-only">{vendor?.name ?? 'Your hotel'}</h1>
          {vendor ? <Outlet /> : <p className="py-8 text-muted">Loading your hotel…</p>}
        </div>
      </div>
    </Ctx.Provider>
  )
}
