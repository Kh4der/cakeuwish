import { useEffect, useRef, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { GOOGLE_REVIEWS_URL, SOCIABLEKIT_EMBED_ID } from '../data/reviews'

const SCRIPT_ID = 'sociablekit-google-reviews-js'
const SCRIPT_SRC = 'https://widgets.sociablekit.com/google-reviews/widget.js'
const POPULATE_TIMEOUT_MS = 6000

type Phase = 'skeleton' | 'ready' | 'failed'

/**
 * Live Google reviews via the SociableKit widget. The third-party script is
 * only fetched once the section nears the viewport, and the whole thing
 * degrades to a "read on Google" card when blocked (ad blockers commonly
 * block widgets.sociablekit.com).
 */
export default function SociableKitEmbed() {
  const hostRef = useRef<HTMLDivElement>(null)
  const embedRef = useRef<HTMLDivElement>(null)
  const [shouldLoad, setShouldLoad] = useState(false)
  const [phase, setPhase] = useState<Phase>('skeleton')

  // Arm loading when the section scrolls near the viewport.
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    if (typeof IntersectionObserver === 'undefined') {
      setShouldLoad(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShouldLoad(true)
          io.disconnect()
        }
      },
      { rootMargin: '400px' },
    )
    io.observe(host)
    return () => io.disconnect()
  }, [])

  // Inject the widget script (once per page load) and watch the embed div:
  // the widget replaces its contents, so any child element means success.
  useEffect(() => {
    if (!shouldLoad) return
    const embed = embedRef.current
    if (!embed) return

    const fail = () => setPhase((p) => (p === 'ready' ? p : 'failed'))

    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
    // widget.js scans for embed divs only when it executes, so on an SPA
    // revisit a fresh (empty) embed div needs the script re-appended — it
    // re-runs from HTTP cache and fills the new div.
    if (script && embed.childElementCount === 0) {
      script.remove()
      script = null
    }
    if (!script) {
      script = document.createElement('script')
      script.id = SCRIPT_ID
      script.src = SCRIPT_SRC
      script.async = true
      script.defer = true
      document.body.appendChild(script)
    }
    script.addEventListener('error', fail)

    const timer = window.setTimeout(fail, POPULATE_TIMEOUT_MS)
    const check = () => {
      if (embed.childElementCount > 0) {
        setPhase('ready')
        window.clearTimeout(timer)
        observer.disconnect()
      }
    }
    // Keep observing past the timeout so a slow widget can still replace the
    // fallback card if it eventually renders.
    const observer = new MutationObserver(check)
    observer.observe(embed, { childList: true, subtree: true })
    check()

    return () => {
      window.clearTimeout(timer)
      observer.disconnect()
      script?.removeEventListener('error', fail)
    }
  }, [shouldLoad])

  return (
    <div ref={hostRef}>
      {phase === 'skeleton' && (
        <>
          <p className="sr-only" role="status">
            Loading live Google reviews…
          </p>
          <div aria-hidden="true" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-border bg-card p-6 shadow-soft">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-muted" />
                  <div className="space-y-2">
                    <div className="h-3 w-28 rounded bg-muted" />
                    <div className="h-3 w-16 rounded bg-muted" />
                  </div>
                </div>
                <div className="mt-5 space-y-2.5">
                  <div className="h-3 w-full rounded bg-muted" />
                  <div className="h-3 w-11/12 rounded bg-muted" />
                  <div className="h-3 w-2/3 rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {phase === 'failed' && (
        <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-soft sm:p-10">
          <p className="font-display text-xl font-bold sm:text-2xl">The live reviews are being shy.</p>
          <p className="mx-auto mt-2 max-w-md text-muted-foreground" style={{ lineHeight: 1.7 }}>
            An ad blocker or privacy setting is probably keeping the widget from loading — no
            harm done. Every review lives on Google anyway.
          </p>
          <a
            href={GOOGLE_REVIEWS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-1.5 rounded-full border-2 border-primary px-6 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-on-primary"
          >
            Read our reviews on Google
            <ExternalLink size={16} aria-hidden="true" />
          </a>
        </div>
      )}

      {/* Always mounted so the widget script can find and fill it. */}
      <div ref={embedRef} className="sk-ww-google-reviews" data-embed-id={SOCIABLEKIT_EMBED_ID} />
    </div>
  )
}
