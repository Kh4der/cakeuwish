import { useEffect } from 'react'
import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

type WinWithLenis = Window & { __lenis?: Lenis }

/**
 * Lenis smooth-scroll wired into GSAP's ticker so ScrollTrigger stays in sync.
 * Disabled when the user prefers reduced motion.
 */
export function useSmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const lenis = new Lenis({
      duration: 1.1,
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.5,
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

/** Smoothly scroll to an element id, accounting for the sticky header. */
export function scrollToId(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const lenis = (window as WinWithLenis).__lenis
  if (lenis) lenis.scrollTo(el, { offset: -72, immediate: reduced })
  else el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' })
}
