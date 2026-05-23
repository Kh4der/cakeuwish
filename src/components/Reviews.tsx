import { Star, ArrowUpRight } from 'lucide-react'
import ReviewsCarousel from './ReviewsCarousel'
import { GOOGLE_REVIEWS_URL } from '../data/reviews'

export default function Reviews() {
  return (
    <section id="reviews" aria-labelledby="reviews-heading" className="overflow-hidden py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex flex-col items-center text-center">
          <div aria-hidden="true" className="flex items-center gap-1 text-accent">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} size={24} fill="currentColor" strokeWidth={0} />
            ))}
          </div>
          <h2 id="reviews-heading" data-reveal className="mt-3 font-display text-3xl font-bold sm:text-5xl">
            What People Are Saying
          </h2>
          <p data-reveal className="mt-3 text-lg font-semibold text-primary">4.9 stars from 194 Google reviews — and counting.</p>
          <p className="mt-1 max-w-xl text-muted-foreground">
            Real celebrations, real families, real reactions. Drag to spin through them.
          </p>
        </div>
      </div>

      <div className="mt-12">
        <ReviewsCarousel />
      </div>

      <div className="mt-8 flex justify-center">
        <a
          href={GOOGLE_REVIEWS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border-2 border-primary px-6 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-on-primary"
        >
          Read all 194 reviews on Google
          <ArrowUpRight size={18} aria-hidden="true" />
        </a>
      </div>
    </section>
  )
}
