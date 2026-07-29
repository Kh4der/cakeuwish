import { getSupabase } from '../../lib/supabase'

// Admin CRUD for kb_entries — the facts fed into the AI chat assistant's
// knowledge document (see api/chat.ts). Kept out of ./db.ts so the chat
// feature stays self-contained.

export interface KbEntry {
  id: string
  title: string
  content: string
  visible: boolean
  sortOrder: number
  createdAt: string
}

function sb() {
  const c = getSupabase()
  if (!c) throw new Error('Supabase is not configured')
  return c
}

function rowToEntry(r: Record<string, unknown>): KbEntry {
  return {
    id: r.id as string,
    title: (r.title as string) ?? '',
    content: (r.content as string) ?? '',
    visible: r.visible == null ? true : Boolean(r.visible),
    sortOrder: (r.sort_order as number) ?? 0,
    createdAt: (r.created_at as string) ?? '',
  }
}

function entryToRow(e: KbEntry) {
  return {
    id: e.id,
    title: e.title,
    content: e.content,
    visible: e.visible,
    sort_order: e.sortOrder,
  }
}

export async function listKbEntries(): Promise<KbEntry[]> {
  const { data, error } = await sb()
    .from('kb_entries')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []).map(rowToEntry)
}

export async function saveKbEntry(e: KbEntry): Promise<void> {
  const { error } = await sb().from('kb_entries').upsert(entryToRow(e))
  if (error) throw error
}

export async function deleteKbEntry(id: string): Promise<void> {
  const { error } = await sb().from('kb_entries').delete().eq('id', id)
  if (error) throw error
}

/** Persist new sort_order for a batch of rows (used by reordering). */
export async function reorderKbEntries(items: KbEntry[]): Promise<void> {
  await Promise.all(items.map((e, i) => saveKbEntry({ ...e, sortOrder: i })))
}
