import { ArrowUpRight } from 'lucide-react'
import { CAKES, WHATSAPP_URL } from '../data/cakes'

const enquire = (title: string) =>
  `${WHATSAPP_URL}?text=${encodeURIComponent(`Hi! I'd love a cake like "${title}".`)}`

/**
 * Presentational expanding accordion: the cake at `active` is opened (flex 6),
 * the rest stay as thin slices (flex 0.6). The parent (Gallery) drives `active`
 * from scroll progress, so each cake opens up in turn as you scroll. Mobile =
 * a vertical stack (active panel tall); desktop = a horizontal row (active wide).
 */
export default function ExpandingCarousel({ active, fillHeight = false }: { active: number; fillHeight?: boolean }) {
  return (
    <div
      role="group"
      aria-label="Featured cakes"
      className="flex h-full w-full flex-col gap-2.5 md:flex-row"
      style={{ height: fillHeight ? '100%' : 540, minHeight: 0 }}
    >
      {CAKES.map((c, i) => {
        const isActive = i === active
        return (
          <div
            key={c.id}
            aria-hidden={!isActive}
            className="group relative overflow-hidden rounded-2xl"
            style={{
              flex: isActive ? '6 1 0%' : '0.6 1 0%',
              minWidth: 0,
              minHeight: 0,
              backgroundColor: c.bg,
              transition: 'flex 0.6s cubic-bezier(0.6,0,0.2,1)',
            }}
          >
            <img
              src={`/cakes/${c.id}/full.webp`}
              alt={c.title}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full transition-all duration-500"
              style={{ objectFit: isActive ? 'contain' : 'cover', objectPosition: 'center', padding: isActive ? '6% 6% 14%' : 0, filter: 'brightness(1.02) saturate(1.06)' }}
            />
            {/* readability scrim */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5" style={{ background: 'linear-gradient(to top, rgba(12,10,9,0.72), rgba(12,10,9,0))' }} />

            {/* slice (closed): vertical title */}
            {!isActive && (
              <span
                className="absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-semibold uppercase tracking-widest text-white/90 md:[writing-mode:vertical-rl]"
                style={{ transform: 'translateX(-50%)' }}
              >
                {c.title}
              </span>
            )}

            {/* opened: full details + enquire link */}
            {isActive && (
              <div className="absolute inset-x-0 bottom-0 p-5 text-left sm:p-7">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-white/80">{c.category}</span>
                <h3 className="font-display text-2xl font-bold leading-tight text-white sm:text-4xl">{c.title}</h3>
                <p className="mt-1.5 hidden max-w-md text-sm text-white/85 sm:line-clamp-2 sm:block">{c.blurb}</p>
                <a
                  href={enquire(c.title)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-4 py-2 text-sm font-semibold text-[#1C1917] transition-transform hover:scale-105"
                >
                  Enquire about this <ArrowUpRight size={16} aria-hidden="true" />
                </a>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
