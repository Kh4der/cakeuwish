import type { VercelRequest, VercelResponse } from '@vercel/node'

// Integration status for the admin Setup page: WHICH keys exist, never their
// values. Requires a valid admin session token — env layout is nobody else's
// business.

async function verifyAdmin(token: string): Promise<boolean> {
  const url = process.env.VITE_SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anon || !token) return false
  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: anon, Authorization: `Bearer ${token}` },
    })
    return res.ok
  } catch {
    return false
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const token = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
  if (!(await verifyAdmin(token))) return res.status(401).json({ error: 'Unauthorized' })

  const has = (k: string) => Boolean(process.env[k])
  return res.status(200).json({
    supabase: has('VITE_SUPABASE_URL') && has('VITE_SUPABASE_ANON_KEY'),
    anthropic: has('ANTHROPIC_API_KEY'),
    openai: has('OPENAI_API_KEY'),
    resend: has('RESEND_API_KEY'),
    notifySecret: has('NOTIFY_WEBHOOK_SECRET'),
    posthogCapture: has('VITE_POSTHOG_KEY'),
    posthogDashboard: has('POSTHOG_API_KEY') && has('POSTHOG_PROJECT_ID'),
    twitter:
      has('TWITTER_CONSUMER_KEY') &&
      has('TWITTER_CONSUMER_SECRET') &&
      has('TWITTER_ACCESS_TOKEN') &&
      has('TWITTER_ACCESS_SECRET'),
    facebook: has('FB_PAGE_ID') && has('FB_PAGE_ACCESS_TOKEN'),
    instagram: has('IG_USER_ID') && has('IG_ACCESS_TOKEN'),
    chatwootBot: has('CHATWOOT_BOT_TOKEN') && has('CHATWOOT_ACCOUNT_ID') && has('CHATWOOT_WEBHOOK_SECRET'),
    llm: has('LLM_BASE_URL') && has('LLM_API_KEY'),
    vapi: has('VAPI_WEBHOOK_SECRET'),
  })
}
