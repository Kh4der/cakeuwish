import { Link } from 'react-router-dom'
import { ArrowRight, CakeSlice, FileText, Star, Wand2 } from 'lucide-react'
import Magnetic from './premium/Magnetic'
import ShaderSilk from './premium/ShaderSilk'
import { REVIEW_COUNT, REVIEW_RATING } from '../data/reviews'

// Closing band for the slimmed home page: the three paths a customer actually
// takes, plus the social-proof line. Everything else lives on its own page.

const PATHS = [
  {
    to: '/gallery',
    icon: CakeSlice,
    title: 'Browse real cakes',
    text: 'Filter by occasion, search a theme, fall in love.',
  },
  {
    to: '/builder',
    icon: Wand2,
    title: 'Design your own',
    text: 'Describe it, preview it with AI, send it to Parul.',
  },
  {
    to: '/order#request',
    icon: FileText,
    title: 'Request a quote',
    text: 'Two minutes of questions, a real price back.',
  },
]

export default function HomeCta() {
  return (
    <section id="contact" className="relative overflow-hidden border-t border-border">
      <ShaderSilk />
      <div className="relative mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
        <div className="text-center">
          <p data-reveal className="font-display text-lg italic text-accent">
            Where to next?
          </p>
          <h2 data-reveal className="mt-2 font-display font-bold tracking-tight" style={{ fontSize: 'clamp(2.2rem, 6vw, 4.5rem)' }}>
            Let&rsquo;s bake <span className="text-foil">your</span> story
          </h2>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-3">
          {PATHS.map((p, i) => (
            <div key={p.to} data-reveal style={{ '--reveal-delay': `${i * 90}ms` } as React.CSSProperties}>
              <Link
                to={p.to}
                className="group glass block h-full rounded-3xl p-7 transition-all duration-500 hover:-translate-y-1 hover:shadow-cake"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-on-primary">
                  <p.icon size={22} aria-hidden="true" />
                </span>
                <h3 className="mt-5 font-display text-xl font-bold">{p.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground" style={{ lineHeight: 1.6 }}>
                  {p.text}
                </p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
                  Go <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
                </span>
              </Link>
            </div>
          ))}
        </div>

        <div data-reveal className="mt-12 flex justify-center">
          <Magnetic>
            <Link
              to="/reviews"
              className="inline-flex min-h-[48px] items-center gap-2.5 rounded-full bg-primary px-7 py-3.5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover"
            >
              <span aria-hidden="true" className="flex items-center gap-0.5 text-gold-soft">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={13} fill="currentColor" strokeWidth={0} />
                ))}
              </span>
              {REVIEW_RATING} stars · {REVIEW_COUNT} Google reviews
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </Magnetic>
        </div>
      </div>
    </section>
  )
}
