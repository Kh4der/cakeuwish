import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { MessageCircle } from 'lucide-react'
import { WHATSAPP_ENABLED, WHATSAPP_URL } from '../data/cakes'

export default function WhatsAppFab() {
  if (!WHATSAPP_ENABLED) return <FabDisabled />
  return <FabEnabled />
}

// Hooks live in the inner component so the early return above stays legal.
function FabDisabled() {
  return null
}

function FabEnabled() {
  const { pathname } = useLocation()
  const isHome = pathname === '/'
  const [show, setShow] = useState(!isHome)
  useEffect(() => {
    // Away from home there's no hero to wait for — always show.
    if (!isHome) {
      setShow(true)
      return
    }
    const onScroll = () => {
      const hero = document.getElementById('top')
      setShow(hero ? hero.getBoundingClientRect().bottom < window.innerHeight * 0.6 : window.scrollY > window.innerHeight * 1.95)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [isHome])

  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Order on WhatsApp"
      data-loc="fab"
      tabIndex={show ? 0 : -1}
      aria-hidden={!show}
      className={`fixed z-[90] flex h-14 w-14 items-center justify-center rounded-full text-white transition-all duration-300 hover:scale-110 ${show ? 'scale-100 opacity-100' : 'pointer-events-none scale-50 opacity-0'}`}
      style={{ backgroundColor: '#1A8A4E', boxShadow: '0 4px 14px rgba(0,0,0,0.28), 0 0 0 1.5px #0E7A41', right: 'max(1.25rem, env(safe-area-inset-right))', bottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
    >
      <MessageCircle size={28} fill="white" strokeWidth={0} aria-hidden="true" />
    </a>
  )
}
