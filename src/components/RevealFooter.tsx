import { Link } from 'react-router-dom'
import { usePublicMenu, useSettings } from '../lib/data'
import { whatsappLink } from '../lib/site'
import { FoodImage } from './FoodImage'
import { Logo } from './Logo'
import { ThemePicker } from './ThemePicker'

/**
 * Revealing footer (COMPLIANCE365 technique): the content is fixed to the bottom of the viewport but
 * clipped to the footer's own box, so scrolling to the end uncovers it in place. A bright band of
 * dish names and photos from the live menu scrolls across the top of it.
 */
export function RevealFooter() {
  const { data: menu } = usePublicMenu()
  const { data: settings } = useSettings()
  const year = new Date().getFullYear()
  const band = (menu.items.length ? menu.items.slice(0, 8) : [
    { id: 'a', name: 'Pilau', imagePath: null }, { id: 'b', name: 'Chapati', imagePath: null },
    { id: 'c', name: 'Burgers', imagePath: null }, { id: 'd', name: 'Chai', imagePath: null },
  ]) as { id: string; name: string; imagePath: string | null }[]
  const wa = whatsappLink('Hi Campus Food', settings.whatsappNumber ?? undefined)
  const head = 'text-xs font-extrabold uppercase tracking-[0.16em]'
  const link = 'text-muted transition-colors hover:text-brand'

  return (
    <footer className="relative h-[60rem] sm:h-[44rem] lg:h-[34rem] no-print" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' }}>
      <div className="fixed bottom-0 left-0 flex h-[60rem] w-full flex-col border-t glass-line bg-canvas sm:h-[44rem] lg:h-[34rem]">
        <div className="overflow-hidden border-b glass-line py-3" aria-hidden="true">
          <div className="marquee flex items-center gap-8" style={{ ['--marquee-speed' as string]: '45s' }}>
            {[...band, ...band, ...band, ...band].map((i, n) => (
              <span key={`${i.id}-${n}`} className="flex items-center gap-8">
                <span className="headline text-2xl sm:text-3xl">{i.name}</span>
                <FoodImage path={i.imagePath} name={i.name} width={160} shape="circle" className="h-10 w-10 sm:h-12 sm:w-12" />
              </span>
            ))}
          </div>
        </div>
        <div className="mx-auto grid w-full max-w-7xl flex-1 content-center gap-x-12 gap-y-10 px-6 py-10 text-sm sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1.3fr]">
          <section>
            <Logo />
            <p className="mt-4 max-w-xs text-muted">{settings.heroTagline}</p>
          </section>
          <nav aria-label="Footer">
            <h2 className={head}>Campus Food</h2>
            <ul className="mt-4 flex flex-col gap-2">
              <li><Link to="/" className={link}>Home</Link></li>
              <li><Link to="/menu" className={link}>Menu</Link></li>
              <li><Link to="/orders" className={link}>Track an order</Link></li>
              <li><Link to="/deals" className={link}>Deals and dinners</Link></li>
              <li><Link to="/about" className={link}>About</Link></li>
              <li><Link to="/contact" className={link}>Contact</Link></li>
              <li><Link to="/privacy" className={link}>Privacy</Link> · <Link to="/terms" className={link}>Terms</Link></li>
            </ul>
          </nav>
          <section>
            <h2 className={head}>Service hours</h2>
            <p className="mt-4 text-muted">{settings.serviceHours}</p>
            <ul className="mt-4 flex flex-col gap-2">
              {settings.supportPhone ? <li><a className={link} href={`tel:${settings.supportPhone}`}>{settings.supportPhone}</a></li> : null}
              {settings.supportEmail ? <li><a className={link} href={`mailto:${settings.supportEmail}`}>{settings.supportEmail}</a></li> : null}
              {wa ? <li><a className={link} href={wa} target="_blank" rel="noopener noreferrer">Chat on WhatsApp</a></li> : null}
            </ul>
          </section>
          <section>
            <h2 className={head}>Make it yours</h2>
            
            <div><ThemePicker compact /></div>
          </section>
        </div>
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-1 border-t glass-line px-6 py-5 text-xs text-muted sm:flex-row sm:justify-between">
          <p>© {year} Campus Food. Payments go straight to each hotel through M-Pesa.</p>
          <p>We never ask for your M-Pesa PIN or sign-in code.</p>
        </div>
      </div>
    </footer>
  )
}
