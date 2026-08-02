import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'
import WhatsAppFab from './WhatsAppFab'

// The AI chat widget stays out of the entry chunk and mounts after first paint.
const ChatWidget = lazy(() => import('./ChatWidget'))
import { useSmoothScroll } from '../lib/smoothScroll'
import { scrollToId, scrollToTop } from '../lib/smoothScroll'
import { useScrollReveal } from '../lib/useScrollReveal'
import { track } from '../lib/analytics'

function RouteFallback() {
  return <div className="min-h-[70vh]" aria-hidden="true" />
}

/**
 * Shared chrome for every public page: header, footer, WhatsApp FAB, cursor,
 * smooth scroll, scroll reveals, scroll restoration, and SPA pageviews.
 */
export default function Layout() {
  const { pathname, hash } = useLocation()
  useSmoothScroll()
  useScrollReveal(pathname)
  const [chatReady, setChatReady] = useState(false)
  useEffect(() => setChatReady(true), [])

  // Route change → jump to top (or honor a #hash once content paints). Lazy
  // route chunks mount a beat after navigation, so poll briefly for the target.
  useEffect(() => {
    if (!hash) {
      scrollToTop()
      return
    }
    const id = hash.slice(1)
    let tries = 0
    let raf = 0
    const attempt = () => {
      if (document.getElementById(id)) {
        scrollToId(id)
        return
      }
      if (++tries < 120) raf = requestAnimationFrame(attempt) // ~2s worst case
    }
    raf = requestAnimationFrame(attempt)
    return () => cancelAnimationFrame(raf)
  }, [pathname, hash])

  // PostHog counts the initial load by itself; count SPA navigations manually.
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    track('$pageview')
  }, [pathname])

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-on-primary focus:shadow-lg"
      >
        Skip to content
      </a>
      <Header />
      <main id="main-content">
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
      <WhatsAppFab />
      {chatReady && (
        <Suspense fallback={null}>
          <ChatWidget />
        </Suspense>
      )}
    </>
  )
}
