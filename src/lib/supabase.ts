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

/** Turns a Postgres or network error into a sentence a student can act on. */
export function friendly(error: unknown): string {
  const msg = typeof error === 'object' && error && 'message' in error ? String((error as { message: unknown }).message) : String(error ?? '')
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return 'No connection. Check your data or Wi-Fi and try again.'
  if (/JWT|session/i.test(msg)) return 'Your session has ended. Sign in again.'
  if (/permission denied|row-level security/i.test(msg)) return 'You do not have access to that.'
  if (/schema cache|does not exist/i.test(msg)) return 'Campus Food is being set up. Try again shortly.'
  return msg.replace(/^.*?ERROR:\s*/, '') || 'Something went wrong. Try again.'
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

/** Uploads an image to media/<folder>/<random>.<ext> and returns its storage path. */
export async function uploadImage(folder: string, file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp|avif)$/.test(file.type)) throw new Error('Use a JPG, PNG, WebP or AVIF image.')
  if (file.size > 5 * 1024 * 1024) throw new Error('Images must be 5 MB or smaller.')
  const ext = file.type.split('/')[1]!.replace('jpeg', 'jpg')
  const path = `${folder}/${crypto.randomUUID()}.${ext}`
  const { error } = await db().storage.from('media').upload(path, file, { cacheControl: '31536000', upsert: false, contentType: file.type })
  if (error) throw new Error(friendly(error))
  return path
}
