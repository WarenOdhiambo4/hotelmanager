import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PlateDrawing } from '../../components/Drawings'
import { DishShelf, DishTile } from '../../components/DishShelf'
import { HeaderActions } from '../../components/HeaderBar'
import { useCart } from '../../lib/cart'
import { usePublicMenu } from '../../lib/data'
import { setTitle } from '../../lib/site'
import type { MenuItem } from '../../lib/types'

/**
 * The live menu: dishes laid flat on the page, no title block and no list of hotels.
 * The navbar drives it: the Menu popover sets ?hotel=, the search sets ?q=, a dish link sets ?dish=.
 */
export function Menu() {
  const { data: menu, loading, error } = usePublicMenu()
  const { add, cart } = useCart()
  const [params] = useSearchParams()
  const [added, setAdded] = useState<string | null>(null)
  const hotel = params.get('hotel') ?? ''
  const dish = params.get('dish')
  const q = (params.get('q') ?? '').trim().toLowerCase()
  const cat = (params.get('cat') ?? '').trim().toLowerCase()
  useEffect(() => setTitle('Menu'), [])

  useEffect(() => {
    if (!dish || loading) return
    document.getElementById(`dish-${dish}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [dish, loading])

  const vendorOf = useMemo(() => new Map(menu.vendors.map((v) => [v.id, v])), [menu.vendors])
  const catOf = useMemo(() => new Map(menu.categories.map((c) => [c.id, c])), [menu.categories])
  const dishes = useMemo(() => menu.items
    .filter((i) => {
      const v = vendorOf.get(i.vendorId)
      if (!v || (hotel && v.slug !== hotel)) return false
      if (cat && (catOf.get(i.categoryId ?? '')?.name ?? '').trim().toLowerCase() !== cat) return false
      if (!q) return true
      return [i.name, i.description ?? '', v.name, catOf.get(i.categoryId ?? '')?.name ?? ''].some((t) => t.toLowerCase().includes(q))
    })
    .sort((a, b) => Number(b.isSignature) - Number(a.isSignature) || a.vendorId.localeCompare(b.vendorId) || a.sortOrder - b.sortOrder),
  [menu.items, vendorOf, catOf, hotel, q, cat])

  // Shelves: signature plates first, then one per category name across hotels, then the rest.
  const shelves = useMemo(() => {
    const sig = dishes.filter((d) => d.isSignature)
    const rest = dishes.filter((d) => !d.isSignature)
    const byCat = new Map<string, MenuItem[]>()
    for (const d of rest) {
      const name = catOf.get(d.categoryId ?? '')?.name?.trim() || 'More plates'
      byCat.set(name, [...(byCat.get(name) ?? []), d])
    }
    return [
      ...(sig.length ? [{ title: 'Signature plates', items: sig }] : []),
      ...[...byCat.entries()].sort(([x], [y]) => (x === 'More plates' ? 1 : y === 'More plates' ? -1 : x.localeCompare(y))).map(([title, items]) => ({ title, items })),
    ]
  }, [dishes, catOf])

  const order = (it: MenuItem, vendorName: string) => {
    add(it, vendorName)
    setAdded(it.id)
    setTimeout(() => setAdded((x) => (x === it.id ? null : x)), 1600)
  }
  const chosen = hotel ? menu.vendors.find((v) => v.slug === hotel) : undefined

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 text-sm sm:px-6">
      <h1 className="sr-only">Menu</h1>
      {chosen || q || cat ? (
        <HeaderActions>
        <p className="self-center text-xs text-muted">
          {chosen ? <>Showing <strong className="text-ink">{chosen.name}</strong>{chosen.isOpen ? '' : ' (closed now)'}</> : null}
          {cat ? <>{chosen ? ' · ' : null}Category <strong className="text-ink">{params.get('cat')}</strong></> : null}
          {(chosen || cat) && q ? ' · ' : null}
          {q ? <>matching <strong className="text-ink">“{params.get('q')}”</strong></> : null}
          {' · '}<Link to="/menu" className="link font-bold">show every dish</Link>
        </p>
        </HeaderActions>
      ) : null}
      {error ? <p className="mt-4 text-danger">{error}</p> : null}
      {loading && !menu.items.length ? <p className="mt-10 text-muted">Loading the live menu…</p> : null}
      {!loading && dishes.length === 0 ? (
        <div className="mt-14 flex flex-col items-center text-center">
          <PlateDrawing className="h-28 w-28 text-ink" />
          <p className="mt-3 max-w-sm text-muted">{q ? 'Nothing matches that search.' : 'No dishes are live yet. Kitchens appear here the moment they open.'}</p>
        </div>
      ) : null}

      {shelves.map((shelf) => (
        <DishShelf key={shelf.title} title={shelf.title}>
          {shelf.items.map((it) => {
            const v = vendorOf.get(it.vendorId)!
            const inCart = cart.lines.find((l) => l.menuItemId === it.id)?.quantity ?? 0
            return (
              <DishTile key={it.id} id={`dish-${it.id}`} item={it} highlight={dish === it.id}
                meta={<><Link to={`/menu?hotel=${v.slug}`} className="hover:text-brand">{v.name}</Link>{v.isOpen ? '' : ' · closed now'}</>}
                actions={<button type="button" disabled={!v.isOpen} onClick={() => order(it, v.name)} className="btn">
                  {added === it.id ? 'Added' : inCart ? `Add another (${inCart})` : 'Add to cart'}
                </button>} />
            )
          })}
        </DishShelf>
      ))}

    </div>
  )
}
