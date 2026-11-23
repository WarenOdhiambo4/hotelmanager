import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { ChaiDrawing, HandNote, ScooterDrawing } from '../../components/Drawings'
import { DishShelf, DishTile } from '../../components/DishShelf'
import { FoodImage } from '../../components/FoodImage'
import { Bait, Notice, StarPicker, Stars, TextArea, TextField } from '../../components/form'
import { useCart } from '../../lib/cart'
import { useOffers, usePublicMenu, useSettings, useSiteImages, useTestimonials, useVideos, type PublicMenu, type SiteImage } from '../../lib/data'
import { dayMonth, kes, shortKes } from '../../lib/format'
import { setTitle, youtubeId } from '../../lib/site'
import { friendly, mediaUrl, rpc } from '../../lib/supabase'
import type { MenuItem } from '../../lib/types'
import { feedbackSchema, fieldErrors, type FieldErrors } from '../../lib/validation'
import { HomeFinder } from '../../components/HomeFinder'
import { LiveOrders } from '../../components/LiveOrders'
import { Stroke } from '../../components/Stroke'

const vendorName = (menu: PublicMenu, id: string) => menu.vendors.find((v) => v.id === id)?.name ?? 'Campus kitchen'

/** Photos for a slot: the admin's site photos for that placement first, then dish photos. */
export function photosFor(placement: string, site: SiteImage[], menu: PublicMenu, count: number) {
  const own = site.filter((s) => s.placement === placement).map((s) => ({ id: s.id, path: s.imagePath as string | null, name: s.caption ?? 'Campus Food' }))
  const dishes = menu.items.filter((i) => i.imagePath).map((i) => ({ id: i.id, path: i.imagePath, name: i.name }))
  const all = [...own, ...dishes]
  return all.length ? all.slice(0, count) : Array.from({ length: count }, (_, n) => ({ id: `d${n}`, path: null, name: ['Pilau', 'Chapati', 'Chai', 'Burger'][n % 4]! }))
}

const h2 = 'headline text-3xl sm:text-4xl'

export function Home() {
  const { data: menu } = usePublicMenu()
  const { data: site } = useSiteImages()
  useEffect(() => setTitle(), [])
  return (
    <>
      <HomeFinder />
      <Hero menu={menu} site={site} />
      <TheDeal menu={menu} site={site} />
      <Signature menu={menu} />
      <ChefsPicks menu={menu} />
      <Trust menu={menu} />
      <Plates menu={menu} site={site} />
      <Offers menu={menu} />
      <ForHotels menu={menu} site={site} />
      <FeedbackSection menu={menu} site={site} />
      <Videos />
    </>
  )
}

/* 1. Hero: two clear handwritten lines (a highlighter stroke and a drawn underline), one sentence
   that explains the offer, two buttons, a handwritten price note, and a small photo that glows
   into the page. The live dishes pop in beside the photo, four at a time. */
const SPOTS = [
  { from: ['14vw', '-6vh'], tilt: '-7deg' },
  { from: ['10vw', '6vh'], tilt: '6deg' },
  { from: ['-14vw', '-6vh'], tilt: '6deg' },
  { from: ['-10vw', '6vh'], tilt: '-6deg' },
]

function HeroDish({ item, spot, delay }: { item: MenuItem; spot: (typeof SPOTS)[number]; delay: number }) {
  return (
    <Link to={`/menu?dish=${item.id}`} className="pop-spread flex w-28 flex-col items-center text-center"
      style={{ ['--from-x' as string]: spot.from[0], ['--from-y' as string]: spot.from[1], ['--tilt' as string]: spot.tilt, animationDelay: `${delay}ms` }}>
      <FoodImage path={item.imagePath} name={item.name} width={240} shape="circle" className="h-20 w-20 border-4 border-canvas lg:h-24 lg:w-24" />
      <span className="mt-1 text-xs font-bold">{item.name}</span>
      <span className="text-xs text-muted">{kes(item.price)}</span>
    </Link>
  )
}

