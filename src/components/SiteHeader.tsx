import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useCart } from '../lib/cart'
import { useSettings } from '../lib/data'
import { useVendorChoice } from '../lib/vendorChoice'
import { HeaderSlot } from './HeaderBar'
import { CartIcon, CloseIcon, MenuIcon, SearchIcon } from './Icons'
import { UserAvatar } from './UserAvatar'
import { Logo } from './Logo'
import { ThemePicker } from './ThemePicker'

/** Closes a dropdown on outside click, Escape and navigation. */
function useDropdown() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { pathname, search } = useLocation()
  useEffect(() => setOpen(false), [pathname, search])
  useEffect(() => {
    if (!open) return
    const click = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', click)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', click); document.removeEventListener('keydown', key) }
  }, [open])
  return { open, setOpen, ref }
}

const popover = 'glass drop-in absolute z-[70] mt-2 rounded-2xl p-2 text-sm'
const item = 'block rounded-xl px-3 py-2 font-semibold hover:bg-white/40'
const label = 'px-3 pb-1 pt-3 text-[0.65rem] font-extrabold uppercase tracking-[0.16em] text-muted'

/** Round search field that opens from an icon; searches the live menu. */
function SearchToggle() {
  const [open, setOpen] = useState(false)
  const [params] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const navigate = useNavigate()
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { if (open) input.current?.focus() }, [open])
  const submit = (e: FormEvent) => {
    e.preventDefault()
    navigate(q.trim() ? `/menu?q=${encodeURIComponent(q.trim())}` : '/menu')
  }
  return (
    <form onSubmit={submit} role="search" className={`flex items-center rounded-full transition-all ${open ? 'glass w-44 pl-3 sm:w-60' : 'w-9'}`}>
      {open ? (
        <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pilau, chips, chai…" aria-label="Search the menu"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted" onBlur={() => { if (!q) setOpen(false) }} />
      ) : null}
      <button type={open ? 'submit' : 'button'} onClick={() => { if (!open) setOpen(true) }} aria-label={open ? 'Search' : 'Open search'}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:text-brand">
        <SearchIcon />
      </button>
      {open && q ? <button type="button" aria-label="Clear search" className="pr-2 text-muted" onClick={() => { setQ(''); input.current?.focus() }}><CloseIcon className="h-3 w-3" /></button> : null}
    </form>
  )
}

/** Avatar dropdown: everything a signed-in person can open, grouped by role. */
function AvatarMenu() {
  const { session, profile, memberships, signOut } = useAuth()
  const { open, setOpen, ref } = useDropdown()
  const navigate = useNavigate()
  const [vendorId, setVendorId] = useVendorChoice()
  const current = memberships.find((m) => m.vendorId === vendorId) ?? memberships[0]
  const nav = ({ isActive }: { isActive: boolean }) => `${item} ${isActive ? 'text-brand' : ''}`
  const Group = ({ title, children }: { title: string; children: ReactNode }) => (<><p className={label}>{title}</p>{children}</>)
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu" aria-label={session ? 'Your account menu' : 'Sign in'}
        className="flex items-center rounded-full">
        <UserAvatar path={profile?.avatarPath} className={`h-9 w-9 ${session ? '' : 'opacity-80'}`} />
      </button>
      {open ? (
        <div role="menu" className={`${popover} right-0 max-h-[80vh] w-64 overflow-y-auto`}>
          {session ? (
            <>
              <p className="px-3 pt-2 text-xs text-muted">Signed in as <strong className="text-ink">{profile?.fullName || profile?.email}</strong></p>
              <Group title="Orders">
                <NavLink role="menuitem" to="/orders" className={nav}>My orders</NavLink>
                <NavLink role="menuitem" to="/account" className={nav}>Account and phone</NavLink>
              </Group>
              {current ? (
                <Group title={current.vendors?.name ?? 'Your hotel'}>
                  {memberships.length > 1 ? (
                    <select className="field mx-3 mb-1 w-[calc(100%-1.5rem)] !text-xs" value={current.vendorId} onChange={(e) => setVendorId(e.target.value)} aria-label="Switch hotel">
                      {memberships.map((m) => <option key={m.vendorId} value={m.vendorId}>{m.vendors?.name}</option>)}
                    </select>
                  ) : null}
                  {current.vendors && !current.vendors.isActive ? (
                    <p className="px-3 pb-1 text-xs font-bold text-danger">{current.vendors.mpesaVerified ? 'Verified, offline' : 'Waiting for M-Pesa verification'}</p>
                  ) : null}
                  <NavLink role="menuitem" to="/hotel" className={nav}>Hotel dashboard</NavLink>
                </Group>
              ) : null}
              {profile?.role === 'rider' || profile?.role === 'admin' ? (
                <Group title="Delivery"><NavLink role="menuitem" to="/rider" className={nav}>My deliveries</NavLink></Group>
              ) : null}
              <p className={label}>Theme</p>
              <div className="px-3 pb-2"><ThemePicker compact /></div>
              <button type="button" role="menuitem" className={`${item} w-full text-left text-danger`} onClick={async () => { await signOut(); navigate('/') }}>Sign out</button>
            </>
          ) : (
            <>
              <Link role="menuitem" to="/login" className={item}>Sign in</Link>
              <Link role="menuitem" to="/signup" className={item}>Register</Link>
              <p className={label}>Theme</p>
              <div className="px-3 pb-2"><ThemePicker compact /></div>
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}

/**
 * Full-screen navigation, as in the reference template: a MENU / CLOSE toggle opens a clear panel
 * with the site's pages, the signed-in person's pages, and the contact lines. No dropdowns.
 */
function MenuPanel({ onClose }: { onClose: () => void }) {
  const { session, profile, memberships } = useAuth()
  const { data: settings } = useSettings()
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', key)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = '' }
  }, [onClose])
  const big = ({ isActive }: { isActive: boolean }) => `menu-font text-4xl transition-opacity sm:text-5xl ${isActive ? 'underline decoration-2 underline-offset-8' : 'opacity-85 hover:opacity-100'}`
  const small = 'menu-font text-lg hover:underline'
  return (
    <div id="site-menu" className="drop-in fixed inset-x-0 bottom-0 top-[3.25rem] z-[45] overflow-y-auto bg-brand text-white" role="dialog" aria-modal="true" aria-label="Menu">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-10 md:grid-cols-[1.4fr_1fr]">
        <nav className="flex flex-col gap-3" aria-label="Pages">
          <NavLink to="/" end className={big} onClick={onClose}>Home</NavLink>
          <NavLink to="/menu" className={big} onClick={onClose}>Menu</NavLink>
          <NavLink to="/deals" className={big} onClick={onClose}>Deals</NavLink>
          <NavLink to="/about" className={big} onClick={onClose}>About</NavLink>
          <NavLink to="/contact" className={big} onClick={onClose}>Contact</NavLink>
        </nav>
        <div className="flex flex-col gap-8">
          {session ? (
            <div className="flex flex-col gap-2">
              <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.16em] text-white/70">Your Campus Food</p>
              <Link to="/orders" className={small} onClick={onClose}>My orders</Link>
              <Link to="/account" className={small} onClick={onClose}>Account and phone</Link>
              {memberships.length ? <Link to="/hotel" className={small} onClick={onClose}>Hotel dashboard</Link> : null}
              {profile?.role === 'rider' || profile?.role === 'admin' ? <Link to="/rider" className={small} onClick={onClose}>My deliveries</Link> : null}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Link to="/login" className={small} onClick={onClose}>Sign in</Link>
              <Link to="/signup" className={small} onClick={onClose}>Register</Link>
            </div>
          )}
          <div className="flex flex-col gap-2 text-sm">
            <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.16em] text-white/70">Talk to us</p>
            {settings.supportEmail ? <a className="menu-font text-lg hover:underline" href={`mailto:${settings.supportEmail}`}>Email us · {settings.supportEmail}</a> : null}
            {settings.supportPhone ? <a className="menu-font text-lg hover:underline" href={`tel:${settings.supportPhone}`}>Call us · {settings.supportPhone}</a> : null}
            <p className="menu-font text-white/80">{settings.serviceHours}</p>
          </div>
          <Link to="/menu" className="btn btn-light self-start" onClick={onClose}>Start an order</Link>
        </div>
      </div>
    </div>
  )
}

