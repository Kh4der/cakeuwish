import { useEffect } from 'react'

const DEFAULT_TITLE = 'CakeUWish — Custom Cakes, Baked in Chantilly VA'
const DEFAULT_DESCRIPTION =
  'CakeUWish — handcrafted custom celebration cakes, baked in Chantilly, VA. Birthdays, weddings, milestones & more. 4.9★ from 194 Google reviews. Request a quote online.'

/** Set the document title + meta description for a page (restored defaults come from the next page's call). */
export function usePageMeta(title?: string, description?: string) {
  useEffect(() => {
    document.title = title ? `${title} · CakeUWish` : DEFAULT_TITLE
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', description ?? DEFAULT_DESCRIPTION)
  }, [title, description])
}
