import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import PageHero from '../components/PageHero'
import Magnetic from '../components/premium/Magnetic'
import { FAQS } from '../data/faq'
import { usePageMeta } from '../lib/usePageMeta'

export default function FaqPage() {
  usePageMeta(
    'FAQs',
    'Answers to common CakeUWish questions — lead times, eggless cakes, allergies, deposits, payments, pickup in Chantilly VA, and how quotes work.',
  )

  // FAQPage structured data for search engines.
  useEffect(() => {
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQS.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    })
    document.head.appendChild(script)
    return () => script.remove()
  }, [])

  return (
    <>
      {/* Native <details> can't transition height on open, but a keyframe run on
          first paint of the answer gives the same settled, soft entrance. */}
      <style>{`
        @keyframes faq-reveal { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }
        .faq-answer { animation: faq-reveal 0.5s cubic-bezier(0.22, 1, 0.36, 1) both; }
      `}</style>
      <PageHero
        eyebrow="Good to Know"
        title="Frequently asked questions"
        intro="Everything customers usually ask before ordering. Can't find your answer? WhatsApp us — a real human (Parul) replies."
      />
      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-24">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
          {/* sticky editorial rail */}
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="relative">
              <span
                aria-hidden="true"
                className="ghost-numeral pointer-events-none absolute -top-16 right-0 select-none lg:-right-4"
                style={{ fontSize: 'clamp(9rem, 16vw, 13rem)' }}
              >
                ?
              </span>
              <h2
                data-reveal
                className="relative font-display font-bold leading-[0.95] tracking-tight"
                style={{ fontSize: 'clamp(3rem, 6vw, 4.75rem)' }}
              >
                Questions<span className="text-foil">?</span>
              </h2>
            </div>
            <div data-reveal className="gold-rule mt-6 max-w-[8rem]" />
            <p data-reveal className="mt-6 max-w-sm text-muted-foreground" style={{ lineHeight: 1.75 }}>
              No question is too small when it's about the centerpiece of your party. If it isn't
              answered here, ask away — answers usually land within a day or two.
            </p>
            <div data-reveal className="mt-8 flex flex-wrap gap-3">
              <Magnetic>
                <Link
                  to="/contact"
                  className="inline-flex min-h-[44px] items-center rounded-full bg-primary px-7 py-3.5 text-sm font-bold text-on-primary transition-colors hover:bg-primary-hover"
                >
                  Contact us
                </Link>
              </Magnetic>
              <Magnetic>
                <Link
                  to="/order#request"
                  className="inline-flex min-h-[44px] items-center rounded-full border border-primary/30 px-7 py-3.5 text-sm font-semibold text-primary transition-colors hover:border-primary hover:bg-primary hover:text-on-primary"
                >
                  Request a quote
                </Link>
              </Magnetic>
            </div>
          </aside>

          {/* hairline editorial accordion */}
          <div data-reveal className="border-t border-border">
            {FAQS.map((f, i) => (
              <details key={f.q} className="group border-b border-border">
                <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-4 py-6 sm:gap-6 [&::-webkit-details-marker]:hidden">
                  <span
                    aria-hidden="true"
                    className="w-7 shrink-0 font-display text-sm italic text-accent/70"
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="flex-1 font-display text-lg font-bold transition-colors duration-300 group-open:text-accent sm:text-xl">
                    {f.q}
                  </span>
                  <Plus
                    size={20}
                    aria-hidden="true"
                    className="shrink-0 text-accent transition-transform duration-500 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] group-open:rotate-45"
                  />
                </summary>
                <p
                  className="faq-answer max-w-2xl pb-7 pl-11 pr-9 text-muted-foreground sm:pl-13"
                  style={{ lineHeight: 1.75 }}
                >
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
