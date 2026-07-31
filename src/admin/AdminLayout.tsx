import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  BadgeDollarSign,
  BarChart3,
  BookOpenText,
  Cake,
  CalendarDays,
  Coins,
  ClipboardList,
  Images,
  Inbox,
  LayoutDashboard,
  LogOut,
  ExternalLink,
  AtSign,
  ReceiptText,
  Send,
  ShieldCheck,
} from 'lucide-react'
import { useAuth } from './auth'

// Grouped by how Parul works: money first, then customer conversations and
// scheduling, then the site's content, then traffic stats.
const GROUPS = [
  {
    title: null,
    items: [
      { to: '/', label: 'Overview', short: 'Home', icon: LayoutDashboard, end: true },
      { to: '/vendors', label: 'Vendors & bills', short: 'Bills', icon: ReceiptText, end: false },
    ],
  },
  {
    title: 'Customers',
    items: [
      { to: '/inbox', label: 'Inbox', short: 'Inbox', icon: Inbox, end: false },
      { to: '/compose', label: 'Share a post', short: 'Share', icon: Send, end: false },
      { to: '/social', label: 'X mentions', short: 'X', icon: AtSign, end: false },
      { to: '/orders', label: 'Orders', short: 'Orders', icon: ClipboardList, end: false },
      { to: '/calendar', label: 'Calendar', short: 'Days', icon: CalendarDays, end: false },
    ],
  },
  {
    title: 'Website content',
    items: [
      { to: '/cakes', label: 'Cakes', short: 'Cakes', icon: Cake, end: false },
      { to: '/showcase', label: 'Photos & videos', short: 'Media', icon: Images, end: false },
      { to: '/pricing', label: 'Pricing', short: 'Prices', icon: BadgeDollarSign, end: false },
      { to: '/knowledge', label: 'AI assistant facts', short: 'AI', icon: BookOpenText, end: false },
    ],
  },
  {
    title: 'Insights',
    items: [
      { to: '/analytics', label: 'Site analytics', short: 'Stats', icon: BarChart3, end: false },
      { to: '/costs', label: 'API costs', short: 'Costs', icon: Coins, end: false },
    ],
  },
]

const ITEMS = GROUPS.flatMap((g) => g.items)

const cls = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
    isActive ? 'bg-primary text-on-primary' : 'text-foreground/80 hover:bg-muted'
  }`

const SETUP_ITEM = { to: '/setup', label: 'Setup', short: 'Setup', icon: ShieldCheck, end: false }

export default function AdminLayout() {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  // The installation panel is shown only to the super admin (email match).
  const [isSuper, setIsSuper] = useState(false)
  useEffect(() => {
    let active = true
    Promise.all([
      import('./lib/configDb').then((m) => m.getConfig()).catch(() => null),
      import('./lib/configDb').then((m) => m.currentEmail()).catch(() => ''),
    ]).then(([cfg, email]) => {
      if (active && cfg && email && cfg.superAdminEmail === email) setIsSuper(true)
    })
    return () => {
      active = false
    }
  }, [])

  const onSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-muted/30 text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <span className="font-display text-lg font-bold">
            CakeUWish <span className="text-accent">Admin</span>
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-foreground/80 hover:bg-muted sm:flex"
            >
              <ExternalLink size={15} /> View site
            </a>
            <button
              type="button"
              onClick={onSignOut}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-foreground/80 hover:bg-muted"
            >
              <LogOut size={15} /> Sign out
            </button>
          </div>
        </div>
        {/* compact nav below lg */}
        <nav className="flex items-center gap-1 overflow-x-auto border-t border-border px-2 py-1.5 lg:hidden">
          {ITEMS.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={cls}>
              <n.icon size={16} /> {n.short}
            </NavLink>
          ))}
          {isSuper && (
            <NavLink to={SETUP_ITEM.to} className={cls}>
              <SETUP_ITEM.icon size={16} /> {SETUP_ITEM.short}
            </NavLink>
          )}
        </nav>
      </header>

      <div className="mx-auto flex max-w-7xl gap-8 px-4 py-8 sm:px-6">
        {/* grouped sidebar on lg+ */}
        <aside className="sticky top-20 hidden w-52 shrink-0 self-start lg:block">
          <nav className="space-y-5">
            {GROUPS.map((g, gi) => (
              <div key={g.title ?? gi}>
                {g.title && (
                  <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {g.title}
                  </p>
                )}
                <div className="space-y-0.5">
                  {g.items.map((n) => (
                    <NavLink key={n.to} to={n.to} end={n.end} className={cls}>
                      <n.icon size={16} /> {n.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
            {isSuper && (
              <div>
                <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Agency
                </p>
                <NavLink to={SETUP_ITEM.to} className={cls}>
                  <SETUP_ITEM.icon size={16} /> {SETUP_ITEM.label}
                </NavLink>
              </div>
            )}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
