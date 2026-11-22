import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { PublicMenu } from '../lib/data'
import { FoodImage } from './FoodImage'

/**
 * Live order pop-ups for the home hero. Real orders from the last few hours (public.liveOrderFeed:
 * dish, photo, delivery area and stage only) pop up one at a time around the hero photo: the hostel
 * on top, the dish under it, then the stage ("Cooking", "Ready", "Delivered") before it fades away.
 * Tiny on phones, small on computers, and purely decorative (hidden from screen readers).
 */
type Stage = 'ordered' | 'preparing' | 'ready' | 'onTheWay' | 'delivered'
type FeedRow = { key: string; itemName: string; imagePath: string | null; place: string; stage: Stage; at: string }
type Pop = FeedRow & { spot: number; uid: number }

const STAGE: Record<Stage, string> = {
  ordered: 'Just ordered', preparing: 'Cooking', ready: 'Ready', onTheWay: 'On the way', delivered: 'Delivered ✓',
}

// Places around the hero photo (as % of the hero). Phones use the photo's edges; computers the side gutters.
// The left side stays below the turned phone that big screens show in the top-left corner.
const SPOTS = [
  'left-[5%] top-[31%] lg:left-[7%] lg:top-[54%]',
  'right-[5%] top-[38%] lg:right-[7%] lg:top-[46%]',
  'left-[6%] top-[50%] lg:left-[11%] lg:top-[74%]',
  'right-[6%] top-[57%] lg:right-[10%] lg:top-[68%]',
  'left-[38%] top-[61%] lg:left-[4%] lg:top-[88%]',
  'right-[36%] top-[29%] lg:right-[4%] lg:top-[86%]',
]

const LIFE = 6500 // ms one pop stays on screen (matches .live-pop in index.css)
const GAP = 3200 // ms between pops
const POLL = 20000 // ms between feed refreshes

async function fetchFeed(): Promise<FeedRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('liveOrderFeed', { pLimit: 12 })
  if (error) return []
  return (data ?? []) as FeedRow[]
}

/** Development preview without real orders: open the site with ?liveDemo. Never in production builds. */
function demoFeed(menu: PublicMenu): FeedRow[] {
  const places = ['Hostel A', 'Hostel B', 'Main Gate', 'Library Block', 'Nyamage', 'Mwembe']
  const stages: Stage[] = ['ordered', 'preparing', 'ready', 'onTheWay', 'delivered']
  return menu.items.slice(0, 10).map((i, n) => ({
    key: `demo-${i.id}`, itemName: i.name, imagePath: i.imagePath, place: places[n % places.length]!,
    stage: stages[n % stages.length]!, at: new Date().toISOString(),
  }))
}

export function LiveOrders({ menu }: { menu: PublicMenu }) {
  const [pops, setPops] = useState<Pop[]>([])
  const feed = useRef<FeedRow[]>([])
  const queue = useRef<FeedRow[]>([])
  const seen = useRef(new Set<string>())
  const uid = useRef(0)
  const spot = useRef(0)
  const demo = import.meta.env.DEV && typeof location !== 'undefined' && location.search.includes('liveDemo')

  // Keep the feed fresh: new events (a new order or a new stage) jump the queue.
  useEffect(() => {
    let alive = true
    const load = async () => {
      if (typeof document !== 'undefined' && document.hidden) return
      const rows = demo ? demoFeed(menu) : await fetchFeed()
      if (!alive) return
      feed.current = rows
      const fresh = rows.filter((r) => !seen.current.has(r.key))
      fresh.forEach((r) => seen.current.add(r.key))
      queue.current = [...fresh.reverse(), ...queue.current].slice(0, 20)
    }
    void load()
    const t = setInterval(load, POLL)
    return () => { alive = false; clearInterval(t) }
  }, [demo, menu])

  // Show one pop at a time; when nothing new has come in, replay the recent ones so the hero stays alive.
  useEffect(() => {
    const t = setInterval(() => {
      if (!queue.current.length && feed.current.length) queue.current = [...feed.current].reverse()
      const next = queue.current.shift()
      if (!next) return
      const pop: Pop = { ...next, spot: spot.current++ % SPOTS.length, uid: uid.current++ }
      setPops((p) => [...p.slice(-2), pop])
      setTimeout(() => setPops((p) => p.filter((x) => x.uid !== pop.uid)), LIFE)
    }, GAP)
    return () => clearInterval(t)
  }, [])

  if (!pops.length) return null
  return (
    <div className="pointer-events-none absolute inset-0 z-10" aria-hidden="true">
      {pops.map((p) => (
        <div key={p.uid} className={`live-pop absolute flex w-16 flex-col items-center text-center sm:w-24 ${SPOTS[p.spot]}`}>
          <span className="max-w-full truncate rounded-full bg-ink px-1.5 py-px text-[8px] font-extrabold leading-tight text-canvas shadow sm:px-2 sm:text-[10px]">
            {p.place}
          </span>
          <FoodImage path={p.imagePath} name={p.itemName} width={120} shape="circle"
            className="mt-0.5 h-7 w-7 border-2 border-canvas shadow-md sm:mt-1 sm:h-11 sm:w-11 sm:border-[3px]" />
          <span className="live-stage mt-0.5 rounded-full bg-brand px-1.5 py-px text-[8px] font-bold leading-tight text-white shadow sm:mt-1 sm:px-2 sm:text-[10px]">
            {STAGE[p.stage] ?? 'Ordered'}
          </span>
        </div>
      ))}
    </div>
  )
}
