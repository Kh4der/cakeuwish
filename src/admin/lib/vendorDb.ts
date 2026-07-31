import { getSupabase } from '../../lib/supabase'
import { fileToWebp } from '../../lib/image'

// Vendor / expense ledger (vendor_payments table) — admin-only records.

export interface VendorPayment {
  id: string
  /** ISO yyyy-mm-dd */
  paidOn: string
  vendor: string
  category: string
  amount: number
  method: string
  note: string
  /** storage path inside the private receipts bucket ('' = none) */
  receiptUrl: string
}

export const PAYMENT_CATEGORIES = ['Ingredients', 'Packaging', 'Equipment', 'Marketing', 'Software & hosting', 'Other']
export const PAYMENT_METHODS = ['Cash', 'Zelle', 'PayPal', 'Card', 'Other']

function sb() {
  const c = getSupabase()
  if (!c) throw new Error('Supabase is not configured')
  return c
}

function rowToPayment(r: Record<string, unknown>): VendorPayment {
  const amount = Number(r.amount)
  return {
    id: r.id as string,
    paidOn: (r.paid_on as string) ?? '',
    vendor: (r.vendor as string) ?? '',
    category: (r.category as string) ?? '',
    amount: Number.isFinite(amount) ? amount : 0,
    method: (r.method as string) ?? '',
    note: (r.note as string) ?? '',
    receiptUrl: (r.receipt_url as string) ?? '',
  }
}

export async function listVendorPayments(): Promise<VendorPayment[]> {
  const { data, error } = await sb()
    .from('vendor_payments')
    .select('*')
    .order('paid_on', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(rowToPayment)
}

export async function saveVendorPayment(p: VendorPayment): Promise<void> {
  const { error } = await sb().from('vendor_payments').upsert({
    id: p.id,
    paid_on: p.paidOn,
    vendor: p.vendor,
    category: p.category,
    amount: p.amount,
    method: p.method,
    note: p.note,
    receipt_url: p.receiptUrl,
  })
  if (error) throw error
}

export async function deleteVendorPayment(id: string): Promise<void> {
  const { error } = await sb().from('vendor_payments').delete().eq('id', id)
  if (error) throw error
}

// ---- receipts (private bucket — paths in DB, signed URLs to view) ----

export async function uploadReceipt(file: File): Promise<string> {
  const webp = await fileToWebp(file, 1600, 0.8)
  const name = `${crypto.randomUUID()}.webp`
  const { error } = await sb().storage.from('receipts').upload(name, webp, {
    contentType: 'image/webp',
    upsert: false,
  })
  if (error) throw error
  return name
}

export async function receiptSignedUrl(path: string): Promise<string | null> {
  if (!path) return null
  const { data, error } = await sb().storage.from('receipts').createSignedUrl(path, 3600)
  if (error) return null
  return data.signedUrl
}

/** Re-encode a camera shot to webp base64 for the parse-receipt endpoint. */
export async function receiptToBase64(file: File): Promise<string> {
  const webp = await fileToWebp(file, 1600, 0.8)
  const buf = await webp.arrayBuffer()
  let bin = ''
  const bytes = new Uint8Array(buf)
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(bin)
}

/** The signed-in admin's access token (needed by the parse-receipt endpoint). */
export async function sessionToken(): Promise<string> {
  const { data } = await sb().auth.getSession()
  return data.session?.access_token ?? ''
}

// ---- API usage costs (usage_log — written by every metered endpoint) ----

export type UsageService = 'chat' | 'image' | 'social' | 'voice' | 'email' | 'receipt'

export const USAGE_SERVICES: UsageService[] = ['chat', 'image', 'social', 'voice', 'email', 'receipt']

/** Human labels for the itemized report. */
export const USAGE_LABEL: Record<UsageService, string> = {
  chat: 'AI chat',
  image: 'Cake builder images',
  social: 'Social posting',
  voice: 'Phone calls',
  email: 'Emails',
  receipt: 'Receipt reading',
}

export interface UsageRow {
  happenedAt: string
  service: UsageService
  estCost: number
  detail: string
  provider: string
  quantity: number
  inputTokens: number
  outputTokens: number
}

const asService = (v: unknown): UsageService =>
  USAGE_SERVICES.includes(v as UsageService) ? (v as UsageService) : 'chat'

export async function listUsageSince(sinceIso: string): Promise<UsageRow[]> {
  const { data, error } = await sb()
    .from('usage_log')
    .select('happened_at,service,est_cost,detail,provider,quantity,input_tokens,output_tokens')
    .gte('happened_at', sinceIso)
    .order('happened_at', { ascending: false })
    .limit(5000)
  if (error) throw error
  return (data ?? []).map((r: Record<string, unknown>) => ({
    happenedAt: (r.happened_at as string) ?? '',
    service: asService(r.service),
    estCost: Number(r.est_cost) || 0,
    detail: (r.detail as string) ?? '',
    provider: (r.provider as string) ?? '',
    quantity: Number(r.quantity) || 1,
    inputTokens: Number(r.input_tokens) || 0,
    outputTokens: Number(r.output_tokens) || 0,
  }))
}

export interface ServiceTotal {
  service: UsageService
  label: string
  provider: string
  calls: number
  quantity: number
  cost: number
}

/** Group raw rows into the per-service lines the report renders. */
export function summarizeUsage(rows: UsageRow[]): ServiceTotal[] {
  const map = new Map<string, ServiceTotal>()
  for (const r of rows) {
    const key = `${r.service}|${r.provider}`
    const cur = map.get(key)
    if (cur) {
      cur.calls += 1
      cur.quantity += r.quantity
      cur.cost += r.estCost
    } else {
      map.set(key, {
        service: r.service,
        label: USAGE_LABEL[r.service],
        provider: r.provider,
        calls: 1,
        quantity: r.quantity,
        cost: r.estCost,
      })
    }
  }
  return [...map.values()].sort((a, b) => b.cost - a.cost || b.calls - a.calls)
}
