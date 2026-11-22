import { useEffect, useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

/**
 * The workspace sidebar (hotel dashboard and admin portal): a narrow rail of icons with short labels,
 * the active page filled with the theme colour, a thin vertical line on its right. On phones it becomes
 * a scrolling row under the navbar.
 */
export type RailItem = { to: string; label: string; icon: ReactNode; end?: boolean }

export function SideRail({ items, groups, label }: { items?: RailItem[]; groups?: RailItem[][]; label: string }) {
  const sets = groups ?? [items ?? []]
  const link = ({ isActive }: { isActive: boolean }) =>
    `group flex shrink-0 flex-col items-center gap-0.5 rounded-lg px-1 py-1 text-center text-[0.55rem] font-bold leading-tight transition-colors lg:w-full lg:gap-1 lg:rounded-xl lg:px-1.5 lg:py-2 lg:text-[0.65rem] ${
      isActive ? 'bg-brand text-white' : 'text-ink/75 hover:bg-ink/5 hover:text-brand'}`
  // Sit right under the app header, whose height changes with the action bar under it.
  const [top, setTop] = useState(52)
  useEffect(() => {
    const el = document.querySelector('[data-app-header]')
    if (!el) return
    const ro = new ResizeObserver(() => setTop(Math.round(el.getBoundingClientRect().height)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <nav aria-label={label} style={{ top, ['--rail-top' as string]: `${top}px` }}
      className="no-scrollbar sticky z-40 flex gap-1 overflow-x-auto border-b glass-line bg-canvas/95 px-1.5 py-1 backdrop-blur
                 lg:fixed lg:bottom-0 lg:left-0 lg:w-[5.5rem] lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-r lg:px-2 lg:py-3">
      {sets.map((set, g) => (
        <div key={g} className={`flex gap-1 lg:flex-col ${g ? 'border-l glass-line pl-1 lg:mt-2 lg:border-l-0 lg:border-t lg:pl-0 lg:pt-2' : ''}`}>
          {set.map((it) => (
            <NavLink key={it.to} to={it.to} end={it.end} className={link} title={it.label}>
              <span className="flex h-5 w-5 items-center justify-center lg:h-6 lg:w-6">{it.icon}</span>
              <span className="w-12 truncate lg:w-auto lg:whitespace-normal">{it.label}</span>
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  )
}

/* Line icons for the rail (stroke follows the text colour, so they turn white on the active item). */
const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
const I = (d: ReactNode) => <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">{d}</svg>
export const RailIcons = {
  home: I(<><path d="M4 11 12 4l8 7" {...s} /><path d="M6 10v10h12V10" {...s} /></>),
  orders: I(<><path d="M5 4h14v16l-3-2-2 2-2-2-2 2-2-2-3 2z" {...s} /><path d="M9 9h6M9 13h6" {...s} /></>),
  dishes: I(<><circle cx="12" cy="13" r="6.5" {...s} /><path d="M4 7h16M12 4v3" {...s} /></>),
  sales: I(<><path d="M4 20h16" {...s} /><path d="M7 16v-5M12 16V7M17 16v-8" {...s} /></>),
  mpesa: I(<><rect x="6" y="3" width="12" height="18" rx="2.5" {...s} /><path d="M10 17h4" {...s} /></>),
  staff: I(<><circle cx="9" cy="9" r="3" {...s} /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" {...s} /><circle cx="17" cy="10" r="2.3" {...s} /><path d="M15.5 19a4.5 4.5 0 0 1 5.5-4.3" {...s} /></>),
  offers: I(<><path d="M4 12 12 4h7v7l-8 8z" {...s} /><circle cx="15.5" cy="8.5" r="1.2" fill="currentColor" /></>),
  refunds: I(<><path d="M8 7H4v4" {...s} /><path d="M4.5 11A8 8 0 1 0 7 6" {...s} /></>),
  payments: I(<><rect x="3" y="6" width="18" height="12" rx="2" {...s} /><path d="M3 10h18" {...s} /></>),
  finance: I(<><circle cx="12" cy="12" r="8" {...s} /><path d="M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.4 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1 0-2-.5-2.5-1.5M12 6.5V8M12 16v1.5" {...s} /></>),
  hotels: I(<><path d="M4 20V8l8-4 8 4v12" {...s} /><path d="M9 20v-5h6v5" {...s} /></>),
  people: I(<><circle cx="12" cy="8" r="3.5" {...s} /><path d="M5 20a7 7 0 0 1 14 0" {...s} /></>),
  settings: I(<><circle cx="12" cy="12" r="3" {...s} /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" {...s} /></>),
  content: I(<><rect x="4" y="4" width="16" height="16" rx="2" {...s} /><path d="M8 9h8M8 13h8M8 17h5" {...s} /></>),
  images: I(<><rect x="3.5" y="5" width="17" height="14" rx="2" {...s} /><circle cx="9" cy="10" r="1.6" {...s} /><path d="m4 17 5-4 4 3 3-2 4 3" {...s} /></>),
  phone: I(<path d="M6 4h3l1.5 4-2 1.3a10 10 0 0 0 6.2 6.2l1.3-2 4 1.5v3a1.6 1.6 0 0 1-1.7 1.6A15.5 15.5 0 0 1 4.4 5.7 1.6 1.6 0 0 1 6 4z" {...s} />),
  answers: I(<><path d="M4 5h16v11H9l-5 4z" {...s} /><path d="M10 9.5a2 2 0 1 1 2.5 2c-.4.1-.5.4-.5.8" {...s} /></>),
  feedback: I(<path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.4l-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z" {...s} />),
  audit: I(<><path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6z" {...s} /><path d="m9 12 2 2 4-4" {...s} /></>),
}
