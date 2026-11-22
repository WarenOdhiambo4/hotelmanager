import { useState } from 'react'
import { mediaUrl } from '../lib/supabase'
import { DishDrawing } from './Drawings'

/**
 * A dish photo from Supabase Storage. When there is no photo yet (or it fails to load) the dish
 * is drawn instead, on a warm wash, so the layout never shows a broken image.
 */
export function FoodImage({ path, name, className = '', width = 640, shape = 'soft' }: {
  path: string | null | undefined
  name: string
  className?: string
  width?: number
  shape?: 'soft' | 'circle' | 'arch' | 'flower' | 'none'
}) {
  const [failed, setFailed] = useState(false)
  const src = failed ? null : mediaUrl(path, width)
  const frame = shape === 'circle' ? 'rounded-full' : shape === 'arch' ? 'arch' : shape === 'flower' ? 'flower' : shape === 'soft' ? 'soft' : ''
  if (!src) {
    return (
      <div className={`${frame} ${className} flex items-center justify-center overflow-hidden bg-ink/5 text-ink`} role="img" aria-label={name}>
        <DishDrawing name={name} className="h-3/5 w-3/5" />
      </div>
    )
  }
  return <img src={src} alt={name} loading="lazy" decoding="async" onError={() => setFailed(true)} className={`${frame} ${className} bg-ink/5 object-cover`} />
}
