import { getSupabase } from '../../lib/supabase'

// Admin-side CRUD for the availability calendar (blocked_dates + shop_settings).

function sb() {
  const c = getSupabase()
  if (!c) throw new Error('Supabase is not configured')
  return c
}

export interface BlockedDate {
  day: string // ISO yyyy-mm-dd
  reason: string
}

export interface ShopSettings {
  maxOrdersPerDay: number
  minLeadDays: number
  pickupSlots: string[]
  vacationNote: string
}

/** Local-timezone yyyy-mm-dd (toISOString would shift across UTC midnight). */
export function toIsoDay(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export async function listBlockedDates(): Promise<BlockedDate[]> {
  const { data, error } = await sb().from('blocked_dates').select('*').order('day', { ascending: true })
  if (error) throw error
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    day: r.day as string,
    reason: (r.reason as string) ?? '',
  }))
}

export async function blockDate(day: string, reason: string): Promise<void> {
  const { error } = await sb().from('blocked_dates').upsert({ day, reason })
  if (error) throw error
}

export async function unblockDate(day: string): Promise<void> {
  const { error } = await sb().from('blocked_dates').delete().eq('day', day)
  if (error) throw error
}

/** Block every day from start to end inclusive (capped at a year of rows). */
export async function blockRange(start: string, end: string, reason: string): Promise<void> {
  const rows: { day: string; reason: string }[] = []
  const cursor = new Date(`${start}T00:00:00`)
  const stop = new Date(`${end}T00:00:00`)
  while (cursor <= stop && rows.length < 366) {
    rows.push({ day: toIsoDay(cursor), reason })
    cursor.setDate(cursor.getDate() + 1)
  }
  if (rows.length === 0) return
  const { error } = await sb().from('blocked_dates').upsert(rows)
  if (error) throw error
}

export async function getSettings(): Promise<ShopSettings> {
  const { data, error } = await sb().from('shop_settings').select('*').eq('id', 1).maybeSingle()
  if (error) throw error
  const r = (data ?? null) as Record<string, unknown> | null
  return {
    maxOrdersPerDay: (r?.max_orders_per_day as number) ?? 3,
    minLeadDays: (r?.min_lead_days as number) ?? 7,
    pickupSlots: (r?.pickup_slots as string[]) ?? [],
    vacationNote: (r?.vacation_note as string) ?? '',
  }
}

export async function saveSettings(s: ShopSettings): Promise<void> {
  const { error } = await sb().from('shop_settings').upsert({
    id: 1,
    max_orders_per_day: s.maxOrdersPerDay,
    min_lead_days: s.minLeadDays,
    pickup_slots: s.pickupSlots,
    vacation_note: s.vacationNote,
  })
  if (error) throw error
}
