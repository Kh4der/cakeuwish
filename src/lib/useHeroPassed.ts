import { useEffect, useState } from 'react'

/**
 * True once the home hero has scrolled most of the way past — the cue the
 * header and the chat launcher both use to appear.
 *
 * The header and the chat widget each used to run their own scroll handler, and
 * each did `getElementById('top')` + `getBoundingClientRect()` + `innerHeight`
 * on EVERY scroll event: two forced layout flushes per event, on the busiest
 * page of the site. Here the crossover point is measured once, so the shared
 * listener only compares `scrollY` against a number, at most once per frame.
 *
 * An IntersectionObserver would be tempting and is not correct: it only
 * notifies when the intersection ratio actually changes between two rendered
 * frames, so a single large jump — scroll restoration, a hash link, "back to
 * top" — goes straight from hero-above to hero-below without ever reporting the
 * crossing, and the header gets stranded in the wrong state.
 *
 * Off the home page there is no hero to wait for, so it is always true.
 */
export function useHeroPassed(isHome: boolean) {
  const [passed, setPassed] = useState(!isHome)

  useEffect(() => {
    if (!isHome) {
      setPassed(true)
      return
    }

    let threshold = Infinity
    let raf = 0
    let tries = 0

    // The scroll position at which the hero's bottom edge rises past the 60%
    // line — the same crossover the old per-event predicate computed.
    const measure = () => {
      const hero = document.getElementById('top')
      if (!hero) return false
      threshold = hero.getBoundingClientRect().bottom + window.scrollY - window.innerHeight * 0.6
      return true
    }

    const update = () => {
      raf = 0
      setPassed(window.scrollY > threshold)
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    const onResize = () => {
      if (measure()) update()
    }

    const boot = () => {
      // The home route is a lazy chunk, so this runs before the hero exists.
      if (!measure()) {
        if (++tries > 120) {
          setPassed(true) // ~2s with no hero: assume the page simply has none
          return
        }
        raf = requestAnimationFrame(boot)
        return
      }
      update()
      window.addEventListener('scroll', onScroll, { passive: true })
      window.addEventListener('resize', onResize)
    }
    boot()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
    }
  }, [isHome])

  return passed
}
