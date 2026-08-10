import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'
import WhatsAppFab from './WhatsAppFab'

// The AI chat widget stays out of the entry chunk and mounts after first paint.
const ChatWidget = lazy(() => import('./ChatWidget'))
// The bee lives in the shared chrome, so it follows you across every page
// (including the intro) instead of belonging to the home hero. three.js stays
// lazy; it mounts a beat after first paint so it never competes with the hero
// images for bandwidth.
const BeeCompanion = lazy(() => import('./premium/BeeCompanion'))
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

  // The bee drags in the whole three.js payload plus a ~1 MB model. A bare
  // 900 ms timer landed that squarely inside the user's first scroll on a
  // phone. Wait for an idle moment instead, and never start the fetch while a
  // scroll is actually in progress.
  const [beeReady, setBeeReady] = useState(false)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let lastScroll = 0
    const onScroll = () => { lastScroll = performance.now() }
    window.addEventListener('scroll', onScroll, { passive: true })
    const idle = (window as Window & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number
    }).requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1200))
    let timer = 0
    const attempt = () => {
      if (performance.now() - lastScroll < 500) {
        timer = window.setTimeout(() => idle(attempt, { timeout: 5000 }), 400)
        return
      }
      setBeeReady(true)
    }
    idle(attempt, { timeout: 5000 })
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

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

  // Lets CSS target the home route — the only page that pins a critical button
  // into the bottom-right corner where the Chatwoot launcher floats.
  useEffect(() => {
    document.documentElement.dataset.route = pathname === '/' ? 'home' : 'page'
  }, [pathname])

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
      {beeReady && (
        <Suspense fallback={null}>
          <BeeCompanion />
        </Suspense>
      )}
    </>
  )
}
