import { useEffect } from 'react'

/**
 * Reveals any element marked with [data-reveal] when it scrolls into view by
 * adding the `revealed` class (CSS handles the transition). Works with Lenis
 * smooth scroll. Honors prefers-reduced-motion.
 */
export function useScrollReveal() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('revealed'))
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('revealed')
            io.unobserve(e.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    )
    const observe = () => document.querySelectorAll('[data-reveal]:not(.revealed)').forEach((el) => io.observe(el))
    observe()
    const t = window.setTimeout(observe, 600) // catch late-mounted nodes
    return () => { window.clearTimeout(t); io.disconnect() }
  }, [])
}
