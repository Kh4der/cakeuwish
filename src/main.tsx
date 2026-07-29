import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ContentProvider } from './content/ContentProvider'
import { initAnalytics, installCtaTracking, installSectionTracking } from './lib/analytics'

const root = createRoot(document.getElementById('root')!)

if (window.location.pathname.startsWith('/admin')) {
  // Admin is a separate, lazily-loaded chunk — none of its code (or supabase
  // CRUD) ships with the public site.
  import('./admin/AdminApp').then(({ default: AdminApp }) => {
    root.render(
      <StrictMode>
        <AdminApp />
      </StrictMode>,
    )
  })
} else {
  root.render(
    <StrictMode>
      <ContentProvider>
        <App />
      </ContentProvider>
    </StrictMode>,
  )
  // Analytics is best-effort and self-disables when no key is configured
  // (PostHog itself still loads lazily inside initAnalytics).
  initAnalytics()
  installCtaTracking()
  installSectionTracking()
}
