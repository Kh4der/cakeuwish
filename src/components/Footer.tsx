import { FACEBOOK_URL } from '../data/cakes'

function FacebookIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22 12a10 10 0 1 0-11.563 9.875v-6.988H7.898V12h2.539V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.887h-2.33v6.988A10.002 10.002 0 0 0 22 12Z" />
    </svg>
  )
}

export default function Footer() {
  return (
    <footer className="bg-espresso text-cream/75">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-12 sm:flex-row sm:items-end sm:justify-between sm:px-8">
        <div>
          <div className="font-display text-2xl font-bold text-cream">CakeUWish</div>
          <p className="mt-1 text-sm">Chantilly, VA · Home-baked in Northern Virginia</p>
          <p className="mt-1 text-sm">Orders by appointment · DM or WhatsApp to connect</p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <a
            href={FACEBOOK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-cream/85 transition-colors hover:text-cream"
          >
            <FacebookIcon size={18} /> facebook.com/CakeUWishVA
          </a>
          <p className="text-xs text-cream/75">
            © 2026 CakeUWish. Home-baked with a whole lot of love.
          </p>
        </div>
      </div>
    </footer>
  )
}
