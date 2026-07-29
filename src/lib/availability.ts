import { getSupabase } from './supabase'
import { localIsoDay } from './dates'

// Public-side availability lookup for the quote form. Reached only via dynamic
// import so supabase-js stays out of the public entry chunk. Returning null
// (unconfigured or any failure) means the form keeps its default behavior.

export interface Availability {
  /** ISO yyyy-mm-dd days the admin blocked — today onward only. */
  blocked: string[]
  /** ISO yyyy-mm-dd days already at order capacity (from the date_load RPC). */
  full: string[]
  maxOrdersPerDay: number
  minLeadDays: number
  pickupSlots: string[]
  vacationNote: string
}

export async function fetchAvailability(): Promise<Availability | null> {
  const sb = getSupabase()
  if (!sb) return null
  try {
    const today = localIsoDay()
    const [blockedRes, settingsRes, loadRes] = await Promise.all([
      sb.from('blocked_dates').select('day').gte('day', today).order('day', { ascending: true }),
      sb.from('shop_settings').select('*').eq('id', 1).maybeSingle(),
      // date_load exists from migration 0007 — treat errors as "no data".
      sb.rpc('date_load'),
    ])
    if (blockedRes.error || settingsRes.error) return null
    const s = (settingsRes.data ?? null) as Record<string, unknown> | null
    const maxOrdersPerDay = (s?.max_orders_per_day as number) ?? 3
    const load = loadRes.error ? [] : ((loadRes.data ?? []) as { day: string; cnt: number }[])
    return {
      blocked: ((blockedRes.data ?? []) as Record<string, unknown>[]).map((r) => r.day as string),
      full: load.filter((r) => Number(r.cnt) >= maxOrdersPerDay).map((r) => r.day),
      maxOrdersPerDay,
      minLeadDays: (s?.min_lead_days as number) ?? 7,
      pickupSlots: ((s?.pickup_slots as string[]) ?? []).filter((slot) => slot.trim() !== ''),
      vacationNote: (s?.vacation_note as string) ?? '',
    }
  } catch {
    return null
  }
}
