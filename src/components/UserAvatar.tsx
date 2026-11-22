import { useState } from 'react'
import { mediaUrl } from '../lib/supabase'
import { CartoonAvatar } from './Icons'

/** A person's own photo from Storage (profiles/<id>/...), or the cartoon avatar when there is none. */
export function UserAvatar({ path, className = 'h-9 w-9' }: { path?: string | null; className?: string }) {
  const [failed, setFailed] = useState(false)
  const src = failed ? null : mediaUrl(path)
  if (!src) return <CartoonAvatar className={className} />
  return <img src={src} alt="" onError={() => setFailed(true)} className={`${className} rounded-full object-cover`} />
}
