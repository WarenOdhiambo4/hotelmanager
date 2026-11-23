import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()

export const supabaseConfigured = Boolean(url && anonKey)

/**
 * Browser client with the publishable key only. Every query is limited by Postgres
 * row-level security; payments are marked paid only by Edge Functions.
 */
export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(url!, anonKey!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null

/** Whether a sign-in provider (such as Google) is switched on for this Supabase project. */
export async function authProviderEnabled(provider: 'google'): Promise<boolean> {
  if (!url || !anonKey) return false
  try {
    const r = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: anonKey } })
    if (!r.ok) return false
    const s = (await r.json()) as { external?: Record<string, boolean> }
    return Boolean(s.external?.[provider])
  } catch {
    return false
  }
}

// Function parameters were declared without quotes (pLimit), so Postgres stores them lowercase (plimit).
// Every RPC call goes through here, so code keeps camelCase names and the database receives lowercase ones.
if (supabase) {
  const rpc = supabase.rpc.bind(supabase)
  ;(supabase as { rpc: unknown }).rpc = (fn: string, args?: Record<string, unknown>, options?: unknown) =>
    rpc(fn, args ? Object.fromEntries(Object.entries(args).map(([k, v]) => [k.toLowerCase(), v])) : args, options as never)
}

export function db(): SupabaseClient {
  if (!supabase) throw new Error('Campus Food is not connected yet. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  return supabase
}

/** Words that only make sense to a developer: setting names, database terms, code errors, addresses. */
const TECHNICAL = /[A-Z][A-Z0-9]+_[A-Z0-9_]+|\b[a-z]+_[a-z0-9_]+\b|is not set|not configured|violates|constraint|\bcolumn\b|\brelation\b|null value|syntax|duplicate key|PGRST|non-2xx|edge function|status code|\bHTTP\b|undefined|\bnull\b|TypeError|ReferenceError|SyntaxError|unexpected|\bJSON\b|\bstack\b|internal|exception|\bfunction\b|\bsql\b|\bfetch\b|ECONN|[{}<>]|https?:\/\/|supabase|daraja|passkey|\btoken\b|secret|api key|webhook|n8n/i
export const SOMETHING_WRONG = 'Something went wrong on our side. Please try again in a minute.'

/**
 * Turns any error into a sentence a customer can act on. Our own database messages are already written for people
 * and pass through; anything technical is replaced with a plain sentence and logged to the console for us instead.
 */
export function friendly(error: unknown): string {
  const msg = (typeof error === 'object' && error && 'message' in error ? String((error as { message: unknown }).message) : String(error ?? '')).replace(/^.*?ERROR:\s*/, '').trim()
  if (/Failed to fetch|NetworkError|network|Load failed|timed? ?out/i.test(msg)) return 'No connection. Check your data or Wi-Fi and try again.'
  if (/JWT|session|refresh token|not authenticated/i.test(msg)) return 'Your session has ended. Sign in again.'
  if (/permission denied|row-level security|not allowed|forbidden/i.test(msg)) return 'You do not have access to that.'
  if (/too many|rate limit/i.test(msg)) return 'Too many tries. Wait a minute, then try again.'
  if (/duplicate|already exists|unique/i.test(msg)) return 'That already exists.'
  if (!msg || msg.length > 200 || TECHNICAL.test(msg)) {
    if (msg) console.error('Campus Food error (hidden from the page):', msg)
    return SOMETHING_WRONG
  }
  return msg
}

/** Calls a Campus Food database function and throws a friendly message on failure. */
export async function rpc<T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await db().rpc(name, args)
  if (error) throw new Error(friendly(error))
  return data as T
}

/** Calls an Edge Function with the signed-in user's session. */
export async function callFunction<T = unknown>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await db().functions.invoke(name, { body })
  if (error) {
    let message = error.message
    try {
      const ctx = (error as { context?: Response }).context
      const parsed = ctx ? await ctx.json() : null
      if (parsed?.error) message = parsed.error
    } catch { /* keep the default message */ }
    throw new Error(friendly({ message }))
  }
  return data as T
}

/**
 * Public URL of an image in the "media" Storage bucket (S3-compatible): dishes, hotel logos and
 * covers, categories, zones, people, offers and site photos. Plain object URLs only: Supabase image
 * resizing ("render/image") is a paid feature and answers 403 on this plan, which hid every photo.
 */
export function mediaUrl(path?: string | null, _width?: number): string | null {
  if (!path || !supabase) return null
  if (/^https?:\/\//.test(path)) return path
  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl
}

/**
 * Makes a photo light before upload (pages stay fast on slow phones): anything wider or taller than 1600 px, or
 * heavier than 350 kB, is redrawn at most 1600 px on its long side and saved as WebP. Falls back to the original
 * when the browser cannot encode WebP, or when the result would not be smaller.
 */
async function lighten(file: File, maxSide = 1600, maxBytes = 350 * 1024): Promise<File> {
  if (typeof createImageBitmap !== 'function') return file
  let bitmap: ImageBitmap
  try { bitmap = await createImageBitmap(file) } catch { return file }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  if (scale === 1 && file.size <= maxBytes) { bitmap.close(); return file }
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/webp', 0.8))
  if (!blob || blob.type !== 'image/webp' || blob.size >= file.size) return file
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.webp', { type: 'image/webp' })
}

/** Uploads an image to media/<folder>/<random>.<ext> and returns its storage path. */
export async function uploadImage(folder: string, original: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp|avif)$/.test(original.type)) throw new Error('Use a JPG, PNG, WebP or AVIF image.')
  if (original.size > 5 * 1024 * 1024) throw new Error('Images must be 5 MB or smaller.')
  const file = await lighten(original)
  const ext = file.type.split('/')[1]!.replace('jpeg', 'jpg')
  const path = `${folder}/${crypto.randomUUID()}.${ext}`
  const { error } = await db().storage.from('media').upload(path, file, { cacheControl: '31536000', upsert: false, contentType: file.type })
  if (error) throw new Error(friendly(error))
  return path
}
