import { getSupabase } from './supabase'

// Omnichannel switch: when the Setup panel has Chatwoot credentials, the
// public site loads Chatwoot's bubble (website + FB + IG + WhatsApp in one
// inbox) instead of the built-in AI chat widget. The website token is public
// by design — same trust level as our Supabase anon key.

export interface ChatwootConfig {
  baseUrl: string
  token: string
}

export async function fetchChatwootConfig(): Promise<ChatwootConfig | null> {
  const sb = getSupabase()
  if (!sb) return null
  try {
    const { data, error } = await sb
      .from('site_config')
      .select('chatwoot_base_url,chatwoot_token')
      .eq('id', 1)
      .maybeSingle()
    if (error || !data) return null
    const baseUrl = String(data.chatwoot_base_url ?? '').replace(/\/$/, '')
    const token = String(data.chatwoot_token ?? '')
    if (!/^https:\/\//.test(baseUrl) || !token) return null
    return { baseUrl, token }
  } catch {
    return null
  }
}

declare global {
  interface Window {
    chatwootSDK?: { run: (opts: { websiteToken: string; baseUrl: string }) => void }
  }
}

/** Inject the Chatwoot SDK once. */
export function mountChatwoot({ baseUrl, token }: ChatwootConfig): void {
  const ID = 'chatwoot-sdk-js'
  if (document.getElementById(ID)) return
  const script = document.createElement('script')
  script.id = ID
  script.src = `${baseUrl}/packs/js/sdk.js`
  script.defer = true
  script.async = true
  script.onload = () => window.chatwootSDK?.run({ websiteToken: token, baseUrl })
  document.body.appendChild(script)
}
