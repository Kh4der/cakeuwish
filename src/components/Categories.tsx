import { CakeSlice, Heart, Baby, Gem, Sparkles, Cookie, Wand2 } from 'lucide-react'
import { CATEGORIES } from '../data/cakes'

const ICONS = [Heart, Gem, Baby, Sparkles, Wand2, Cookie, CakeSlice]
const TAGLINES = [
  'Make the wish unforgettable.',
  'The centerpiece of your forever.',
  'Their favorite world, in cake.',
  'Big numbers deserve a big moment.',
  'If you can dream it, we can bake it.',
  'Little bites, big smiles.',
  'Start from scratch — literally.',
]

export default function Categories() {
  return (
    <section id="menu" className="bg-muted/40">
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
        <p data-reveal className="font-display text-lg italic text-accent">What We Make</p>
        <h2 data-reveal className="mt-1 font-display text-3xl font-bold sm:text-5xl">Pick a starting point.</h2>
        <p data-reveal className="mt-3 max-w-2xl text-muted-foreground">
          From whimsical to black-tie, every category is a starting point — not a limit.
        </p>

        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((c, i) => {
            const Icon = ICONS[i % ICONS.length]
            return (
              <div
                key={c}
                className="flex items-start gap-4 rounded-2xl border border-border bg-card p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-cake"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted text-primary">
                  <Icon size={24} strokeWidth={2} />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-card-foreground">{c}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{TAGLINES[i]}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
