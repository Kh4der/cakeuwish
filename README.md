# CakeUWish

Marketing website for **CakeUWish LLC** — custom celebration cakes, baked in Chantilly, VA.

A one-page interactive site: a particle-wordmark intro with a watercolor "flower garden",
a scroll-driven exploded-cake hero carousel, an expanding category showcase, a scatter→arc
gallery with lightbox, a 3D draggable reviews ring, and WhatsApp ordering.

## Tech

- **Vite** + **React 19** + **TypeScript**
- **Tailwind CSS v4**
- **GSAP** (ScrollTrigger) + **Lenis** smooth scroll
- Canvas-based interactions (particle wordmark, watercolor blooms, letter cursor)

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
```

## Build

```bash
npm run build    # type-check (tsc -b) + production build to dist/
npm run preview  # preview the production build locally
```

## Accessibility & cross-device

Respects `prefers-reduced-motion` (static fallbacks for all canvas effects), uses dynamic
viewport units (`svh`) and safe-area insets for mobile, and ships WCAG-AA contrast.