function Hero({ menu, site }: { menu: PublicMenu; site: SiteImage[] }) {
  const { data: settings } = useSettings()
  const [page, setPage] = useState(0)
  const items = menu.items
  const pages = Math.max(1, Math.ceil(items.length / 4))
  useEffect(() => {
    if (items.length <= 4) return
    const t = setInterval(() => setPage((p) => (p + 1) % pages), 6000)
    return () => clearInterval(t)
  }, [items.length, pages])
  const shown = items.length ? Array.from({ length: Math.min(4, items.length) }, (_, i) => items[(page * 4 + i) % items.length]!) : []
  // The hero photo lives in Storage: the Site content photo placed as "Home hero", else the stored default
  // (site/hero/hero-food.webp). The copy bundled with the site is used only if Storage cannot be reached.
  const stored = mediaUrl(site.find((x) => x.placement === 'hero')?.imagePath ?? 'site/hero/hero-food.webp')
  const [photo, setPhoto] = useState(stored ?? '/brand/hero-food.webp')
  useEffect(() => { if (stored) setPhoto(stored) }, [stored])
  const offline = () => setPhoto('/brand/hero-food.webp')

  return (
    <section className="relative isolate overflow-hidden px-4 pb-14 pt-12 sm:px-6 sm:pt-16">
      {/* Backdrop: the same photo, softly blurred and brightened, so the hero carries its colours. */}
      <img src={photo} onError={offline} alt="" aria-hidden="true" className="absolute inset-0 -z-20 h-full w-full scale-110 object-cover blur-2xl" />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-canvas/80" />
      <HeroPhone />
      <LiveOrders menu={menu} />
      <div className="mx-auto max-w-5xl text-center">
        <h1 className="hand rise font-bold leading-[0.95] text-[clamp(2.4rem,5.6vw,5rem)]">
          Every campus kitchen. <span className="marker">One menu.</span>
        </h1>
        <p className="hand rise mt-1 font-bold leading-tight text-[clamp(1.8rem,3.8vw,3.3rem)]" style={{ animationDelay: '150ms' }}>
          Hotel prices, paid direct on{' '}
          <span className="relative inline-block">
            M-Pesa.
            <svg viewBox="0 0 200 16" className="absolute -bottom-2 left-0 h-3 w-full text-brand" aria-hidden="true" preserveAspectRatio="none">
              <path pathLength={1} className="draw" style={{ animationDelay: '900ms' }} d="M3 11C60 4 140 3 197 9" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
            </svg>
          </span>
        </p>
        <div className="relative rise mt-8 inline-flex flex-wrap justify-center gap-3" style={{ animationDelay: '360ms' }}>
          <Link to="/menu" className="btn btn-lg">Browse today&apos;s menu</Link>
          <Link to="/deals" className="btn btn-ghost btn-lg !bg-canvas hover:!bg-ink/10">See this week&apos;s deals</Link>
          <span className="pointer-events-none absolute left-full top-1/2 ml-6 hidden w-56 -translate-y-1/3 text-left lg:block">
            <svg viewBox="0 0 60 40" className="h-8 w-12 -scale-x-100 text-brand" aria-hidden="true"><path pathLength={1} className="draw" style={{ animationDelay: '1200ms' }} d="M4 6c20 0 36 8 44 26M48 32l2-12M48 32l-11-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span className="hand block -rotate-6 text-2xl leading-tight text-brand">KES {shortKes(settings.platformFee)} flat fee per order,<br />zero markup on food</span>
          </span>
        </div>
      </div>
      {/* The photo itself, sharp and untouched, centred with a soft white glow around it. */}
      <figure className="rise mx-auto mt-12 w-full max-w-3xl" style={{ animationDelay: '480ms' }}>
        <img src={photo} onError={offline} alt="A table of burgers, chicken, fries and drinks" fetchPriority="high"
          className="hero-photo aspect-[4/5] w-full rounded-[1.75rem] object-cover object-[center_60%] sm:aspect-[16/10]"
          style={{ boxShadow: '0 0 0 6px var(--color-canvas), 0 0 70px 24px color-mix(in srgb, var(--color-canvas) 92%, transparent)' }} />
      </figure>
      {shown.length ? (
        <div className="no-scrollbar mx-auto mt-10 flex max-w-4xl justify-start gap-6 overflow-x-auto pb-2 sm:justify-center">
          {shown.map((it, i) => <HeroDish key={`${page}-${it.id}`} item={it} spot={SPOTS[i]!} delay={i * 140} />)}
        </div>
      ) : null}
    </section>
  )
}

/* Big screens only: a phone beside the hero photo, turned slightly so its left side shows, playing the ordering Short
   muted on a loop. Decorative (the video also plays, with sound, in "Watch it run"); smaller screens never load it. */
