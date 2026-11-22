import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { usePublicMenu } from '../lib/data'
import { kes } from '../lib/format'
import { FoodImage } from './FoodImage'
import { CloseIcon, SearchIcon } from './Icons'

/*
 * The home page's quick way to food, in the manner of a marketplace front page: a Category button that
 * opens every food category, one search field that suggests dishes, hotels and categories as you type,
 * and a row of category photos. Everything comes from the live menu.
 */

type Category = { key: string; name: string; count: number; photo: string | null; sample: string }
type Hit =
  | { kind: 'dish'; id: string; label: string; sub: string; photo: string | null; to: string }
  | { kind: 'hotel'; id: string; label: string; sub: string; photo: string | null; to: string }
  | { kind: 'category'; id: string; label: string; sub: string; photo: string | null; to: string }

const catLink = (name: string) => `/menu?cat=${encodeURIComponent(name)}`

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
    </svg>
  )
}

export function HomeFinder() {
  const { data: menu } = usePublicMenu()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [catsOpen, setCatsOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const box = useRef<HTMLDivElement>(null)
  const catBox = useRef<HTMLDivElement>(null)

  const vendorOf = useMemo(() => new Map(menu.vendors.map((v) => [v.id, v])), [menu.vendors])

  // One entry per category name across hotels ("Drinks" at two hotels is one category), largest first.
  const categories: Category[] = useMemo(() => {
    const catName = new Map(menu.categories.map((c) => [c.id, c.name.trim()]))
    const by = new Map<string, Category>()
    for (const it of menu.items) {
      const name = catName.get(it.categoryId ?? '')
      if (!name) continue
      const key = name.toLowerCase()
      const c = by.get(key) ?? { key, name, count: 0, photo: null, sample: it.name }
      c.count += 1
      if (!c.photo && it.imagePath) { c.photo = it.imagePath; c.sample = it.name }
      by.set(key, c)
    }
    return [...by.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  }, [menu.categories, menu.items])

  const hits: Hit[] = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return []
    const has = (s: string | null | undefined) => (s ?? '').toLowerCase().includes(t)
    const cats = categories.filter((c) => has(c.name)).slice(0, 3)
      .map<Hit>((c) => ({ kind: 'category', id: c.key, label: c.name, sub: `${c.count} dish${c.count === 1 ? '' : 'es'}`, photo: c.photo, to: catLink(c.name) }))
    const hotels = menu.vendors.filter((v) => has(v.name) || has(v.location)).slice(0, 3)
      .map<Hit>((v) => ({ kind: 'hotel', id: v.id, label: v.name, sub: v.location ?? 'Hotel', photo: v.logoPath ?? null, to: `/menu?hotel=${v.slug}` }))
    const dishes = menu.items.filter((i) => has(i.name) || has(i.description) || has(vendorOf.get(i.vendorId)?.name)).slice(0, 6)
      .map<Hit>((i) => ({ kind: 'dish', id: i.id, label: i.name, sub: `${kes(i.price)} · ${vendorOf.get(i.vendorId)?.name ?? ''}`, photo: i.imagePath, to: `/menu?dish=${i.id}` }))
    return [...dishes, ...cats, ...hotels]
  }, [q, categories, menu.vendors, menu.items, vendorOf])

  useEffect(() => setActive(-1), [q])
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
      if (catBox.current && !catBox.current.contains(e.target as Node)) setCatsOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const go = (to: string) => { setOpen(false); setCatsOpen(false); navigate(to) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (active >= 0 && hits[active]) return go(hits[active]!.to)
    go(q.trim() ? `/menu?q=${encodeURIComponent(q.trim())}` : '/menu')
  }
  const keys = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(hits.length - 1, a + 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(-1, a - 1)) }
    if (e.key === 'Escape') { setOpen(false); setActive(-1) }
  }
  const kindLabel = { dish: 'Dish', hotel: 'Hotel', category: 'Category' } as const

  return (
    <section aria-label="Find food" className="relative z-20 px-4 pt-5 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-stretch gap-2 sm:gap-3">
          {/* Category menu */}
          <div ref={catBox} className="relative shrink-0">
            <button type="button" onClick={() => { setCatsOpen(!catsOpen); setOpen(false) }} aria-expanded={catsOpen} aria-haspopup="true"
              className="flex h-12 items-center gap-2 rounded-[0.7rem] bg-brand px-3.5 text-sm font-extrabold text-white transition-colors hover:bg-brand-strong sm:px-5">
              <ListIcon /><span className="hidden sm:inline">Category</span>
              <svg viewBox="0 0 12 12" className={`h-2.5 w-2.5 transition-transform ${catsOpen ? 'rotate-180' : ''}`} aria-hidden="true"><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            {catsOpen ? (
              <div role="menu" className="drop-in absolute left-0 top-[3.4rem] z-30 max-h-[70vh] w-72 overflow-y-auto rounded-[1rem] border glass-line bg-canvas py-2">
                <Link role="menuitem" to="/menu" onClick={() => setCatsOpen(false)} className="flex items-center gap-3 px-3 py-2 text-sm font-extrabold hover:bg-ink/5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/10 text-brand"><ListIcon /></span>All food
                  <span className="ml-auto text-xs font-semibold text-muted">{menu.items.length}</span>
                </Link>
                {categories.map((c) => (
                  <Link key={c.key} role="menuitem" to={catLink(c.name)} onClick={() => setCatsOpen(false)} className="flex items-center gap-3 px-3 py-2 text-sm font-bold hover:bg-ink/5">
                    <FoodImage path={c.photo} name={c.sample} width={96} shape="circle" className="h-9 w-9 shrink-0" />
                    <span className="min-w-0 truncate">{c.name}</span>
                    <span className="ml-auto text-xs font-semibold text-muted">{c.count}</span>
                  </Link>
                ))}
                
              </div>
            ) : null}
          </div>

          {/* Global search */}
          <div ref={box} className="relative min-w-0 flex-1">
            <form role="search" onSubmit={submit} className="flex h-12 items-stretch overflow-hidden rounded-[0.7rem] border-2 border-brand bg-canvas">
              <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true) }} onFocus={() => { setOpen(true); setCatsOpen(false) }} onKeyDown={keys}
                placeholder="Search pilau, chips, chai or a hotel…" aria-label="Search food and hotels" aria-autocomplete="list" aria-expanded={open && hits.length > 0}
                className="min-w-0 flex-1 bg-transparent px-4 text-sm outline-none placeholder:text-muted sm:text-base" />
              {q ? <button type="button" aria-label="Clear search" className="px-2 text-muted hover:text-ink" onClick={() => setQ('')}><CloseIcon className="h-3.5 w-3.5" /></button> : null}
              <button type="submit" aria-label="Search" className="flex w-14 items-center justify-center bg-brand text-white transition-colors hover:bg-brand-strong sm:w-16"><SearchIcon /></button>
            </form>
            {open && q.trim() ? (
              <div role="listbox" className="drop-in absolute inset-x-0 top-[3.4rem] z-30 max-h-[70vh] overflow-y-auto rounded-[1rem] border glass-line bg-canvas py-2">
                {hits.length === 0 ? <p className="px-4 py-3 text-sm text-muted">Nothing matches “{q.trim()}”. Try pilau, chips or chai.</p> : hits.map((h, n) => (
                  <button key={`${h.kind}-${h.id}`} type="button" role="option" aria-selected={n === active} onMouseEnter={() => setActive(n)} onClick={() => go(h.to)}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left ${n === active ? 'bg-ink/5' : ''}`}>
                    <FoodImage path={h.photo} name={h.label} width={96} shape={h.kind === 'dish' ? 'soft' : 'circle'} className="h-10 w-10 shrink-0 !rounded-lg" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-extrabold">{h.label}</span>
                      <span className="block truncate text-xs text-muted">{h.sub}</span>
                    </span>
                    <span className="shrink-0 text-[0.6rem] font-extrabold uppercase tracking-[0.12em] text-muted">{kindLabel[h.kind]}</span>
                  </button>
                ))}
                {hits.length ? (
                  <button type="button" onClick={() => go(`/menu?q=${encodeURIComponent(q.trim())}`)} className="mt-1 w-full border-t glass-line px-4 pt-2 text-left text-xs font-bold text-brand">
                    See every result for “{q.trim()}”
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>


        {/* Category shortcuts */}
        {categories.length ? (
          <nav aria-label="Food categories" className="no-scrollbar -mx-4 mt-5 flex gap-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            {categories.map((c) => (
              <Link key={c.key} to={catLink(c.name)} className="group flex w-20 shrink-0 flex-col items-center gap-1.5 text-center">
                <FoodImage path={c.photo} name={c.sample} width={200} shape="circle" className="h-16 w-16 transition-transform group-hover:scale-105 sm:h-[4.5rem] sm:w-[4.5rem]" />
                <span className="w-full truncate text-xs font-bold group-hover:text-brand">{c.name}</span>
              </Link>
            ))}
          </nav>
        ) : null}
      </div>
    </section>
  )
}
