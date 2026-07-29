import { getSupabase } from '../../lib/supabase'

// site_config — the installation panel's storage. One row; only the
// super-admin (email match, enforced by RLS) can write.

export interface SiteConfig {
  businessName: string
  legalName: string
  ownerName: string
  city: string
  region: string
  phoneE164: string
  phoneDisplay: string
  whatsappEnabled: boolean
  facebookUrl: string
  instagramUrl: string
  reviewRating: string
  reviewCount: number
  sociablekitId: string
  googlePlaceId: string
  chatwootBaseUrl: string
  chatwootToken: string
  notifyEmail: string
  vapiAssistantId: string
  superAdminEmail: string
  twitterHandle: string
  facebookPageName: string
  instagramHandle: string
  /** WhatsApp has no publishing API — this only deep-links the manual post card */
  whatsappChannelUrl: string
}

function sb() {
  const c = getSupabase()
  if (!c) throw new Error('Supabase is not configured')
  return c
}

function rowToConfig(r: Record<string, unknown>): SiteConfig {
  return {
    businessName: (r.business_name as string) ?? '',
    legalName: (r.legal_name as string) ?? '',
    ownerName: (r.owner_name as string) ?? '',
    city: (r.city as string) ?? '',
    region: (r.region as string) ?? '',
    phoneE164: (r.phone_e164 as string) ?? '',
    phoneDisplay: (r.phone_display as string) ?? '',
    whatsappEnabled: Boolean(r.whatsapp_enabled),
    facebookUrl: (r.facebook_url as string) ?? '',
    instagramUrl: (r.instagram_url as string) ?? '',
    reviewRating: (r.review_rating as string) ?? '',
    reviewCount: Number(r.review_count) || 0,
    sociablekitId: (r.sociablekit_id as string) ?? '',
    googlePlaceId: (r.google_place_id as string) ?? '',
    chatwootBaseUrl: (r.chatwoot_base_url as string) ?? '',
    chatwootToken: (r.chatwoot_token as string) ?? '',
    notifyEmail: (r.notify_email as string) ?? '',
    vapiAssistantId: (r.vapi_assistant_id as string) ?? '',
    superAdminEmail: (r.super_admin_email as string) ?? '',
    twitterHandle: (r.twitter_handle as string) ?? '',
    facebookPageName: (r.facebook_page_name as string) ?? '',
    instagramHandle: (r.instagram_handle as string) ?? '',
    whatsappChannelUrl: (r.whatsapp_channel_url as string) ?? '',
  }
}

export async function getConfig(): Promise<SiteConfig> {
  const { data, error } = await sb().from('site_config').select('*').eq('id', 1).single()
  if (error) throw error
  return rowToConfig(data as Record<string, unknown>)
}

export async function saveConfig(c: SiteConfig): Promise<void> {
  const { error } = await sb()
    .from('site_config')
    .update({
      business_name: c.businessName,
      legal_name: c.legalName,
      owner_name: c.ownerName,
      city: c.city,
      region: c.region,
      phone_e164: c.phoneE164,
      phone_display: c.phoneDisplay,
      whatsapp_enabled: c.whatsappEnabled,
      facebook_url: c.facebookUrl,
      instagram_url: c.instagramUrl,
      review_rating: c.reviewRating,
      review_count: c.reviewCount,
      sociablekit_id: c.sociablekitId,
      google_place_id: c.googlePlaceId,
      chatwoot_base_url: c.chatwootBaseUrl,
      chatwoot_token: c.chatwootToken,
      notify_email: c.notifyEmail,
      vapi_assistant_id: c.vapiAssistantId,
      super_admin_email: c.superAdminEmail,
      twitter_handle: c.twitterHandle,
      facebook_page_name: c.facebookPageName,
      instagram_handle: c.instagramHandle,
      whatsapp_channel_url: c.whatsappChannelUrl,
    })
    .eq('id', 1)
  if (error) throw error
}

/** Signed-in admin's email — the Setup page is shown only to the super admin. */
export async function currentEmail(): Promise<string> {
  const { data } = await sb().auth.getSession()
  return data.session?.user.email ?? ''
}

export async function accessToken(): Promise<string> {
  const { data } = await sb().auth.getSession()
  return data.session?.access_token ?? ''
}
