import { getSupabase } from '../../lib/supabase'

// Admin-only data access for the orders table (migration 0004). Kept separate
// from db.ts so the Inquiries screen can pull it in via dynamic import only
// when a conversion actually happens.

export type OrderStatus = 'pending' | 'confirmed' | 'ready' | 'completed' | 'cancelled'

export interface Order {
  id: string
  inquiryId: string | null
  name: string
  phone: string
  email: string
  /** ISO dates (yyyy-mm-dd) or empty */
  eventDate: string
  pickupDate: string
  pickupSlot: string
  description: string
  price: number | null
  depositPaid: boolean
  status: OrderStatus
  adminNotes: string
  createdAt: string
}

/** Fields copied over when an inquiry is converted into an order. */
export interface OrderFromInquiry {
  inquiryId: string | null
  name: string
  phone: string
  email: string
  eventDate: string
  pickupDate: string
  pickupSlot: string
  description: string
}

function sb() {
  const c = getSupabase()
  if (!c) throw new Error('Supabase is not configured')
  return c
}

function rowToOrder(r: Record<string, unknown>): Order {
  const price = r.price == null ? NaN : Number(r.price)
  return {
    id: r.id as string,
    inquiryId: (r.inquiry_id as string) ?? null,
    name: (r.name as string) ?? '',
    phone: (r.phone as string) ?? '',
    email: (r.email as string) ?? '',
    eventDate: (r.event_date as string) ?? '',
    pickupDate: (r.pickup_date as string) ?? '',
    pickupSlot: (r.pickup_slot as string) ?? '',
    description: (r.description as string) ?? '',
    price: Number.isFinite(price) ? price : null,
    depositPaid: Boolean(r.deposit_paid),
    status: (r.status as OrderStatus) ?? 'pending',
    adminNotes: (r.admin_notes as string) ?? '',
    createdAt: (r.created_at as string) ?? '',
  }
}

function orderToRow(o: Order) {
  return {
    id: o.id,
    inquiry_id: o.inquiryId,
    name: o.name,
    phone: o.phone,
    email: o.email,
    event_date: o.eventDate || null,
    pickup_date: o.pickupDate || null,
    pickup_slot: o.pickupSlot,
    description: o.description,
    price: o.price,
    deposit_paid: o.depositPaid,
    status: o.status,
    admin_notes: o.adminNotes,
  }
}

export async function listOrders(): Promise<Order[]> {
  const { data, error } = await sb()
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(rowToOrder)
}

export async function saveOrder(o: Order): Promise<void> {
  const { error } = await sb().from('orders').upsert(orderToRow(o))
  if (error) throw error
}

export async function deleteOrder(id: string): Promise<void> {
  const { error } = await sb().from('orders').delete().eq('id', id)
  if (error) throw error
}

/** Insert a fresh 'pending' order carrying over the inquiry's details. */
export async function createFromInquiry(d: OrderFromInquiry): Promise<Order> {
  const { data, error } = await sb()
    .from('orders')
    .insert({
      inquiry_id: d.inquiryId,
      name: d.name,
      phone: d.phone,
      email: d.email,
      event_date: d.eventDate || null,
      pickup_date: d.pickupDate || null,
      pickup_slot: d.pickupSlot,
      description: d.description,
      status: 'pending',
    })
    .select()
    .single()
  if (error) throw error
  return rowToOrder(data as Record<string, unknown>)
}

/**
 * Daily capacity from shop_settings (migration 0003). That migration is
 * optional — returns null (never throws) when the table is missing or empty.
 */
export async function getMaxOrdersPerDay(): Promise<number | null> {
  try {
    const { data, error } = await sb()
      .from('shop_settings')
      .select('max_orders_per_day')
      .limit(1)
      .maybeSingle()
    if (error || !data) return null
    const n = Number((data as Record<string, unknown>).max_orders_per_day)
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}
