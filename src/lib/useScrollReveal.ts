import { useEffect } from 'react'

/**
 * Reveals any element marked with [data-reveal] when it scrolls into view by
 * adding the `revealed` class (CSS handles the transition). Works with Lenis
 * smooth scroll. Honors prefers-reduced-motion.
 *
 * Late-mounted nodes (lazy route chunks, live-data hydration like the admin-
 * edited pricing rows) are caught by a MutationObserver — without it, anything
 * mounted after the initial scan would stay at opacity 0 forever.
 *
 * Pass a `key` (e.g. the route pathname) to re-scan eagerly on navigation.
 */
export function useScrollReveal(key?: unknown) {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const revealAll = () =>
        document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('revealed'))
      revealAll()
      const mo = new MutationObserver(revealAll)
      mo.observe(document.body, { childList: true, subtree: true })
      return () => mo.disconnect()
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('revealed')
            // Reveal is one-way: unobserving means scrolling back past an
            // element never replays its animation.
            io.unobserve(e.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    )
    const observe = () =>
      document.querySelectorAll('[data-reveal]:not(.revealed)').forEach((el) => {
        // Anything already scrolled PAST (deep link, hash jump, back-navigation
        // scroll restoration) would otherwise sit at opacity 0 forever, because
        // it never re-enters the viewport going down. Show it at once, with no
        // animation — there is nothing to animate into view.
        if (el.getBoundingClientRect().bottom < 0) {
          el.classList.add('reveal-instant', 'revealed')
          return
        }
        io.observe(el)
      })
    observe()
    // Re-scan whenever the DOM grows (debounced to one scan per frame).
    let raf = 0
    const mo = new MutationObserver(() => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        observe()
      })
    })
    mo.observe(document.body, { childList: true, subtree: true })
    return () => {
      cancelAnimationFrame(raf)
      mo.disconnect()
      io.disconnect()
    }
  }, [key])
}
