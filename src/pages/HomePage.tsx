import Intro from '../components/Intro'
import Hero from '../components/Hero'
import Highlights from '../components/Highlights'
import HomeCta from '../components/HomeCta'
import { usePageMeta } from '../lib/usePageMeta'

// Slim, non-repetitive home: particle intro → exploded-cake hero (the seven
// signature cakes) → showcase film-strip (different photos) → three-path CTA.
// Browsing, reviews, and contact each live on their own page.

export default function HomePage() {
  usePageMeta()
  return (
    <>
      <Intro />
      <Hero />
      <Highlights />
      <HomeCta />
    </>
  )
}
