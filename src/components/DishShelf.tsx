import type { ReactNode } from 'react'
import { kes } from '../lib/format'
import type { MenuItem } from '../lib/types'
import { FoodImage } from './FoodImage'

/**
 * Dishes as large photo tiles on a horizontal shelf (swipe on phones, scroll or arrow keys on
 * desktop). Photos stay big and clear. No list rows, no boxed cards, no fixed grid: each tile is
 * a photo with text directly on the canvas under it.
 */
export function DishShelf({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      {title ? <h2 className="px-1 text-xs font-extrabold uppercase tracking-[0.14em] text-muted">{title}</h2> : null}
      <div className="no-scrollbar -mx-4 mt-3 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-2 sm:-mx-6 sm:scroll-px-6 sm:px-6" tabIndex={0} aria-label={title ? `${title} dishes` : 'Dishes'}>
        {children}
      </div>
    </section>
  )
}

export function DishTile({ item, meta, actions, highlight = false, id }: {
  item: MenuItem
  meta?: ReactNode
  actions?: ReactNode
  highlight?: boolean
  id?: string
}) {
  return (
    <article id={id} className="flex w-44 shrink-0 snap-start flex-col sm:w-52">
      <div className="relative">
        <FoodImage path={item.imagePath} name={item.name} width={420} className={`aspect-[5/6] w-full !rounded-[1.25rem] ${item.isAvailable ? '' : 'opacity-50 grayscale'} ${highlight ? 'ring-4 ring-gold' : ''}`} />
        {item.badge ? <span className="flower absolute left-2 top-2 flex h-11 w-11 items-center justify-center bg-canvas/90 p-1 text-center text-[0.5rem] font-extrabold leading-tight">{item.badge}</span> : null}
        {!item.isAvailable ? <span className="absolute bottom-3 left-3 rounded-full bg-ink px-2.5 py-1 text-[0.65rem] font-extrabold uppercase text-canvas">Sold out</span> : null}
      </div>
      <div className="mt-2 flex items-start justify-between gap-2 px-0.5 text-[0.8rem]">
        <div className="min-w-0">
          <p className="truncate font-extrabold">{item.name}</p>
          {meta ? <p className="truncate text-xs text-muted">{meta}</p> : null}
        </div>
        <p className="shrink-0 text-right font-extrabold">
          {item.previousPrice ? <s className="block text-[0.7rem] font-semibold text-muted">{kes(item.previousPrice)}</s> : null}
          {kes(item.price)}
        </p>
      </div>
      {item.description ? <p className="mt-0.5 line-clamp-1 px-0.5 text-[0.7rem] text-muted">{item.description}</p> : null}
      {actions ? <div className="mt-2 flex flex-wrap items-center gap-2 px-0.5">{actions}</div> : null}
    </article>
  )
}
