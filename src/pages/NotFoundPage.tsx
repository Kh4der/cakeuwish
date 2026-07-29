import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Magnetic from '../components/premium/Magnetic'
import { usePageMeta } from '../lib/usePageMeta'

export default function NotFoundPage() {
  usePageMeta('Page not found')
  return (
    <section className="relative mx-auto flex min-h-[80vh] max-w-7xl flex-col items-center justify-center overflow-hidden px-5 py-32 text-center sm:px-8">
      <span
        aria-hidden="true"
        className="ghost-numeral pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none leading-none"
        style={{ fontSize: 'clamp(15rem, 44vw, 32rem)' }}
      >
        404
      </span>
      <div className="relative">
        <p data-reveal className="font-display text-lg italic text-accent">
          Error 404 — someone ate this page
        </p>
        <h1
          data-reveal
          className="mt-3 font-display font-bold tracking-tight"
          style={{ fontSize: 'clamp(2.6rem, 7vw, 5rem)' }}
        >
          This slice doesn't exist.
        </h1>
        <p data-reveal className="mx-auto mt-5 max-w-md text-muted-foreground" style={{ lineHeight: 1.7 }}>
          The page you're looking for has been eaten (or moved). The good stuff is still here, though.
        </p>
        <div data-reveal className="mt-10 flex flex-wrap justify-center gap-3">
          <Magnetic>
            <Link
              to="/"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover"
            >
              <ArrowLeft size={16} aria-hidden="true" /> Back home
            </Link>
          </Magnetic>
          <Magnetic>
            <Link
              to="/gallery"
              className="inline-flex min-h-[44px] items-center rounded-full border-2 border-primary px-7 py-3.5 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-on-primary"
            >
              Browse cakes
            </Link>
          </Magnetic>
        </div>
      </div>
    </section>
  )
}
