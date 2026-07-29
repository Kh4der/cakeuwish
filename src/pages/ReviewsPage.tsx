import { type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { MessageCircle, PenLine, Star } from 'lucide-react'
import PageHero from '../components/PageHero'
import Magnetic from '../components/premium/Magnetic'
import SociableKitEmbed from '../components/SociableKitEmbed'
import { WHATSAPP_ENABLED, WHATSAPP_URL } from '../data/cakes'
import { REVIEWS, REVIEW_COUNT, REVIEW_RATING, writeReviewUrl, type Review } from '../data/reviews'
import { usePageMeta } from '../lib/usePageMeta'

function StarRow({ count = 5, size = 18 }: { count?: number; size?: number }) {
  return (
    <div aria-hidden="true" className="flex items-center gap-1 text-accent">
      {Array.from({ length: count }).map((_, i) => (
        <Star key={i} size={size} fill="currentColor" strokeWidth={0} />
      ))}
    </div>
  )
}

function MarqueeCard({ review, hidden }: { review: Review; hidden?: boolean }) {
  return (
    <figure
      aria-hidden={hidden || undefined}
      className="glass flex w-[19rem] shrink-0 flex-col rounded-2xl p-6 sm:w-[23rem] sm:p-7"
    >
      <StarRow count={review.rating} size={15} />
      {!hidden && <span className="sr-only">{review.rating} out of 5 stars</span>}
      <blockquote
        className="mt-4 flex-1 font-display text-[0.98rem] italic text-foreground/85"
        style={{ lineHeight: 1.65 }}
      >
        “{review.text}”
      </blockquote>
      <figcaption className="mt-5 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        <span className="mr-2 inline-block h-px w-6 bg-accent/60 align-middle" aria-hidden="true" />
        {review.name}
      </figcaption>
    </figure>
  )
}

// Seamless loop needs the card sequence duplicated twice inside .marquee-track;
// each copy carries its own trailing gap so the -50% keyframe lands exactly.
function MarqueeRow({ reviews, reverse, duration }: { reviews: Review[]; reverse?: boolean; duration: string }) {
  return (
    <div
      className="overflow-hidden"
      style={{
        maskImage: 'linear-gradient(90deg, transparent, black 7%, black 93%, transparent)',
        WebkitMaskImage: 'linear-gradient(90deg, transparent, black 7%, black 93%, transparent)',
      }}
    >
      <div
        className={`marquee-track ${reverse ? 'marquee-reverse' : ''}`}
        style={{ '--marquee-duration': duration } as CSSProperties}
      >
        {[false, true].map((hidden) => (
          <div key={hidden ? 'copy' : 'main'} className="flex items-stretch gap-5 pr-5">
            {reviews.map((r) => (
              <MarqueeCard key={r.name} review={r} hidden={hidden} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ReviewsPage() {
  usePageMeta(
    'Reviews',
    `Live Google reviews for CakeUWish — ${REVIEW_RATING} stars from ${REVIEW_COUNT} reviews. Read what customers say about their custom celebration cakes, and leave a review of your own.`,
  )
  const rowA = REVIEWS.slice(0, Math.ceil(REVIEWS.length / 2))
  const rowB = REVIEWS.slice(Math.ceil(REVIEWS.length / 2))
  return (
    <>
      <PageHero
        eyebrow="Word of Mouth"
        title="What customers say"
        intro={`Nothing sells a cake like the people who've already eaten one. CakeUWish holds ${REVIEW_RATING} stars across ${REVIEW_COUNT} Google reviews — weddings, birthdays, and everything in between, told by the families who celebrated.`}
      >
        <div data-reveal className="mt-6 flex flex-wrap items-center gap-3">
          <StarRow size={24} />
          <p className="text-lg font-semibold text-primary">{REVIEW_RATING} stars · {REVIEW_COUNT} Google reviews</p>
        </div>
        <div data-reveal className="mt-7 flex flex-wrap gap-3">
          <Magnetic>
            <a
              href={writeReviewUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-bold text-on-primary transition-colors hover:bg-primary-hover"
            >
              <PenLine size={16} aria-hidden="true" />
              Leave us a review
            </a>
          </Magnetic>
          {WHATSAPP_ENABLED && (
          <Magnetic>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              data-loc="reviews-page"
              className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold text-white"
              style={{ backgroundColor: '#1A8A4E' }}
            >
              <MessageCircle size={17} fill="white" strokeWidth={0} aria-hidden="true" />
              Chat on WhatsApp
            </a>
          </Magnetic>
          )}
        </div>
      </PageHero>

      {/* headline figures — meaningful even before the live widget wakes up */}
      <section className="mx-auto max-w-5xl px-5 pt-12 sm:px-8 sm:pt-16" aria-label="Review highlights">
        <div data-reveal className="glass grid gap-y-8 rounded-[2rem] px-6 py-8 sm:grid-cols-3 sm:gap-y-0 sm:px-0 sm:py-10">
          <div className="text-center sm:border-r sm:border-border/70">
            <p className="font-display text-5xl font-bold tracking-tight">{REVIEW_RATING}</p>
            <div className="mt-2 flex justify-center">
              <StarRow size={15} />
            </div>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Google rating</p>
          </div>
          <div className="text-center sm:border-r sm:border-border/70">
            <p className="font-display text-5xl font-bold tracking-tight">{REVIEW_COUNT}</p>
            <p className="mt-2 font-display text-base italic text-accent">and counting</p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Written reviews</p>
          </div>
          <div className="text-center">
            <p className="font-display text-3xl font-bold tracking-tight sm:mt-2">Chantilly, VA</p>
            <p className="mt-2 font-display text-base italic text-accent">home-baked</p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Eggless specialty</p>
          </div>
        </div>
      </section>

      {/* live widget */}
      <section className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16" aria-labelledby="live-reviews">
        <h2 id="live-reviews" data-reveal className="font-display text-2xl font-bold sm:text-4xl">
          Live from Google
        </h2>
        <div data-reveal className="gold-rule mt-4 max-w-[10rem]" style={{ '--reveal-delay': '90ms' } as CSSProperties} />
        <p data-reveal className="mt-3 max-w-2xl text-muted-foreground" style={{ '--reveal-delay': '140ms' } as CSSProperties}>
          Pulled straight from our Google listing, newest first — nothing edited, nothing cherry-picked.
        </p>
        <div className="mt-8">
          <SociableKitEmbed />
        </div>
      </section>

      {/* curated favorites — two counter-drifting marquee rows */}
      <section className="overflow-hidden border-t border-border bg-muted/30" aria-labelledby="recent-favorites">
        <div className="mx-auto max-w-7xl px-5 pt-14 sm:px-8 sm:pt-20">
          <p data-reveal className="font-display text-lg italic text-accent">From the kitchen pinboard</p>
          <h2 id="recent-favorites" data-reveal className="mt-2 font-display text-2xl font-bold sm:text-4xl">
            Recent favorites
          </h2>
          <p data-reveal className="mt-3 max-w-2xl text-muted-foreground" style={{ '--reveal-delay': '120ms' } as CSSProperties}>
            A few of the reviews we keep re-reading in the kitchen. Hover to pause and read along.
          </p>
        </div>
        <div data-reveal className="mt-10 space-y-5">
          <MarqueeRow reviews={rowA} duration="58s" />
          <MarqueeRow reviews={rowB} reverse duration="72s" />
        </div>

        {/* bottom CTA */}
        <div className="mx-auto max-w-7xl px-5 pb-14 sm:px-8 sm:pb-20">
          <div data-reveal className="relative mt-16 overflow-hidden rounded-[2.5rem] bg-primary p-8 text-center text-cream sm:p-14">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{ background: 'radial-gradient(60% 80% at 50% 0%, rgba(161,98,7,0.28), transparent 70%)' }}
            />
            <div className="relative">
              <p className="font-display text-lg italic text-gold-soft">One message is all it takes</p>
              <h2 className="mt-2 font-display text-2xl font-bold sm:text-4xl">Your celebration could be next</h2>
              <p className="mx-auto mt-4 max-w-xl text-cream/90" style={{ lineHeight: 1.7 }}>
                Every one of these reviews started with a message about an idea. Tell us about yours
                and get a real quote — usually within a day or two.
              </p>
              <Magnetic className="mt-7">
                <Link
                  to="/order#request"
                  className="inline-flex min-h-[44px] items-center rounded-full bg-cream px-8 py-3.5 text-sm font-bold text-primary transition-transform hover:scale-105"
                >
                  Request a quote
                </Link>
              </Magnetic>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
