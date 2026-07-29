import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import Magnetic from './premium/Magnetic'
import { useContent } from '../content/ContentProvider'

// Home highlights: a slow film-strip of SHOWCASE photos — deliberately a
// different set from the hero's seven cutout cakes, so the home page stops
// repeating the same images. Browsing depth lives on /gallery.

export default function Highlights() {
  const { showcase } = useContent()
  const photos = showcase.filter((s) => s.visible && s.mediaType !== 'video').slice(0, 14)
  if (photos.length === 0) return null

  const Strip = ({ ariaHidden = false }: { ariaHidden?: boolean }) => (
    <div aria-hidden={ariaHidden || undefined} className="flex shrink-0 items-center gap-4 pr-4">
      {photos.map((p, i) => (
        <Link
          key={`${p.id}${ariaHidden ? '-dup' : ''}`}
          to="/gallery"
          tabIndex={ariaHidden ? -1 : undefined}
          className="zoom-frame block shrink-0 overflow-hidden rounded-2xl border border-border shadow-soft"
          style={{ width: i % 3 === 1 ? 300 : 230 }}
        >
          <img
            src={p.src}
            alt={ariaHidden ? '' : p.alt}
            loading="lazy"
            decoding="async"
            className="aspect-[4/5] w-full object-cover"
          />
        </Link>
      ))}
    </div>
  )

  return (
    <section id="showcase" className="overflow-hidden py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <p data-reveal className="font-display text-lg italic text-accent">
          Fresh from the kitchen
        </p>
        <h2 data-reveal className="mt-2 font-display font-bold tracking-tight" style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)' }}>
          Recent <span className="text-foil">celebrations</span>
        </h2>
      </div>
      <div className="marquee-track mt-10" style={{ '--marquee-duration': '70s' } as React.CSSProperties}>
        <Strip />
        <Strip ariaHidden />
      </div>
      <div className="mt-10 flex justify-center">
        <Magnetic>
          <Link
            to="/gallery"
            className="inline-flex min-h-[48px] items-center gap-2 rounded-full border-2 border-primary px-7 py-3.5 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-on-primary"
          >
            Browse the full gallery <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </Magnetic>
      </div>
    </section>
  )
}
