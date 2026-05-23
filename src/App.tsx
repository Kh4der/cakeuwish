import Header from './components/Header'
import Intro from './components/Intro'
import Hero from './components/Hero'
import Gallery from './components/Gallery'
import ScatterGallery from './components/ScatterGallery'
import Categories from './components/Categories'
import Reviews from './components/Reviews'
import Contact from './components/Contact'
import Footer from './components/Footer'
import WhatsAppFab from './components/WhatsAppFab'
import CustomCursor from './components/CustomCursor'
import { useSmoothScroll } from './lib/smoothScroll'
import { useScrollReveal } from './lib/useScrollReveal'

export default function App() {
  useSmoothScroll()
  useScrollReveal()
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-on-primary focus:shadow-lg"
      >
        Skip to content
      </a>
      <Header />
      <main id="main-content">
        <Intro />
        <Hero />
        <Gallery />
        <ScatterGallery />
        <Categories />
        <Reviews />
        <Contact />
      </main>
      <Footer />
      <WhatsAppFab />
      <CustomCursor />
    </>
  )
}
