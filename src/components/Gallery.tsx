import type { CSSProperties } from 'react'
import ExpandingCarousel from './ExpandingCarousel'

const HEADING = "A taste of what's possible."

export default function Gallery() {
  return (
    <section id="work" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
      <p data-reveal className="font-display text-lg italic text-accent">The Work</p>
      <h2 className="mt-2 font-display text-3xl font-bold sm:text-5xl">
        {HEADING.split(' ').map((w, i) => (
          <span key={i} className="reveal-mask">
            <span data-reveal style={{ '--reveal-delay': `${i * 70}ms` } as CSSProperties}>{w}&nbsp;</span>
          </span>
        ))}
      </h2>
      <p data-reveal className="mt-3 max-w-xl text-muted-foreground">
        Click a slice to bring it into focus — or use the arrows, scroll, or swipe.
      </p>

      <div data-reveal className="mt-10">
        <ExpandingCarousel />
      </div>
    </section>
  )
}
