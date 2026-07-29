// Lightweight analytics façade around PostHog.
//
// PostHog itself is loaded ONLY via dynamic import, and ONLY when a project key
// is configured — so with no key the public bundle ships nothing extra and
// `track()` is a silent no-op. Once a key is present we get autocaptured
// pageviews/clicks/devices/sources for free, plus the custom conversion events
// wired below (whatsapp_click / enquire_click / section_view).

type Props = Record<string, unknown>

interface PostHogLike {
  init: (key: string, opts: Record<string, unknown>) => void
  capture: (event: string, props?: Props) => void
}

let ph: PostHogLike | null = null
let initStarted = false

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined
const HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || 'https://us.i.posthog.com'

export const isAnalyticsConfigured = Boolean(KEY)

/** Boot PostHog (idempotent). No-op when no key is configured. */
export async function initAnalytics(): Promise<void> {
  if (!KEY || initStarted) return
  initStarted = true
  try {
    const mod = await import('posthog-js')
    const posthog = mod.default as unknown as PostHogLike
    posthog.init(KEY, {
      api_host: HOST,
      capture_pageview: true, // "visits"
      autocapture: true, // clicks, sources, devices, geo — for free
      capture_pageleave: true,
      persistence: 'localStorage+cookie',
    })
    ph = posthog
  } catch {
    // analytics is best-effort; never break the site
    initStarted = false
  }
}

/** Fire a custom event. Buffers nothing — silently drops until PostHog loads. */
export function track(event: string, props?: Props): void {
  try {
    ph?.capture(event, props)
  } catch {
    /* ignore */
  }
}

/**
 * One delegated, capture-phase click listener that turns every WhatsApp link
 * into a conversion event. Links carrying `data-cake` are treated as per-cake
 * enquiries; the rest as general WhatsApp clicks. Location is read from
 * `data-loc` or the nearest section id. No per-component wiring required beyond
 * those two optional attributes.
 */
export function installCtaTracking(): void {
  if (typeof document === 'undefined') return
  document.addEventListener(
    'click',
    (e) => {
      const t = e.target as HTMLElement | null
      if (!t || typeof t.closest !== 'function') return
      const a = t.closest('a[href]') as HTMLAnchorElement | null
      if (!a) return
      const href = a.getAttribute('href') || ''
      if (!/wa\.me|api\.whatsapp\.com|whatsapp:/i.test(href)) return
      const cake = a.getAttribute('data-cake') || undefined
      const loc =
        a.getAttribute('data-loc') ||
        a.closest('section[id]')?.getAttribute('id') ||
        'unknown'
      track(cake ? 'enquire_click' : 'whatsapp_click', { location: loc, cake })
    },
    { capture: true },
  )
}

/** Fire a `section_view` once per section per page load (for funnel/scroll-depth). */
export function installSectionTracking(): void {
  if (typeof document === 'undefined' || !('IntersectionObserver' in window)) return
  const ids = ['top', 'work', 'showcase', 'menu', 'reviews', 'contact']
  const seen = new Set<string>()
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (en.isIntersecting) {
          const id = (en.target as HTMLElement).id
          if (id && !seen.has(id)) {
            seen.add(id)
            track('section_view', { section: id })
          }
        }
      }
    },
    { threshold: 0.4 },
  )
  requestAnimationFrame(() => {
    ids.forEach((id) => {
      const el = document.getElementById(id)
      if (el) io.observe(el)
    })
  })
}
