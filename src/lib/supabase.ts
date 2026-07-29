import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// The site works with ZERO config: when these env vars are absent the public
// site simply runs on its bundled seed content and the admin shows a setup
// screen. Nothing here is imported by the public entry chunk directly — it is
// reached only via dynamic import (content hydration) or the lazy admin chunk,
// so the public bundle stays free of supabase-js until it is actually needed.

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && anon)

let client: SupabaseClient | null = null

/** Returns a singleton Supabase client, or null when not configured. */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null
  if (!client) {
    client = createClient(url as string, anon as string, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  }
  return client
}

// Storage bucket names (created by the migration).
export const BUCKET_CAKES = 'cakes'
export const BUCKET_SHOWCASE = 'showcase'