/**
 * A slim second bar for signed-in people: their own pages as plain text links, always one tap away
 * (the avatar menu keeps the theme and sign-out). Links only, never buttons.
 */
export function AccountBar() {
  const { session, profile, memberships } = useAuth()
  if (!session) return null
  const link = ({ isActive }: { isActive: boolean }) =>
    `shrink-0 border-b-2 py-1.5 transition-colors ${isActive ? 'border-brand text-brand' : 'border-transparent text-ink/70 hover:text-brand'}`
  return (
    <nav aria-label="Your account" className="border-t glass-line">
      <div className="no-scrollbar mx-auto flex w-full max-w-7xl items-center gap-5 overflow-x-auto px-4 text-xs font-bold sm:justify-center sm:gap-8 sm:px-6 sm:text-[0.8rem]">
        <NavLink to="/orders" className={link}>My orders</NavLink>
        <NavLink to="/account" className={link}>Account and phone</NavLink>
        {memberships.length ? <NavLink to="/hotel" className={link}>Hotel dashboard</NavLink> : null}
        {profile?.role === 'rider' || profile?.role === 'admin' ? <NavLink to="/rider" className={link}>My deliveries</NavLink> : null}
        <NavLink to="/menu" className={link}>Menu</NavLink>
        <NavLink to="/deals" className={link}>Deals</NavLink>
      </div>
    </nav>
  )
}

/** One header on every page, laid out like the reference template: MENU left, logo centre, actions right. */
export function SiteHeader() {
  const { count } = useCart()
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => setOpen(false), [pathname])
  return (
    <div data-app-header className="glass sticky top-0 z-50 !border-x-0 !border-t-0 no-print">
      <header className="mx-auto grid w-full max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 py-1.5 sm:px-6">
        <div className="flex items-center">
          <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="site-menu"
            className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.14em] hover:text-brand">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border glass-line">{open ? <CloseIcon /> : <MenuIcon />}</span>
            <span className="hidden sm:inline">{open ? 'Close' : 'Menu'}</span>
          </button>
        </div>
        <Link to="/" aria-label="Campus Food home" className="justify-self-center"><Logo size="sm" /></Link>
        <div className="flex items-center justify-end gap-1.5">
          <SearchToggle />
          <Link to="/cart" aria-label={`Cart, ${count} item${count === 1 ? '' : 's'}`} className="relative flex h-9 w-9 items-center justify-center rounded-full hover:text-brand">
            <CartIcon />
            {count > 0 ? <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[0.6rem] font-extrabold text-white">{count}</span> : null}
          </Link>
          <AvatarMenu />
          <Link to="/menu" className="btn ml-1 hidden md:inline-flex">Start an order</Link>
        </div>
      </header>
      <AccountBar />
      <HeaderSlot />
      {/* Portalled to <body>: the header's backdrop blur would otherwise trap a fixed panel inside it. */}
      {open ? createPortal(<MenuPanel onClose={() => setOpen(false)} />, document.body) : null}
    </div>
  )
}
