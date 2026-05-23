import { MessageCircle, MapPin, Clock } from 'lucide-react'
import { WHATSAPP_URL, WHATSAPP_DISPLAY } from '../data/cakes'

export default function Contact() {
  return (
    <section id="contact" className="bg-primary text-cream">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-2">
        <div>
          <p data-reveal className="font-display text-lg italic text-cream/95">Let's make something together</p>
          <h2 data-reveal className="mt-1 font-display text-3xl font-bold sm:text-5xl">Ready to order?</h2>
          <p className="mt-6 max-w-md text-cream" style={{ lineHeight: 1.7 }}>
            Every cake starts with a conversation. Tell Parul what you're celebrating, your vision
            (rough is fine — she's heard it all), and your date. From there, she'll design something
            that fits your moment perfectly.
          </p>
          <p className="mt-3 max-w-md font-display text-xl italic text-cream/90">
            No two cakes are the same here. That's the whole point.
          </p>

          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex min-h-[44px] items-center gap-3 rounded-full px-7 py-4 text-base font-semibold text-white shadow-lg transition-transform duration-200 hover:scale-105"
            style={{ backgroundColor: '#1A8A4E' }}
          >
            <MessageCircle size={22} fill="white" strokeWidth={0} />
            Message Parul on WhatsApp
          </a>
          <p className="mt-4 max-w-md text-sm text-cream/95">
            Custom cakes typically need 2–4 weeks' notice. The more detail you share, the more Parul
            can bring to life — so reach out early and let's start planning.
          </p>
        </div>

        <div className="flex flex-col justify-center gap-6">
          <div className="rounded-2xl border border-cream/15 bg-cream/5 p-6">
            <div className="flex items-center gap-3 text-cream">
              <MessageCircle size={20} /> <span className="font-semibold">WhatsApp</span>
            </div>
            <p className="mt-1 text-cream">{WHATSAPP_DISPLAY}</p>
          </div>
          <div className="rounded-2xl border border-cream/15 bg-cream/5 p-6">
            <div className="flex items-center gap-3 text-cream">
              <MapPin size={20} /> <span className="font-semibold">Where</span>
            </div>
            <p className="mt-1 text-cream">Home-based bakery · Chantilly, VA · Serving the DMV</p>
          </div>
          <div className="rounded-2xl border border-cream/15 bg-cream/5 p-6">
            <div className="flex items-center gap-3 text-cream">
              <Clock size={20} /> <span className="font-semibold">Hours</span>
            </div>
            <p className="mt-1 text-cream">Orders by appointment · DM or WhatsApp to connect</p>
          </div>
        </div>
      </div>
    </section>
  )
}
