import { lazy } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'

// The home page stays in the entry chunk (first paint); everything else is a
// lazy route chunk so the one-pager's performance budget is untouched.
const GalleryPage = lazy(() => import('./pages/GalleryPage'))
const CakeBuilderPage = lazy(() => import('./pages/CakeBuilderPage'))
const CakeDetailPage = lazy(() => import('./pages/CakeDetailPage'))
const OrderPage = lazy(() => import('./pages/OrderPage'))
const PricingPage = lazy(() => import('./pages/PricingPage'))
const FaqPage = lazy(() => import('./pages/FaqPage'))
const ContactPage = lazy(() => import('./pages/ContactPage'))
const ReviewsPage = lazy(() => import('./pages/ReviewsPage'))
const TermsPage = lazy(() => import('./pages/TermsPage'))
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="gallery" element={<GalleryPage />} />
          <Route path="builder" element={<CakeBuilderPage />} />
          <Route path="cakes/:id" element={<CakeDetailPage />} />
          <Route path="order" element={<OrderPage />} />
          <Route path="pricing" element={<PricingPage />} />
          <Route path="faq" element={<FaqPage />} />
          <Route path="contact" element={<ContactPage />} />
          <Route path="reviews" element={<ReviewsPage />} />
          <Route path="terms" element={<TermsPage />} />
          <Route path="privacy" element={<PrivacyPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
