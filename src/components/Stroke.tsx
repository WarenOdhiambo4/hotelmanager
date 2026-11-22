import { useEffect, useRef, useState } from 'react'

/*
 * A hand-drawn brush line in place of a straight rule, in the manner of the Odoo site's marker strokes:
 * slightly wavy, round-capped, a little thicker in the middle, and drawn in from the left the first
 * time it scrolls into view. Each stroke picks one of several shapes from its seed, so a row of them
 * looks drawn by hand rather than stamped.
 */
const SHAPES = [
  'M3 8 C 48 4, 96 10, 150 6 S 236 3, 297 7',
  'M3 6 C 62 10, 118 3, 172 7 S 254 10, 297 5',
  'M3 7 C 40 3, 104 9, 158 5 S 248 8, 297 4',
  'M3 5 C 70 8, 128 4, 186 8 S 262 4, 297 7',
  'M3 8 C 56 5, 112 8, 164 4 S 244 7, 297 6',
]

function pick(seed: string | number | undefined) {
  const s = String(seed ?? '')
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return SHAPES[h % SHAPES.length]!
}

export function Stroke({ color = 'var(--color-brand)', seed, className = '', thick = 3 }: { color?: string; seed?: string | number; className?: string; thick?: number }) {
  const ref = useRef<SVGSVGElement>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || seen) return
    if (!('IntersectionObserver' in window)) { setSeen(true); return }
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) { setSeen(true); io.disconnect() } }, { rootMargin: '0px 0px -10% 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [seen])
  return (
    <svg ref={ref} viewBox="0 0 300 12" preserveAspectRatio="none" aria-hidden="true" className={`block h-2.5 w-full overflow-visible ${className}`}>
      <path pathLength={1} className={seen ? 'draw' : 'stroke-wait'} d={pick(seed)} fill="none" stroke={color} strokeWidth={thick} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
