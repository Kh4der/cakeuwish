import { getSupabase } from './supabase'
import type { PriceLine } from '../data/pricing'

// Live pricing rows for the pricing page (admin-editable in /admin → Pricing).
// Reached only via dynamic import; null → the page keeps its bundled fallback.

export interface LivePricing {
  starting: PriceLine[]
  addons: PriceLine[]
}

export async function fetchPricing(): Promise<LivePricing | null> {
  const sb = getSupabase()
  if (!sb) return null
  try {
    const { data, error } = await sb
      .from('pricing_items')
      .select('section,item,detail,price')
      .eq('visible', true)
      .order('sort_order', { ascending: true })
    if (error || !data || data.length === 0) return null
    const rows = data as { section: string; item: string; detail: string; price: string | null }[]
    const toLine = (r: (typeof rows)[number]): PriceLine => ({ item: r.item, detail: r.detail, price: r.price })
    return {
      starting: rows.filter((r) => r.section === 'starting').map(toLine),
      addons: rows.filter((r) => r.section === 'addon').map(toLine),
    }
  } catch {
    return null
  }
}
