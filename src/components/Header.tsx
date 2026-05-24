import { useEffect, useState } from 'react'
import { Menu, X, MessageCircle } from 'lucide-react'
import { scrollToId } from '../lib/smoothScroll'
import { WHATSAPP_URL } from '../data/cakes'

const LINKS = [
  { id: 'work', label: 'Work' },
  { id: 'menu', label: 'What We Make' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'contact', label: 'Contact' },
]

export default function Header() {
  const [show, setShow] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      const hero = document.getElementById('top')
      setShow(hero ? hero.getBoundingClientRect().bottom < window.innerHeight * 0.6 : window.scrollY > window.innerHeight * 1.9)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const go = (id: string) => { setOpen(false); scrollToId(id) }

  return (
    <header
      className="fixed inset-x-0 top-0 z-[80] transition-transform duration-300"
      style={{ transform: show ? 'translateY(0)' : 'translateY(-100%)' }}
    >
      <div className="border-b border-border/60 bg-background/95 shadow-soft">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 sm:px-8" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
          <a href="#top" onClick={(e) => { e.preventDefault(); go('top') }} className="font-display text-xl font-bold text-primary">
            CakeUWish
          </a>
          <nav aria-label="Main" className="hidden items-center gap-8 md:flex">
            {LINKS.map((l) => (
              <button
                type="button"
                key={l.id}
                onClick={() => go(l.id)}
                className="text-sm font-medium text-foreground/80 transition-colors hover:text-primary"
              >
                {l.label}
              </button>
            ))}
          </nav>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover md:inline-flex"
          >
            <MessageCircle size={16} /> Order
          </a>
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
              <button type="button" key={l.id} onClick={() => go(l.id)} className="py-3 text-left text-base font-medium text-foreground/90">
                {l.label}
              </button>
            ))}
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary"
            >
              <MessageCircle size={16} /> Order on WhatsApp
            </a>
          </nav>
        )}
      </div>
    </header>
  )
}
