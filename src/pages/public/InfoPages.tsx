import { useEffect, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PlateDrawing } from '../../components/Drawings'
import { FoodImage } from '../../components/FoodImage'
import { useLoad, usePublicMenu, useSettings, useSiteImages } from '../../lib/data'
import { dayMonth, kes, shortKes } from '../../lib/format'
import { setTitle, whatsappLink } from '../../lib/site'
import { supabase } from '../../lib/supabase'
import type { Offer } from '../../lib/types'
import { FeedbackSection, ForHotels, photosFor } from './Home'
import { Stroke } from '../../components/Stroke'

/*
 * Public information pages, laid out like the reference template's inner pages: a page hero band,
 * then content sections. About, Deals (list and detail), Contact, Privacy and Terms.
 */

const h2 = 'headline text-3xl sm:text-4xl'

function PageHero({ title, crumb, children }: { title: string; crumb: string; children?: ReactNode }) {
  return (
    <section className="relative overflow-hidden border-b glass-line px-4 pb-6 pt-6 text-center sm:pb-12 sm:pt-10 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted"><Link to="/" className="hover:text-brand">Home</Link> / {crumb}</p>
      <h1 className="hand mt-2 font-bold leading-[0.95] text-[clamp(1.7rem,5.6vw,4.4rem)]">{title}</h1>
      {children ? <div className="story mx-auto mt-4 max-w-2xl text-sm text-ink/75 sm:text-base">{children}</div> : null}
    </section>
  )
}

