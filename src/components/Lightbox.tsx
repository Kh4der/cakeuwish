import { useCallback, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

interface Photo {
  src: string
  alt: string
  mediaType?: 'image' | 'video'
}

/** Full-screen photo viewer with keyboard navigation (Esc / arrows). */
export default function Lightbox({
  photos,
  index,
  onClose,
  onIndex,
}: {
  photos: Photo[]
  index: number
  onClose: () => void
  onIndex: (i: number) => void
}) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const photo = photos[index]

  const prev = useCallback(
    () => onIndex((index - 1 + photos.length) % photos.length),
    [index, photos.length, onIndex],
  )
  const next = useCallback(() => onIndex((index + 1) % photos.length), [index, photos.length, onIndex])

  // Mount-only: freeze the page behind the dialog (site convention, matching
  // ScatterGallery) and hand focus back to the opener on close. Lenis is absent
  // on touchscreens and under reduced motion, so lock the body directly too —
  // otherwise the gallery scrolls away underneath the open lightbox on a phone.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const lenis = (window as Window & { __lenis?: { stop?: () => void; start?: () => void } }).__lenis
    lenis?.stop?.()
    const body = document.body
    const prevOverflow = body.style.overflow
    const prevPadding = body.style.paddingRight
    const gap = window.innerWidth - document.documentElement.clientWidth
    body.style.overflow = 'hidden'
    if (gap > 0) body.style.paddingRight = `${gap}px` // no layout jump on desktop
    closeRef.current?.focus()
    return () => {
      lenis?.start?.()
      body.style.overflow = prevOverflow
      body.style.paddingRight = prevPadding
      opener?.focus?.()
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      // Arrow keys seek when a video has focus — don't hijack them.
      if ((e.target as HTMLElement | null)?.tagName === 'VIDEO') return
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, prev, next])

  if (!photo) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={photo.alt}
      className="lb-backdrop fixed inset-0 z-[120] flex items-center justify-center bg-espresso/85 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <figure
        className="lb-panel relative max-h-[86svh] w-full max-w-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {photo.mediaType === 'video' ? (
          <video
            src={photo.src}
            controls
            autoPlay
            playsInline
            aria-label={photo.alt}
            className="mx-auto max-h-[80svh] w-auto max-w-full rounded-2xl object-contain shadow-cake"
          />
        ) : (
          <img
            src={photo.src}
            alt={photo.alt}
            className="mx-auto max-h-[80svh] w-auto max-w-full rounded-2xl object-contain shadow-cake"
          />
        )}
        <figcaption className="mt-4 text-center font-display text-base italic text-cream/90">
          {photo.alt}
          <span className="mx-2 text-gold-soft" aria-hidden="true">·</span>
          <span className="font-body text-[11px] font-medium uppercase not-italic tracking-[0.2em] text-cream/60">
            {index + 1} of {photos.length}
          </span>
        </figcaption>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="glass absolute right-2 top-2 z-10 flex h-11 w-11 items-center justify-center rounded-full text-primary transition-transform duration-300 hover:scale-105"
        >
          <X size={20} />
        </button>
        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Previous photo"
              className="glass absolute left-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-primary transition-transform duration-300 hover:scale-105"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Next photo"
              className="glass absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-primary transition-transform duration-300 hover:scale-105"
            >
              <ChevronRight size={22} />
            </button>
          </>
        )}
      </figure>
    </div>
  )
}