const HERO_SHORT = 'rPvPW6r66_8'
function HeroPhone() {
  const [big, setBig] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1360px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1360px)')
    const on = () => setBig(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  if (!big) return null
  const src = `https://www.youtube-nocookie.com/embed/${HERO_SHORT}?autoplay=1&mute=1&loop=1&playlist=${HERO_SHORT}&controls=0&playsinline=1&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1`
  return (
    // Top-left of the hero, in the free space beside the headline: in from the corner, never over the text.
    <div className="hero-phone pointer-events-none absolute top-10 w-[11.25rem]" style={{ left: 'max(1.5rem, calc(50% - 42rem))' }} aria-hidden="true">
      <div className="hero-phone-body relative aspect-[9/19.5] rounded-[2.4rem] bg-[#111] p-[0.55rem]">
        <div className="absolute left-1/2 top-[0.95rem] z-10 h-[1.15rem] w-[4.6rem] -translate-x-1/2 rounded-full bg-black" />
        <div className="relative h-full w-full overflow-hidden rounded-[1.9rem] bg-black">
          {/* The Short is 9:16 and the screen is taller, so it is scaled to cover the screen. */}
          <iframe title="Campus Food: ordering in under a minute" src={src} tabIndex={-1} loading="lazy"
            allow="autoplay; encrypted-media; picture-in-picture"
            className="absolute left-1/2 top-1/2 h-full w-[120%] -translate-x-1/2 -translate-y-1/2 border-0" />
        </div>
      </div>
    </div>
  )
}

/* 2. The deal: the business case in four numbers, then service hours and arched photos. */
function TheDeal({ menu, site }: { menu: PublicMenu; site: SiteImage[] }) {
  const { data: settings } = useSettings()
  const terms = [
    { n: '0%', title: 'Markup on food', text: 'You pay the hotel’s own menu price. We never inflate a plate.' },
    { n: `KES ${shortKes(settings.platformFee)}`, title: 'Flat service fee', text: 'Per order, not per item. Delivery priced by your zone and shown before you pay.' },
    { n: `${settings.refundWindowMinutes} min`, title: 'Refund window', text: 'Ordered wrong? Ask for your money back before the kitchen fires up.' },
    { n: '1 PIN', title: 'Straight to the hotel', text: 'The prompt hits your phone; the cash lands in the hotel’s Paybill or Till. No middleman wallet.' },
  ]
  const arches = photosFor('together', site, menu, 3)
  // Two dish photos set into the headline, like little plates between the words.
  const inline = menu.items.filter((i) => i.imagePath).sort((a, b) => Number(b.isSignature) - Number(a.isSignature)).slice(0, 2)
  const Pill = ({ n }: { n: number }) => inline[n] ? (
    <FoodImage path={inline[n]!.imagePath} name={inline[n]!.name} width={240} className="mx-[0.18em] inline-block h-[0.8em] w-[1.25em] -translate-y-[0.06em] !rounded-[0.32em] align-middle" />
  ) : <span className="mx-[0.1em]" />
  return (
    <section id="deal" className="scroll-mt-20 overflow-hidden pt-16 sm:pt-20">
      <div className="mx-auto max-w-5xl px-4 text-center sm:px-6">
        <p className="hand text-2xl text-brand">no queue, no calls</p>
        <h2 className="headline mt-2 leading-[1.08] text-[clamp(2rem,5.2vw,4.4rem)]">
          The campus<Pill n={0} />food deal<br />in four<Pill n={1} />numbers
        </h2>
      </div>
      {/* The four numbers are for tablets and computers only; phones go straight to service hours and the menu. */}
      <dl className="mx-auto mt-10 hidden max-w-6xl gap-8 px-4 sm:grid sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        {terms.map((t) => (
          <div key={t.title} className="flex flex-col gap-1">
            <dt className="order-3 text-xs font-extrabold uppercase tracking-[0.14em] text-brand">{t.title}</dt>
            <dd className="hand order-1 text-5xl font-bold leading-none">{t.n}</dd>
            <dd className="order-2 mb-2 w-28" aria-hidden="true"><Stroke seed={t.title} thick={4} /></dd>
            <dd className="order-4 text-sm text-muted">{t.text}</dd>
          </div>
        ))}
      </dl>
      <div className="mx-auto mt-12 max-w-2xl px-4 text-center">
        <Stroke color="var(--color-ink)" seed="hours-top" thick={2.5} />
        <p className="headline py-3 text-lg sm:text-2xl">{settings.serviceHours}</p>
        <Stroke color="var(--color-ink)" seed="hours-bottom" thick={2.5} />
        <Link to="/menu" className="btn btn-lg mt-7">
          Browse today&apos;s menu
          <svg viewBox="0 0 20 12" className="h-3 w-5" aria-hidden="true"><path d="M1 6h17M13 1l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </Link>
      </div>
      <div className="mx-auto mt-14 grid max-w-6xl translate-y-8 grid-cols-3 gap-3 px-2 sm:gap-6 sm:px-6">
        {arches.map((p) => <FoodImage key={p.id} path={p.path} name={p.name} width={600} shape="arch" className="aspect-[3/4] w-full" />)}
      </div>
    </section>
  )
}

