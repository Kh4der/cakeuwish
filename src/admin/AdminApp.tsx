import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { isSupabaseConfigured } from '../lib/supabase'
import { AuthProvider, useAuth } from './auth'
import SetupNotice from './SetupNotice'
import Login from './Login'
import AdminLayout from './AdminLayout'
import Dashboard from './Dashboard'
import CakesManager from './CakesManager'
import ShowcaseManager from './ShowcaseManager'
import InquiriesManager from './InquiriesManager'
import OrdersManager from './OrdersManager'
import CalendarManager from './CalendarManager'
import KnowledgeManager from './KnowledgeManager'
import PricingManager from './PricingManager'
import Overview from './Overview'
import VendorsManager from './VendorsManager'
import SetupManager from './SetupManager'
import SocialManager from './SocialManager'
import ComposeManager from './ComposeManager'

function Guard() {
  const { session, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="animate-spin" size={22} />
      </div>
    )
  }
  if (!session) return <Navigate to="/login" replace />
  return <Outlet />
}

export default function AdminApp() {
  // No backend configured yet → show setup instructions instead of a dead login.
  if (!isSupabaseConfigured) return <SetupNotice />

  return (
    <AuthProvider>
      <BrowserRouter basename="/admin">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Guard />}>
            <Route element={<AdminLayout />}>
              <Route index element={<Overview />} />
              <Route path="vendors" element={<VendorsManager />} />
              <Route path="analytics" element={<Dashboard />} />
              <Route path="inbox" element={<InquiriesManager />} />
              {/* old bookmark */}
              <Route path="inquiries" element={<Navigate to="/inbox" replace />} />
              <Route path="orders" element={<OrdersManager />} />
              <Route path="calendar" element={<CalendarManager />} />
              <Route path="cakes" element={<CakesManager />} />
              <Route path="showcase" element={<ShowcaseManager />} />
              <Route path="pricing" element={<PricingManager />} />
              <Route path="knowledge" element={<KnowledgeManager />} />
              <Route path="compose" element={<ComposeManager />} />
              <Route path="social" element={<SocialManager />} />
              <Route path="setup" element={<SetupManager />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
