import { Link } from 'react-router-dom'
import PageHero from '../components/PageHero'
import { usePageMeta } from '../lib/usePageMeta'

// Policy text ported from CakeUWish's original site (Terms of Agreement),
// lightly edited for clarity. Substantive changes need Parul's sign-off.

interface Section {
  id: string
  title: string
  body: string[]
}

const SECTIONS: Section[] = [
  {
    id: 'payments',
    title: 'Payments',
    body: ['CakeUWish accepts payments made via cash, Zelle, and PayPal.'],
  },
  {
    id: 'deposits',
    title: 'Deposits & retainers',
    body: [
      'All customers are required to pay a 50% deposit to confirm the order and reserve your date. Without a retainer we can’t guarantee to hold the date — priority is given to the paying customer. We ask that you be certain you would like to work with us, as all retainers are non-refundable.',
      'The remainder of the balance is due at the time of pickup. No desserts will be released if payment has not been received.',
    ],
  },
  {
    id: 'alterations',
    title: 'Alterations to orders',
    body: [
      'Any alteration to an order must be confirmed in writing and may be subject to additional charges. Late changes are possible and every effort will be made to accommodate them, but this cannot be guaranteed. Changes of date may incur additional charges or may simply not be possible due to the CakeUWish schedule.',
      'Changes to wedding cake flavors, serving count, and design may be made until 7 days before your wedding date. At that point everything must be finalized — no changes to serving count, flavors, or design after the 7-day mark.',
    ],
  },
  {
    id: 'cancellations',
    title: 'Cancellations & refunds',
    body: [
      'Orders cannot be cancelled or refunded within 7 days of the event. You may make any changes you wish to a retail order until 1 week prior to pickup; we cannot guarantee changes to size, flavors, or artwork requested within that final week.',
      'We are always happy to add cupcakes to an order if you need to serve more guests, and leftover cake can be frozen for another day if you ordered more than your guest count needed.',
      'All cancellation refunds are subject to a 50% fee: CakeUWish retains 50% of the price of the cake to cover costs incurred to initiate your order.',
    ],
  },
  {
    id: 'pickup',
    title: 'Pickup, transportation & delivery',
    body: [
      'If pickup is chosen at the time of order, the customer (or their representative) is responsible for picking up, transporting, and setting up the cake, and assumes all liability for the condition of the cake once it leaves CakeUWish’s possession.',
      'If the delivery & setup option is chosen, CakeUWish assumes liability and responsibility for the condition of the cake until it is set up and handed over to the customer at their chosen premises.',
    ],
  },
  {
    id: 'servings',
    title: 'Serving sizes',
    body: [
      'We guarantee that we provide the number of servings you paid for. A cutting chart with the proper way to cut your cake is available on request so you get every serving. CakeUWish can’t be held responsible if the person cutting the cake does not follow the measurements and instructions.',
    ],
  },
  {
    id: 'allergens',
    title: 'Allergy disclaimer',
    body: [
      'Our products may contain or come into contact with milk, wheat, nuts, soy, and other allergens. You agree to notify your guests of this risk and hold CakeUWish harmless for allergic reactions.',
      'Please let us know in advance of any allergies so we can take precautions. Note that this does not guarantee an allergen-free product, as CakeUWish is not an allergen-free environment.',
    ],
  },
  {
    id: 'photos',
    title: 'Photo release',
    body: [
      'By placing an order with CakeUWish, you grant CakeUWish the right to photograph your cake and any custom designs, including any names, messages, or personal details that appear on the cake, and to use these photographs for promotional purposes — including social media posts, website content, advertising, and other marketing materials. These images may be published on platforms such as Facebook and Instagram, and no compensation is provided for their use.',
      'If you prefer your cake to remain anonymous, or would rather personal details (such as names) not be shared, let us know in writing before your order is completed and we will make reasonable efforts to respect your request.',
    ],
  },
  {
    id: 'satisfaction',
    title: 'If you are not satisfied',
    body: [
      'We take pride in our cakes and desserts. If you are dissatisfied with your order, notify us immediately — within 24 hours of pickup — and return the cake or dessert to us. We will issue a credit for use toward a future purchase.',
      'All refunds are provided as CakeUWish store credit within 5 business days of receiving the returned item. We do not provide cash refunds, and cannot refund or credit without the cake being returned.',
    ],
  },
  {
    id: 'copyright',
    title: 'Copyright',
    body: [
      '© 2026 CakeUWish LLC. All cake designs, photographs, and website content are the work of CakeUWish and may not be reproduced without permission.',
    ],
  },
]

export default function TermsPage() {
  usePageMeta(
    'Terms & Policies',
    'CakeUWish ordering policies — payments, deposits, order changes, cancellations, pickup and delivery, serving sizes, allergens, and refunds.',
  )
  return (
    <>
      <PageHero
        eyebrow="The Fine Print"
        title="Terms & policies"
        intro={
          <>
            Everything about ordering, in plain language. CakeUWish LLC is a small home-based
            bakery, state-registered and certified for food safety, operated with all precautions
            required by law. Questions?{' '}
            <Link to="/contact" className="underline underline-offset-2 hover:text-primary">
              Just ask
            </Link>
            .
          </>
        }
      />
      <section className="mx-auto max-w-7xl gap-12 px-5 py-12 sm:px-8 sm:py-16 lg:grid lg:grid-cols-[240px_1fr]">
        <nav aria-label="Policy sections" className="mb-10 lg:sticky lg:top-28 lg:mb-0 lg:self-start">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">On this page</h2>
          <ul className="mt-3 flex flex-wrap gap-2 lg:flex-col lg:gap-0 lg:space-y-2">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="inline-block rounded-full border border-border px-3 py-1.5 text-sm text-foreground/80 transition-colors hover:border-primary hover:text-primary lg:rounded-none lg:border-0 lg:px-0 lg:py-0"
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="max-w-3xl space-y-10">
          {SECTIONS.map((s) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="scroll-mt-28">
              <h2 id={`${s.id}-h`} className="font-display text-2xl font-bold">
                {s.title}
              </h2>
              {s.body.map((p, i) => (
                <p key={i} className="mt-3 text-muted-foreground" style={{ lineHeight: 1.75 }}>
                  {p}
                </p>
              ))}
            </section>
          ))}
          <p className="rounded-2xl border border-border bg-muted/40 p-5 text-sm text-muted-foreground">
            By placing an order with CakeUWish you confirm that you have read and understood these
            policies and agree to the terms stated here. See also our{' '}
            <Link to="/privacy" className="underline underline-offset-2 hover:text-primary">
              privacy policy
            </Link>
            .
          </p>
        </div>
      </section>
    </>
  )
}
