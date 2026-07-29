import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { CakeContent, ShowcaseContent } from './types'
import { SEED_CAKES } from '../data/cakes'
import { SEED_SHOWCASE } from '../data/showcase'

interface ContentValue {
  cakes: CakeContent[]
  showcase: ShowcaseContent[]
  /** true while the first Supabase hydration is in flight */
  loading: boolean
}

const ContentContext = createContext<ContentValue>({
  cakes: SEED_CAKES,
  showcase: SEED_SHOWCASE,
  loading: false,
})

/**
 * Provides cake + showcase content to the public site. Renders instantly with
 * the bundled seed (no flash, no loading gate), then — only if Supabase is
 * configured — hydrates with the live content. supabase-js is reached purely via
 * dynamic import here, so it never enters the public entry chunk when unused.
 */
export function ContentProvider({ children }: { children: ReactNode }) {
  const [cakes, setCakes] = useState<CakeContent[]>(SEED_CAKES)
  const [showcase, setShowcase] = useState<ShowcaseContent[]>(SEED_SHOWCASE)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!import.meta.env.VITE_SUPABASE_URL) return
    let active = true
    setLoading(true)
    import('./fetchContent')
      .then(({ fetchPublicContent }) => fetchPublicContent())
      .then((data) => {
        if (!active || !data) return
        if (data.cakes.length) setCakes(data.cakes)
        if (data.showcase.length) setShowcase(data.showcase)
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  return (
    <ContentContext.Provider value={{ cakes, showcase, loading }}>
      {children}
    </ContentContext.Provider>
  )
}

export const useContent = () => useContext(ContentContext)