/* 3. Signature items on a flat green band: photo plus a ruled price list. */
function Signature({ menu }: { menu: PublicMenu }) {
  const list = useMemo(() => {
    const sig = menu.items.filter((i) => i.isSignature)
    return (sig.length >= 3 ? sig : [...sig, ...menu.items.filter((i) => !i.isSignature)]).slice(0, 6)
  }, [menu.items])
  const [active, setActive] = useState(0)
  const feature = list[active] ?? list[0]
  return (
    <section className="relative z-10 px-4 py-16 sm:px-6 sm:py-20">
      <p className="hand text-center text-2xl text-brand">hot right now</p>
      <h2 className={`${h2} text-center`}>What campus is ordering today</h2>
      <div className="mx-auto mt-10 grid max-w-5xl items-center gap-8 lg:grid-cols-2">
        <FoodImage path={feature?.imagePath} name={feature?.name ?? 'Signature dish'} width={800} className="aspect-[4/3] w-full" />
        <div>
          <h3 className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand">Signature plates</h3>
          {list.length === 0 ? null : (
            <ul className="mt-3">
              {list.map((it, n) => (
                <li key={it.id}>
                  <Link to={`/menu?dish=${it.id}`} onMouseEnter={() => setActive(n)} onFocus={() => setActive(n)}
                    className={`flex items-baseline justify-between gap-4 border-b glass-line py-3 transition-colors ${n === active ? 'text-brand' : 'hover:text-brand'}`}>
                    <span className="text-sm font-extrabold uppercase tracking-wide">{it.name}</span>
                    <span className="flex items-baseline gap-2 text-sm font-extrabold">
                      {it.previousPrice ? <s className="text-xs opacity-60">{shortKes(it.previousPrice)}</s> : null}
                      {shortKes(it.price)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link to="/menu" className="btn mt-6">See every signature plate</Link>
        </div>
      </div>
    </section>
  )
}

/* 4. Chef's picks: three columns, two rows, centred. */
function ChefsPicks({ menu }: { menu: PublicMenu }) {
  const { add } = useCart()
  const [added, setAdded] = useState<string | null>(null)
  const dishes = useMemo(() => [...menu.items].sort((a, b) => Number(b.isSignature) - Number(a.isSignature) || a.sortOrder - b.sortOrder).slice(0, 6), [menu.items])
  const order = (it: MenuItem) => {
    add(it, vendorName(menu, it.vendorId))
    setAdded(it.id)
    setTimeout(() => setAdded((x) => (x === it.id ? null : x)), 1800)
  }
  return (
    <section className="relative z-10 px-4 py-16 sm:px-6 sm:py-20">
      <div className="relative mx-auto max-w-3xl text-center">
        <h2 className={h2}>Chef's picks</h2>
        <HandNote className="absolute -top-8 right-0 hidden rotate-6 md:inline-flex" flip>add two, thank us later</HandNote>
      </div>
      {dishes.length === 0 ? (
        <div className="mx-auto mt-10 flex max-w-sm flex-col items-center text-center text-muted">
          <ChaiDrawing className="h-20 w-20 text-ink" />
          <p className="mt-3 text-sm">Kitchens are setting today's menu.</p>
        </div>
      ) : (
        <div className="mx-auto mt-6 max-w-6xl">
          <DishShelf>
            {dishes.map((it) => (
              <DishTile key={it.id} item={it} meta={vendorName(menu, it.vendorId)}
                actions={<button type="button" className="btn" onClick={() => order(it)}>{added === it.id ? 'In your cart' : 'Add to cart'}</button>} />
            ))}
          </DishShelf>
        </div>
      )}
    </section>
  )
}

/* 5. Ratings from real orders. Shown only once there are published reviews. */
function Trust({ menu }: { menu: PublicMenu }) {
  const { data: quotes } = useTestimonials()
  const [n, setN] = useState(0)
  if (quotes.length === 0) return null
  const q = quotes[n % quotes.length]!
  const pics = menu.items.filter((i) => i.imagePath)
  const left = pics[(n * 2) % Math.max(1, pics.length)]
  const right = pics[(n * 2 + 1) % Math.max(1, pics.length)]
  const small = 'rounded-full border glass-line px-3.5 py-1.5 text-xs font-extrabold uppercase hover:border-brand hover:text-brand'
  return (
    <section className="relative z-10 overflow-hidden px-4 pb-16 pt-20 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <h2 className={h2}>Rated by our customers</h2>
        <div className="flex gap-2">
          <button type="button" className={small} aria-label="Previous review" onClick={() => setN((x) => (x - 1 + quotes.length) % quotes.length)}>Back</button>
          <button type="button" className={small} aria-label="Next review" onClick={() => setN((x) => (x + 1) % quotes.length)}>Next</button>
        </div>
      </div>
      <div className="mx-auto mt-10 grid max-w-5xl items-center gap-8 lg:grid-cols-[1fr_1.6fr_1fr]">
        <FoodImage path={left?.imagePath} name={left?.name ?? 'Campus food'} width={400} shape="flower" className="mx-auto hidden aspect-square w-40 lg:block" />
        <figure key={q.id} className="rise text-center lg:text-left">
          <blockquote className="text-lg font-bold leading-snug sm:text-xl">“{q.comment}”</blockquote>
          <figcaption className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm lg:justify-between">
            <span><span className="font-extrabold">{q.displayName}</span>{q.vendorName ? <span className="block text-xs text-muted">ordered from {q.vendorName}</span> : null}</span>
            <Stars n={q.rating} />
          </figcaption>
        </figure>
        <FoodImage path={right?.imagePath} name={right?.name ?? 'Campus food'} width={400} shape="flower" className="mx-auto hidden aspect-square w-40 lg:block" />
      </div>
      <p className="mx-auto mt-10 max-w-5xl text-center lg:text-left">
        <a href="#videos" className="hand text-2xl text-brand underline decoration-1 underline-offset-8">watch an order go from PIN to plate</a>
      </p>
    </section>
  )
}

/* 6. Slides: tilted photos drifting across. */
function Plates({ menu, site }: { menu: PublicMenu; site: SiteImage[] }) {
  const strip = photosFor('gallery', site, menu, 8)
  return (
    <section className="relative z-10 overflow-hidden py-16 sm:py-20">
      <h2 className={`${h2} mx-auto max-w-3xl px-4 text-center`}>Plates of the day</h2>
      <div className="mt-10 overflow-hidden py-8">
        <div className="marquee flex items-center gap-6" style={{ ['--marquee-speed' as string]: '60s' }}>
          {[...strip, ...strip].map((p, n) => (
            <div key={`${p.id}-${n}`} className={`shrink-0 ${n % 2 ? 'tilt-right' : 'tilt-left'}`}>
              <FoodImage path={p.path} name={p.name} width={520} className={`${n % 3 === 1 ? 'h-48 w-40 sm:h-60 sm:w-48' : 'h-60 w-48 sm:h-72 sm:w-60'} !rounded-[2rem]`} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* 7. Weekend offers and dinners. */
function Offers({ menu }: { menu: PublicMenu }) {
  const { data: offers } = useOffers()
  if (offers.length === 0) return null
  return (
    <section className="relative z-10 px-4 py-16 sm:px-6 sm:py-20">
      <h2 className={`${h2} text-center`}>Weekend deals and dinners</h2>
      {offers.length === 0 ? (
        <p className="story mx-auto mt-6 max-w-md text-center text-sm text-muted">Deals drop on Fridays. Hotels post them here first.</p>
      ) : (
        <ul className="mx-auto mt-10 max-w-5xl">
          {offers.map((o) => {
            const d = dayMonth(o.eventDate)
            const item = o.menuItemId ? menu.items.find((i) => i.id === o.menuItemId) : undefined
            return (
              <li key={o.id} className="grid items-center gap-6 border-b glass-line py-8 md:grid-cols-[7rem_1fr_14rem]">
                <p className="text-center md:text-left">
                  <span className="headline block text-4xl text-brand">{d.day}</span>
                  <span className="hand text-2xl">{d.month}</span>
                </p>
                <div>
                  <h3 className="text-lg font-extrabold uppercase tracking-wide">{o.title}</h3>
                  {o.body ? <p className="mt-2 max-w-lg text-sm text-muted">{o.body}</p> : null}
                  <p className="mt-2 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-brand">{o.vendorId ? vendorName(menu, o.vendorId) : 'Every campus hotel'}</p>
                  <Link to={`/deals/${o.id}`} className="btn mt-4">Read more</Link>
                </div>
                <FoodImage path={o.imagePath ?? item?.imagePath} name={o.title} width={480} className="aspect-square w-full !rounded-l-[999px] !rounded-r-[1.5rem]" />
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/* 8. For hotel owners: why listing pays. */
export function ForHotels({ menu, site }: { menu: PublicMenu; site: SiteImage[] }) {
  const pic = photosFor('hotels', site, menu, 1)[0]!
  const points = [
    ['Your Paybill, your cash', 'Customers pay your own Paybill or Till. No payout cycle, no float sitting with us.'],
    ['Full menu price, every plate', 'We earn from the customer’s service and delivery fee. Your food price stays yours.'],
    ['Orders with the room number', 'Paid orders land on your dashboard with a chime, the block, the room and the phone.'],
    ['Numbers you can bank on', 'Daily sales, refunds and fees owed on one screen. Download it, settle it, move on.'],
  ]
  // Phones get the case in four plain, direct statements: no labels, no explanations.
  const phoneLines = [
    'The customer pays your Paybill. Not us. Not tomorrow. Today.',
    'Your menu price stays your menu price. We charge the customer, never your plate.',
    'Every paid order rings on your screen with the block, the room and the phone.',
    'Every shilling sold, refunded and owed is on one screen. Count it. Bank it.',
  ]
  return (
    <section className="relative z-10 px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-[1fr_1.2fr]">
        <FoodImage path={pic.path} name={pic.name} width={720} shape="arch" className="aspect-[4/5] w-full max-w-sm justify-self-center" />
        <div>
          <p className="hand text-2xl text-brand">for hotel owners</p>
          <h2 className={h2}>Every hostel, office and gate is a table in your hotel</h2>
          <ul className="mt-6 flex flex-col gap-4 sm:hidden">
            {phoneLines.map((l) => (
              <li key={l} className="border-t glass-line pt-3 text-base font-bold leading-snug">{l}</li>
            ))}
          </ul>
          <dl className="mt-6 hidden gap-5 sm:grid sm:grid-cols-2">
            {points.map(([t, d]) => (
              <div key={t} className="border-t glass-line pt-3">
                <dt className="text-sm font-extrabold">{t}</dt>
                <dd className="mt-1 text-sm text-muted">{d}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-7 flex flex-wrap items-center gap-4">
            <a href="#feedback" className="btn">Get your hotel listed</a>
            <span className="story text-xs text-muted">Our team registers your hotel and verifies your Paybill with a KES 1 test payment.</span>
          </div>
        </div>
      </div>
    </section>
  )
}

/* Feedback: a photo beside a flat form. */
export function FeedbackSection({ menu, site }: { menu: PublicMenu; site: SiteImage[] }) {
  const { profile } = useAuth()
  const [form, setForm] = useState({ displayName: '', contactEmail: '', rating: 0, comment: '' })
  const [errors, setErrors] = useState<FieldErrors<typeof form>>({})
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [problem, setProblem] = useState<string | null>(null)
  const [bait, setBait] = useState('')
  useEffect(() => {
    if (profile) setForm((f) => ({ ...f, displayName: f.displayName || profile.fullName.split(' ')[0] || '', contactEmail: f.contactEmail || profile.email || '' }))
  }, [profile])
  const pic = photosFor('feedback', site, menu, 1)[0]!
  async function submit(e: FormEvent) {
    e.preventDefault()
    setProblem(null)
    const parsed = feedbackSchema.safeParse(form)
    if (!parsed.success) { setErrors(fieldErrors<typeof form>(parsed.error)); return }
    setErrors({})
    if (!profile && !parsed.data.contactEmail) { setErrors({ contactEmail: 'Add your email so we can reply' }); return }
    if (bait) { setState('sent'); return }
    setState('sending')
    try {
      await rpc('submitFeedback', { pOrderId: null, pRating: parsed.data.rating, pComment: parsed.data.comment, pDisplayName: parsed.data.displayName, pContactEmail: parsed.data.contactEmail || null })
      setState('sent')
    } catch (err) {
      setProblem(friendly(err))
      setState('idle')
    }
  }
  return (
    <section id="feedback" className="relative z-10 scroll-mt-20 px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-2">
        <FoodImage path={pic.path} name={pic.name} width={720} className="aspect-[4/5] w-full" />
        <div>
          <h2 className={h2}>Talk to the team</h2>
          {state === 'sent' ? (
            <div className="mt-8">
              <p className="hand text-3xl text-brand">asante sana!</p>
              <Notice tone="success">Received. We reply to the email you gave.</Notice>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="relative mt-8 flex flex-col gap-6">
              <Bait value={bait} onChange={setBait} />
              <div className="grid gap-6 sm:grid-cols-2">
                <TextField label="Your name" value={form.displayName} onChange={(v) => setForm({ ...form, displayName: v })} error={errors.displayName} autoComplete="given-name" />
                <TextField label="Email" type="email" value={form.contactEmail} onChange={(v) => setForm({ ...form, contactEmail: v })} error={errors.contactEmail} autoComplete="email" />
              </div>
              <StarPicker value={form.rating} onChange={(v) => setForm({ ...form, rating: v })} error={errors.rating} />
              <TextArea label="Message" value={form.comment} onChange={(v) => setForm({ ...form, comment: v })} error={errors.comment} rows={3} />
              {problem ? <Notice tone="error">{problem}</Notice> : null}
              <button type="submit" className="btn w-full py-3" disabled={state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Send'}</button>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}

/* Videos on top of the footer: several YouTube videos (ordering, hotels, interface, admin) with slide buttons. */
const TOPIC_LABEL: Record<string, string> = { orderProcess: 'Ordering', vendor: 'For hotels', interface: 'Using the site', admin: 'Behind the counter', trust: 'Payments and refunds' }

export function Videos() {
  const { data: videos } = useVideos()
  const [n, setN] = useState(0)
  const v = videos[n % Math.max(1, videos.length)]
  const id = v ? youtubeId(v.youtubeUrl) : null
  return (
    <section id="videos" className="relative z-10 scroll-mt-20 px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="hand text-2xl text-brand">{v ? TOPIC_LABEL[v.topic] ?? 'Watch' : 'Watch'}</p>
            <h2 className={h2}>{v?.title ?? 'Watch it run'}</h2>
          </div>
          {videos.length > 1 ? (
            <div className="flex items-center gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => setN((x) => (x - 1 + videos.length) % videos.length)}>Back</button>
              <span className="text-xs font-bold text-muted">{(n % videos.length) + 1} / {videos.length}</span>
              <button type="button" className="btn" onClick={() => setN((x) => (x + 1) % videos.length)}>Next</button>
            </div>
          ) : null}
        </div>
        {/* Shorts are vertical: show them in a tall frame instead of letterboxing them in a wide one. */}
        <div className={`mt-6 overflow-hidden bg-ink/5 ${v && /\/shorts\//.test(v.youtubeUrl)
          ? 'mx-auto aspect-[9/16] w-full max-w-[20rem] rounded-[2rem]' : 'aspect-video w-full rounded-[1.5rem]'}`}>
          {id ? (
            <iframe key={id} className="h-full w-full" src={`https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`}
              title={v!.title} loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-ink">
              <ScooterDrawing className="h-20 w-32" />
            </div>
          )}
        </div>
        {videos.length > 1 ? (
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
            {videos.map((x, i) => (
              <button key={x.id} type="button" onClick={() => setN(i)} className={`text-xs font-bold ${i === n % videos.length ? 'text-brand underline underline-offset-4' : 'text-muted hover:text-ink'}`}>
                {TOPIC_LABEL[x.topic] ?? x.title}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}
