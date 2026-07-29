import { type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { FACEBOOK_URL, PHONE_TEL, WHATSAPP_DISPLAY, WHATSAPP_ENABLED, WHATSAPP_URL } from '../data/cakes'

function FacebookIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22 12a10 10 0 1 0-11.563 9.875v-6.988H7.898V12h2.539V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.887h-2.33v6.988A10.002 10.002 0 0 0 22 12Z" />
    </svg>
  )
}

const EXPLORE = [
  { to: '/gallery', label: 'Cake Gallery' },
  { to: '/builder', label: 'Cake Builder' },
  { to: '/pricing', label: 'Pricing Guide' },
  { to: '/order', label: 'How to Order' },
  { to: '/reviews', label: 'Reviews' },
  { to: '/faq', label: 'FAQs' },
  { to: '/contact', label: 'Contact' },
]

const LEGAL = [
  { to: '/terms', label: 'Terms & Policies' },
  { to: '/terms#allergens', label: 'Allergy Disclaimer' },
  { to: '/privacy', label: 'Privacy Policy' },
]

const MARQUEE = [
  'custom cakes',
  'eggless specialty',
  'wedding cakes',
  'Chantilly, VA',
  '4.9 stars on Google',
  'baked with love',
]

// One copy of the phrase loop — .marquee-track holds two so the -50% keyframe
// wraps seamlessly (the pr matches the inter-item gap).
function MarqueeCopy() {
  return (
    <div className="flex items-center gap-8 pr-8">
      {MARQUEE.map((phrase) => (
        <span
          key={phrase}
          className="inline-flex items-center gap-8 whitespace-nowrap font-display text-xs font-semibold uppercase tracking-[0.32em] text-cream/55"
        >
          {phrase}
          <span className="text-gold-soft" style={{ fontSize: '0.55rem' }}>
            ●
          </span>
        </span>
      ))}
    </div>
  )
}

export default function Footer() {
  return (
    <footer className="bg-espresso text-cream/75">
      {/* editorial ticker */}
      <div
        aria-hidden="true"
        className="overflow-hidden border-b border-cream/10 py-5"
        style={{
          maskImage: 'linear-gradient(90deg, transparent, black 8%, black 92%, transparent)',
          WebkitMaskImage: 'linear-gradient(90deg, transparent, black 8%, black 92%, transparent)',
        }}
      >
        <div className="marquee-track" style={{ '--marquee-duration': '38s' } as CSSProperties}>
          <MarqueeCopy />
          <MarqueeCopy />
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
        <div>
          <div className="font-display text-2xl font-bold text-cream">CakeUWish</div>
          <div className="gold-rule mt-3 max-w-[6rem] opacity-70" aria-hidden="true" />
          <p className="mt-3 text-sm">Chantilly, VA · Home-baked in Northern Virginia</p>
          <p className="mt-1 text-sm">
            {WHATSAPP_ENABLED ? 'Orders by appointment · DM or WhatsApp to connect' : 'Orders by appointment · call, text, or send a note'}
          </p>
          <a
            href={FACEBOOK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-sm text-cream/85 transition-colors hover:text-cream"
          >
            <FacebookIcon size={18} /> facebook.com/CakeUWishVA
          </a>
        </div>
        <nav aria-label="Explore">
          <h3 className="font-display text-sm font-bold uppercase tracking-widest text-cream/90">Explore</h3>
          <ul className="mt-4 space-y-2.5">
            {EXPLORE.map((l) => (
              <li key={l.to}>
                <Link
                  to={l.to}
                  className="inline-block text-sm text-cream/80 transition-[color,transform] duration-300 hover:translate-x-1 hover:text-cream"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Policies">
          <h3 className="font-display text-sm font-bold uppercase tracking-widest text-cream/90">Policies</h3>
          <ul className="mt-4 space-y-2.5">
            {LEGAL.map((l) => (
              <li key={l.to}>
                <Link
                  to={l.to}
                  className="inline-block text-sm text-cream/80 transition-[color,transform] duration-300 hover:translate-x-1 hover:text-cream"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <h3 className="font-display text-sm font-bold uppercase tracking-widest text-cream/90">Order</h3>
          <p className="mt-4 text-sm">Custom cakes typically need 2–4 weeks' notice.</p>
          {WHATSAPP_ENABLED ? (
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              data-loc="footer"
              className="mt-3 inline-block text-sm font-semibold text-cream underline-offset-4 hover:underline"
            >
              WhatsApp {WHATSAPP_DISPLAY}
            </a>
          ) : (
            <a href={PHONE_TEL} className="mt-3 inline-block text-sm font-semibold text-cream underline-offset-4 hover:underline">
              Call or text {WHATSAPP_DISPLAY}
            </a>
          )}
          <div className="mt-2">
            <Link to="/order#request" className="text-sm font-semibold text-cream underline-offset-4 hover:underline">
              Request a quote →
            </Link>
          </div>
        </div>
      </div>

      {/* giant editorial wordmark, cropped by the copyright rule */}
      <div aria-hidden="true" className="overflow-hidden px-5 sm:px-8">
        <p
          className="mx-auto max-w-7xl translate-y-[14%] select-none text-center font-display font-bold leading-none text-cream/[0.08]"
          style={{ fontSize: 'clamp(4rem, 12.5vw, 9rem)', letterSpacing: '-0.02em' }}
        >
          CakeUWish
        </p>
      </div>
      <div className="border-t border-cream/10">
        <p className="mx-auto max-w-7xl px-5 py-5 text-xs text-cream/70 sm:px-8">
          © 2026 CakeUWish LLC. All rights reserved. All cake designs and photographs are the work of
          CakeUWish. Home-baked with a whole lot of love.
        </p>
      </div>
    </footer>
  )
}
