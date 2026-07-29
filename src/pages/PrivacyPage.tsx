import { Link } from 'react-router-dom'
import PageHero from '../components/PageHero'
import { usePageMeta } from '../lib/usePageMeta'

// Drafted to match what this site actually does (quote/contact forms stored in
// the order system, PostHog analytics, WhatsApp handoff). Review before any
// substantive business change (email marketing, new trackers, etc.).

export default function PrivacyPage() {
  usePageMeta(
    'Privacy Policy',
    'How CakeUWish handles your information — what we collect through forms and analytics, how it’s used, and how to reach us about it.',
  )
  return (
    <>
      <PageHero
        eyebrow="Your Data"
        title="Privacy policy"
        intro="The short version: we collect only what we need to bake your cake and reply to you, we never sell it, and you can ask us to delete it at any time."
      />
      <section className="mx-auto max-w-3xl space-y-10 px-5 py-12 sm:px-8 sm:py-16">
        <p className="text-sm text-muted-foreground">Effective July 2026 · CakeUWish LLC, Chantilly, VA</p>

        <section aria-labelledby="collect-h">
          <h2 id="collect-h" className="font-display text-2xl font-bold">What we collect</h2>
          <p className="mt-3 text-muted-foreground" style={{ lineHeight: 1.75 }}>
            When you send a quote request or contact message, we collect what you type into the
            form: your name, phone number, email, event details (dates, occasion, theme, servings,
            flavors, budget, dietary notes), your message, and any inspiration photos you attach.
          </p>
          <p className="mt-3 text-muted-foreground" style={{ lineHeight: 1.75 }}>
            We also use analytics (PostHog) to understand how visitors use the site — pages viewed,
            buttons clicked, device type, and approximate location. This helps us improve the site;
            it is not used to identify you personally.
          </p>
          <p className="mt-3 text-muted-foreground" style={{ lineHeight: 1.75 }}>
            Our reviews page embeds a live Google-reviews widget (provided by SociableKit) and our
            contact page embeds a Google map. Those third parties may set their own cookies when
            the widgets load; the rest of the site works without them.
          </p>
        </section>

        <section aria-labelledby="use-h">
          <h2 id="use-h" className="font-display text-2xl font-bold">How we use it</h2>
          <p className="mt-3 text-muted-foreground" style={{ lineHeight: 1.75 }}>
            To reply to you, prepare your quote, and fulfil your order — that's it. We don't sell
            your information, and we don't send marketing emails. If you contact us on WhatsApp,
            Facebook, or Instagram, those conversations are governed by those platforms' own
            privacy policies too.
          </p>
        </section>

        <section aria-labelledby="store-h">
          <h2 id="store-h" className="font-display text-2xl font-bold">Where it lives</h2>
          <p className="mt-3 text-muted-foreground" style={{ lineHeight: 1.75 }}>
            Form submissions are stored securely in our order-management system (hosted on
            Supabase) and are visible only to CakeUWish. Inspiration photos you upload are stored
            with your request. Analytics data is held by PostHog. Our website is hosted on Vercel.
          </p>
        </section>

        <section aria-labelledby="choices-h">
          <h2 id="choices-h" className="font-display text-2xl font-bold">Your choices</h2>
          <p className="mt-3 text-muted-foreground" style={{ lineHeight: 1.75 }}>
            Want to see, correct, or delete the information you've sent us?{' '}
            <Link to="/contact" className="underline underline-offset-2 hover:text-primary">
              Get in touch
            </Link>{' '}
            and we'll take care of it. You can also browse the entire site without submitting any
            form — nothing personal is required just to look at cakes.
          </p>
        </section>

        <section aria-labelledby="children-h">
          <h2 id="children-h" className="font-display text-2xl font-bold">Children</h2>
          <p className="mt-3 text-muted-foreground" style={{ lineHeight: 1.75 }}>
            We bake a lot of kids' birthday cakes, but this website is meant for the grown-ups
            ordering them. We don't knowingly collect information from children under 13.
          </p>
        </section>

        <section aria-labelledby="changes-h">
          <h2 id="changes-h" className="font-display text-2xl font-bold">Changes to this policy</h2>
          <p className="mt-3 text-muted-foreground" style={{ lineHeight: 1.75 }}>
            If this policy changes, the new version will be posted here with an updated effective
            date. For anything else, see our{' '}
            <Link to="/terms" className="underline underline-offset-2 hover:text-primary">
              terms & policies
            </Link>
            .
          </p>
        </section>
      </section>
    </>
  )
}
