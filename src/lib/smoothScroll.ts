import { useEffect } from 'react'
import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

type WinWithLenis = Window & { __lenis?: Lenis }

/**
 * Lenis smooth-scroll wired into GSAP's ticker so ScrollTrigger stays in sync.
 * Disabled when the user prefers reduced motion, and on touchscreens.
 */
export function useSmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // Lenis gives a phone NOTHING: syncTouch defaults to false, so the touch
    // branch discards the delta and the page scrolls natively anyway — but it
    // still attaches non-passive touchstart/touchmove listeners to the window
    // for the life of the session, which is real finger-down-to-page-moves
    // latency and defeats the browser's own momentum. `hover: none` keeps
    // touchscreen laptops on the smooth-wheel path.
    if (window.matchMedia('(hover: none) and (pointer: coarse)').matches) return

    const lenis = new Lenis({
      duration: 1.1,
      smoothWheel: true,
      wheelMultiplier: 1,
    })
    ;(window as WinWithLenis).__lenis = lenis

    lenis.on('scroll', ScrollTrigger.update)

    const onTick = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(onTick)
    gsap.ticker.lagSmoothing(0)

    return () => {
      gsap.ticker.remove(onTick)
      lenis.destroy()
      delete (window as WinWithLenis).__lenis
    }
  }, [])
}

/** Jump to the top of the page instantly (used on route changes). */
export function scrollToTop() {
  const lenis = (window as WinWithLenis).__lenis
  if (lenis) lenis.scrollTo(0, { immediate: true })
  window.scrollTo(0, 0)
}

/** Smoothly scroll to an element id, accounting for the sticky header. */
export function scrollToId(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const lenis = (window as WinWithLenis).__lenis
  if (lenis) {
    lenis.scrollTo(el, { offset: -72, immediate: reduced })
    return
  }
  // The fallback has to apply the same -72 header offset. scrollIntoView does
  // not, so without this every in-page anchor lands under the fixed header —
  // and since Lenis is now off on phones, that fallback IS the mobile path.
  window.scrollTo({
    top: el.getBoundingClientRect().top + window.scrollY - 72,
    behavior: reduced ? 'auto' : 'smooth',
  })
}