/* About ------------------------------------------------------------------------------------- */
export function About() {
  const { data: menu } = usePublicMenu()
  const { data: settings } = useSettings()
  const { data: site } = useSiteImages()
  useEffect(() => setTitle('About Us', 'Campus Food connects Kisii University students with verified campus hotels: honest menu prices, one flat service fee, payment straight to the hotel by M-PESA, and delivery to your door.'), [])
  const pics = photosFor('together', site, menu, 3)
  const coverFor = (id: string) => (menu.items.find((i) => i.vendorId === id && i.isSignature && i.imagePath) ?? menu.items.find((i) => i.vendorId === id && i.imagePath))?.imagePath ?? null
  const why = [
    ['Hotel prices, full stop', 'The price on the menu is the hotel’s own. One flat service fee per order, shown before you pay.'],
    ['Pay the hotel, not a middleman', 'The M-Pesa prompt goes straight to the hotel’s Paybill or Till. We never hold your money.'],
    [`${settings.refundWindowMinutes} minutes to change your mind`, 'Ordered twice or picked the wrong plate? Ask for a refund before the kitchen fires up.'],
    ['Updates without bundles', 'Accepted, cooking, on the way: by SMS too, so a zero-data phone still knows where lunch is.'],
  ]
  const faq: [string, ReactNode][] = [
    ['How do I pay?', 'Place the order, tap Pay, and enter your M-Pesa PIN on the prompt. The order goes to the kitchen the moment M-Pesa confirms it.'],
    ['What does delivery cost?', <>It depends on your area, from the zone list at checkout. The platform fee is a flat KES {shortKes(settings.platformFee)} per order.</>],
    ['Can I order from two hotels at once?', 'One order, one hotel: each payment goes straight to one hotel. Place a second order for the other hotel.'],
    ['How do refunds work?', `You can ask within ${settings.refundWindowMinutes} minutes of paying. If a hotel rejects your order, the refund is automatic, whatever the time.`],
    ['When are you open?', settings.serviceHours],
    ['How does my hotel get listed?', <>Our team registers the hotel and verifies its Paybill or Till with a KES 1 test payment. <Link to="/contact" className="link font-bold">Talk to us</Link>.</>],
  ]
  return (
    <>
      <PageHero title="About Campus Food" crumb="About">Every verified campus hotel on one live menu.</PageHero>
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2">
        <div>
          <p className="hand text-2xl text-brand">built for everyone on campus</p>
          <h2 className={h2}>The campus food deal</h2>
          <p className="mt-4 max-w-lg text-sm text-muted">
            Campus Food puts every verified hotel around campus on one live menu. You order, you pay the hotel on M-Pesa, the kitchen sees it instantly,
            and a rider brings it to your block. No queue, no calling around, no guessing what is still available.
          </p>
          <div className="mt-6 flex flex-wrap gap-8">
            <p><span className="headline block text-3xl text-brand">{menu.vendors.length}</span><span className="text-xs font-bold uppercase tracking-[0.14em] text-muted">hotels live</span></p>
            <p><span className="headline block text-3xl text-brand">{menu.items.length}</span><span className="text-xs font-bold uppercase tracking-[0.14em] text-muted">dishes on the menu</span></p>
            <p><span className="headline block text-3xl text-brand">0%</span><span className="text-xs font-bold uppercase tracking-[0.14em] text-muted">markup on food</span></p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {pics.map((p) => <FoodImage key={p.id} path={p.path} name={p.name} width={480} shape="arch" className="aspect-[3/4] w-full" />)}
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6">
        <h2 className={`${h2} text-center`}>Why customers order here</h2>
        <dl className="mx-auto mt-10 grid max-w-6xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {why.map(([t, d]) => (
            <div key={t}>
              <Stroke seed={t} className="mb-3" />
              <dt className="font-extrabold">{t}</dt>
              <dd className="mt-1 text-sm text-muted">{d}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className={`${h2} text-center`}>The kitchens behind it</h2>
        {menu.vendors.length === 0 ? null : (
          <div className="mt-10 grid gap-x-8 gap-y-10" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(14rem, 100%), 1fr))' }}>
            {menu.vendors.map((v) => (
              <Link key={v.id} to={`/menu?hotel=${v.slug}`} className="group flex flex-col gap-3">
                <div className="relative">
                  {/* The hotel's own cover; until it sends one, its best dish photo stands in. */}
                  <FoodImage path={v.coverPath ?? coverFor(v.id)} name={v.name} width={600} className="aspect-[4/3] w-full !rounded-[1.5rem]" />
                  {v.logoPath
                    ? <FoodImage path={v.logoPath} name={`${v.name} logo`} width={160} shape="circle" className="absolute -bottom-5 left-4 h-14 w-14 border-4 border-canvas" />
                    : <span aria-hidden="true" className="hand absolute -bottom-5 left-4 flex h-14 w-14 items-center justify-center rounded-full border-4 border-canvas bg-brand text-2xl font-bold text-white">{v.name.trim().charAt(0)}</span>}
                </div>
                <p className="mt-3 font-extrabold group-hover:text-brand">{v.name}</p>
                <p className="text-xs text-muted">{[v.location, v.openingHours].filter(Boolean).join(' · ')}{v.isOpen ? '' : ' · closed now'}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="px-4 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 border-y glass-line px-2 py-10 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <h2 className="headline text-3xl">Hungry already?</h2>
          </div>
          <Link to="/menu" className="btn">Browse today&apos;s menu</Link>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h2 className={`${h2} text-center`}>Questions customers ask</h2>
        <div className="mt-8">
          {faq.map(([q, a]) => (
            <details key={q} className="group border-b glass-line py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between font-extrabold">
                {q}<span className="text-brand transition-transform group-open:rotate-45" aria-hidden="true">+</span>
              </summary>
              <p className="mt-2 text-sm text-muted">{a}</p>
            </details>
          ))}
        </div>
      </section>
      <ForHotels menu={menu} site={site} />
    </>
  )
}

/* Deals: weekend offers and dinners ---------------------------------------------------------- */
function useAllOffers() {
  return useLoad(async () => {
    if (!supabase) return []
    const from = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    const { data, error } = await supabase.from('offers').select('*').eq('isPublished', true).gte('eventDate', from).order('eventDate').limit(40)
    if (error) throw error
    return (data ?? []) as Offer[]
  }, [] as Offer[])
}

export function Deals() {
  const { data: menu } = usePublicMenu()
  const { data: offers, loading } = useAllOffers()
  useEffect(() => setTitle('Deals and Dinners', 'This week’s meal deals and dinner offers from verified hotels around Kisii University. Prices set by the hotels themselves, paid by M-PESA, delivered to your hostel.'), [])
  const hotel = (id: string | null) => (id ? menu.vendors.find((v) => v.id === id)?.name : null) ?? 'Every campus hotel'
  return (
    <>
      <PageHero title="Deals and dinners" crumb="Deals">Weekend specials and dinner nights from campus hotels.</PageHero>
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        {!loading && offers.length === 0 ? (
          <div className="flex flex-col items-center text-center"><PlateDrawing className="h-24 w-24 text-ink" /></div>
        ) : (
          <div className="grid gap-x-8 gap-y-12" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(16rem, 100%), 1fr))' }}>
            {offers.map((o) => {
              const d = dayMonth(o.eventDate)
              const dish = o.menuItemId ? menu.items.find((i) => i.id === o.menuItemId) : undefined
              return (
                <Link key={o.id} to={`/deals/${o.id}`} className="group flex flex-col gap-3">
                  <div className="relative">
                    <FoodImage path={o.imagePath ?? dish?.imagePath} name={o.title} width={600} className="aspect-[4/3] w-full !rounded-[1.5rem]" />
                    <span className="absolute left-3 top-3 flex flex-col items-center rounded-2xl bg-canvas/90 px-3 py-1.5">
                      <span className="headline text-2xl leading-none">{d.day}</span><span className="text-[0.6rem] font-bold uppercase">{d.month.slice(0, 3)}</span>
                    </span>
                  </div>
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-brand">{hotel(o.vendorId)}</p>
                  <p className="font-extrabold group-hover:text-brand">{o.title}</p>
                  {o.body ? <p className="line-clamp-2 text-sm text-muted">{o.body}</p> : null}
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </>
  )
}

export function DealDetail() {
  const { id = '' } = useParams()
  const { data: menu } = usePublicMenu()
  const { data: offer, loading } = useLoad(async () => {
    if (!supabase) return null
    const { data, error } = await supabase.from('offers').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    return data as Offer | null
  }, null as Offer | null, [id])
  useEffect(() => setTitle(offer?.title ?? 'Deal'), [offer])
  if (loading && !offer) return <p className="px-4 py-24 text-center text-muted">Loading…</p>
  if (!offer) return <NotFoundPage />
  const d = dayMonth(offer.eventDate)
  const vendor = offer.vendorId ? menu.vendors.find((v) => v.id === offer.vendorId) : undefined
  const dish = offer.menuItemId ? menu.items.find((i) => i.id === offer.menuItemId) : undefined
  return (
    <>
      <PageHero title={offer.title} crumb="Deals">{vendor?.name ?? 'Every campus hotel'} · {d.day} {d.month}</PageHero>
      <section className="mx-auto grid max-w-6xl items-start gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.2fr_1fr]">
        <FoodImage path={offer.imagePath ?? dish?.imagePath} name={offer.title} width={1000} className="aspect-[4/3] w-full !rounded-[2rem]" />
        <div className="flex flex-col gap-5">
          <p className="hand text-2xl text-brand">{d.day} {d.month}</p>
          {offer.body ? <p className="text-sm">{offer.body}</p> : null}
          {vendor ? (
            <Link to={`/menu?hotel=${vendor.slug}`} className="flex items-center gap-3 hover:text-brand">
              <FoodImage path={vendor.logoPath} name={vendor.name} width={120} shape="circle" className="h-11 w-11" />
              <span><span className="block font-extrabold">{vendor.name}</span><span className="text-xs text-muted">{vendor.location}</span></span>
            </Link>
          ) : null}
          {dish ? (
            <Link to={`/menu?dish=${dish.id}`} className="flex items-center gap-3 border-t glass-line pt-4 hover:text-brand">
              <FoodImage path={dish.imagePath} name={dish.name} width={160} className="h-16 w-16 !rounded-xl" />
              <span><span className="block font-extrabold">{dish.name}</span><span className="text-xs text-muted">{kes(dish.price)}</span></span>
            </Link>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Link to={dish ? `/menu?dish=${dish.id}` : vendor ? `/menu?hotel=${vendor.slug}` : '/menu'} className="btn">Order this deal</Link>
            <Link to="/deals" className="btn btn-ghost">More deals</Link>
          </div>
        </div>
      </section>
    </>
  )
}

/* Contact ----------------------------------------------------------------------------------- */
export function Contact() {
  const { data: menu } = usePublicMenu()
  const { data: site } = useSiteImages()
  const { data: settings } = useSettings()
  useEffect(() => setTitle('Contact Us', 'Talk to Campus Food in Kisii: call Amani, our receptionist, message us on WhatsApp, or ask for a call-back. Help with orders, payments, refunds, hotels and riders.'), [])
  const wa = whatsappLink('Hi Campus Food', settings.whatsappNumber ?? undefined)
  // Phone, email and WhatsApp come from Settings in the staff portal; a row appears once it is filled in.
  const reach: [string, ReactNode, string][] = []
  if (settings.supportPhone) reach.push(['Call us', <a className="link" href={`tel:${settings.supportPhone}`}>{settings.supportPhone}</a>, 'Fastest for a late or wrong order.'])
  if (wa) reach.push(['WhatsApp', <a className="link" href={wa} target="_blank" rel="noopener noreferrer">Chat with the team</a>, 'Send your order number and a photo if something is off.'])
  if (settings.supportEmail) reach.push(['Email', <a className="link" href={`mailto:${settings.supportEmail}`}>{settings.supportEmail}</a>, 'Receipts, refunds and account questions. Reply within one working day.'])
  const facts: [string, ReactNode][] = [
    ['Service hours', settings.serviceHours],
    ['Where we deliver', 'Campus hostels, offices and gates, and nearby Kisii town addresses served by our verified hotels.'],
    ['Order problems', <>Have your order number ready (it is on your receipt). Refunds are open for {settings.refundWindowMinutes} minutes after payment, before the kitchen starts cooking.</>],
    ['Hotels and restaurants', 'Want your kitchen on Campus Food? Tell us your hotel name, location and M-Pesa Paybill or Till; our team registers and verifies every hotel.'],
    ['Payments', 'You pay the hotel directly through M-Pesa. We never ask for your M-Pesa PIN or sign-in code.'],
  ]
  return (
    <>
      <PageHero title="Contact us" crumb="Contact">Late plate, wrong order, a refund, or your hotel wants in: here is how to reach the Campus Food team.</PageHero>
      {reach.length ? (
        <section className="mx-auto grid max-w-6xl gap-8 px-4 pt-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
          {reach.map(([k, v, note]) => (
            <div key={k}>
              <Stroke seed={k} className="mb-2.5" />
              <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.14em] text-muted">{k}</p>
              <p className="mt-1 text-base font-bold">{v}</p>
              <p className="mt-1 text-sm text-muted">{note}</p>
            </div>
          ))}
        </section>
      ) : null}
      <section className="mx-auto grid max-w-6xl gap-x-10 gap-y-8 px-4 pt-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
        {facts.map(([k, v]) => (
          <div key={k} className="border-t glass-line pt-3">
            <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.14em] text-brand">{k}</p>
            <p className="mt-1 text-sm">{v}</p>
          </div>
        ))}
      </section>
      <FeedbackSection menu={menu} site={site} />
    </>
  )
}

/* Legal ------------------------------------------------------------------------------------- */
function Legal({ title, crumb, updated, sections }: { title: string; crumb: string; updated: string; sections: [string, ReactNode][] }) {
  useEffect(() => setTitle(title), [title])
  return (
    <>
      <PageHero title={title} crumb={crumb}>Last updated {updated}</PageHero>
      <article className="mx-auto max-w-3xl px-4 py-14 text-sm leading-relaxed sm:px-6">
        {sections.map(([h, body]) => (
          <section key={h} className="mt-8 first:mt-0">
            <h2 className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand">{h}</h2>
            <div className="mt-2 flex flex-col gap-2 text-ink/90">{body}</div>
          </section>
        ))}
      </article>
    </>
  )
}

export function Privacy() {
  const { data: s } = useSettings()
  return (
    <Legal title="Privacy policy" crumb="Privacy" updated="22 November 2026" sections={[
      ['Who we are', <p key="a">Campus Food runs an ordering platform that connects students, staff and visitors with verified hotels around campus. We handle your information under the Kenya Data Protection Act, 2019.</p>],
      ['What we collect', <ul key="b" className="list-disc pl-5"><li>Your name, email, M-Pesa phone number and delivery address (hostel, office or room), which you give when you sign up or order.</li><li>Your orders: items, delivery location, status changes and receipts.</li><li>Payment records from M-Pesa: amount, receipt number and result. We never see or store your M-Pesa PIN.</li><li>Feedback you send, and a profile photo if you choose to add one.</li></ul>],
      ['Why we use it', <ul key="c" className="list-disc pl-5"><li>To place your order with the hotel, take payment and deliver it.</li><li>To send order updates and receipts by SMS, WhatsApp (if you opt in) and email.</li><li>To handle refunds, disputes and support requests.</li><li>To keep accounting records and prevent fraud.</li></ul>],
      ['Who sees it', <p key="d">The hotel you order from sees your name, phone, delivery location and order. The assigned rider sees what they need to deliver. Our finance and support staff see only what their job needs. Service providers process data for us: Supabase (database and storage), Safaricom M-Pesa (payments), Africa’s Talking (SMS), Meta WhatsApp (optional messages) and Resend (email). We do not sell your data.</p>],
      ['How long we keep it', <p key="e">Unpaid draft orders are deleted after {Math.round(s.draftLifetimeMinutes / 60)} hours. Paid orders and payment records are kept as long as the law requires for financial records.</p>],
      ['Your rights', <p key="f">You can ask to see, correct or delete your personal data, or object to how we use it. Change your name, phone, delivery address and message choices under Account. For anything else, contact us{s.supportEmail ? <> at <a className="link" href={`mailto:${s.supportEmail}`}>{s.supportEmail}</a></> : null}.</p>],
      ['Security', <p key="g">Every record is protected by access rules in the database; staff accounts need two-step sign-in; payment results are accepted only from M-Pesa. We will never ask for your password, PIN or sign-in code.</p>],
    ]} />
  )
}

export function Terms() {
  const { data: s } = useSettings()
  return (
    <Legal title="Terms and conditions" crumb="Terms" updated="22 November 2026" sections={[
      ['The service', <p key="a">Campus Food lets you order food from verified campus hotels and pay them through M-Pesa. Each hotel prepares its own food and is responsible for it.</p>],
      ['Prices and fees', <p key="b">Food prices are set by each hotel and confirmed when you place the order. We add a flat platform fee of KES {shortKes(s.platformFee)} per order and a delivery fee for your area. The full breakdown is shown before you pay.</p>],
      ['Payment', <p key="c">You pay the hotel directly through an M-Pesa prompt. An order counts as paid only when M-Pesa confirms the payment. One order is paid to one hotel.</p>],
      ['Cancellations and refunds', <p key="d">You may cancel an unpaid order at any time. After paying, you may ask for a refund within {s.refundWindowMinutes} minutes, before the hotel starts preparing. If a hotel rejects your order, you are refunded in full. Approved refunds are reversed to your M-Pesa by the hotel.</p>],
      ['Delivery', <p key="e">Delivery times are estimates and update as the hotel and rider progress. Please be reachable on the phone number you gave.</p>],
      ['Your account', <p key="f">Keep your sign-in details private. You must give a working phone number and accurate delivery details. We may suspend accounts used for fraud or abuse.</p>],
      ['Hotels', <p key="g">Hotels are registered and verified by Campus Food before they can sell. They manage their own menus, prices, photos and availability.</p>],
      ['Contact', <p key="h">Questions about these terms: {s.supportEmail ? <a className="link" href={`mailto:${s.supportEmail}`}>{s.supportEmail}</a> : <Link to="/contact" className="link">contact us</Link>}.</p>],
    ]} />
  )
}

/* 404 --------------------------------------------------------------------------------------- */
export function NotFoundPage() {
  useEffect(() => setTitle('Page not found'), [])
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center px-6 py-24 text-center">
      <p className="headline text-7xl text-brand">404</p>
      <PlateDrawing className="mt-2 h-24 w-24 text-ink" />
      <h1 className="headline mt-4 text-3xl">Oops! Plate not found</h1>
      <p className="mt-2 text-sm text-muted">That page is not on the menu. The food still is.</p>
      <div className="mt-6 flex gap-3"><Link to="/" className="btn">Return home</Link><Link to="/menu" className="btn btn-ghost">See the menu</Link></div>
    </section>
  )
}
