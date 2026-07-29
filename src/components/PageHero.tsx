import { Suspense, lazy, useEffect, useState, type ReactNode } from 'react'
import ShaderSilk from './premium/ShaderSilk'

// Three.js sprinkles load lazily and only on wide, motion-friendly screens —
// the shader alone carries the mood everywhere else.
const Sprinkles3D = lazy(() => import('./premium/Sprinkles3D'))

/**
 * Editorial header band for subpages: flowing WebGL silk backdrop, drifting 3D
 * sprinkles (desktop), oversized Playfair display type per the exaggerated-
 * minimalism direction, and a slot for page controls.
 */
export default function PageHero({
  eyebrow,
  title,
  intro,
  children,
  sprinkles = true,
}: {
  eyebrow: string
  title: string
  intro?: ReactNode
  children?: ReactNode
  sprinkles?: boolean
}) {
  const [deco, setDeco] = useState(false)
  useEffect(() => {
    if (!sprinkles) return
    const wide = window.matchMedia('(min-width: 1024px)').matches
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (wide && !still) setDeco(true)
  }, [sprinkles])

  return (
    <section className="relative overflow-hidden border-b border-border">
      <ShaderSilk />
      {deco && (
        <Suspense fallback={null}>
          <Sprinkles3D />
        </Suspense>
      )}
      <div className="relative mx-auto max-w-7xl px-5 pb-14 pt-32 sm:px-8 sm:pb-20 sm:pt-40">
        <p data-reveal className="flex items-center gap-3 font-display text-lg italic text-accent">
          <span className="inline-block h-px w-10 bg-accent/60" aria-hidden="true" />
          {eyebrow}
        </p>
        <h1
          data-reveal
          className="mt-3 font-display font-bold leading-[0.98] tracking-tight"
          style={{ fontSize: 'clamp(2.6rem, 7vw, 5.5rem)' }}
        >
          {title}
        </h1>
        {intro && (
          <p data-reveal className="mt-6 max-w-2xl text-lg text-muted-foreground" style={{ lineHeight: 1.7 }}>
            {intro}
          </p>
        )}
        {children}
      </div>
    </section>
  )
}
