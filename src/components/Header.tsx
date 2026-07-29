import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Menu, X, MessageCircle } from 'lucide-react'
import { WHATSAPP_ENABLED, WHATSAPP_URL } from '../data/cakes'

const LINKS = [
  { to: '/gallery', label: 'Gallery' },
  { to: '/builder', label: 'Cake Builder' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/order', label: 'How to Order' },
  { to: '/faq', label: 'FAQ' },
  { to: '/contact', label: 'Contact' },
]

export default function Header() {
  const { pathname } = useLocation()
  const isHome = pathname === '/'
  const [show, setShow] = useState(!isHome)
  const [open, setOpen] = useState(false)

  // On the home page the header stays hidden until the hero has scrolled by;
  // on every other page it is always visible.
  useEffect(() => {
    if (!isHome) {
      setShow(true)
      return
    }
    const onScroll = () => {
      const hero = document.getElementById('top')
      setShow(hero ? hero.getBoundingClientRect().bottom < window.innerHeight * 0.6 : window.scrollY > window.innerHeight * 1.9)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [isHome])

  // Close the mobile menu on navigation.
  useEffect(() => setOpen(false), [pathname])

  const navLinkCls = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium transition-colors hover:text-primary ${isActive ? 'text-primary' : 'text-foreground/80'}`

  return (
    <header
      className="fixed inset-x-0 top-0 z-[80] transition-transform duration-300"
      style={{ transform: show ? 'translateY(0)' : 'translateY(-100%)' }}
    >
      <div className="border-b border-border/60 bg-background/95 shadow-soft">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 sm:px-8" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
          <Link to="/" className="font-display text-xl font-bold text-primary">
            CakeUWish
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-7 md:flex">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} className={navLinkCls}>
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            {WHATSAPP_ENABLED && (
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                data-loc="header"
                aria-label="Message us on WhatsApp"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-foreground/80 transition-colors hover:border-primary hover:text-primary"
              >
                <MessageCircle size={17} />
              </a>
            )}
            <Link
              to="/order#request"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover"
            >
              Request a Quote
            </Link>
          </div>
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center text-foreground md:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle navigation menu"
            aria-expanded={open}
            aria-controls="mobile-nav"
          >
            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
        {open && (
          <nav id="mobile-nav" aria-label="Mobile" className="flex flex-col gap-1 border-t border-border/70 bg-background px-5 py-3 md:hidden">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} className="py-3 text-left text-base font-medium text-foreground/90">
                {l.label}
              </NavLink>
            ))}
            <Link
              to="/order#request"
              className="mt-1 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary"
            >
              Request a Quote
            </Link>
            {WHATSAPP_ENABLED && (
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                data-loc="header"
                className="mt-2 inline-flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-foreground/90"
              >
                <MessageCircle size={16} /> Order on WhatsApp
              </a>
            )}
          </nav>
        )}
      </div>
    </header>
  )
}
