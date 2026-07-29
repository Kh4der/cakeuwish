# Configuration — everything in one place

This project is a **complete bakery-website framework**: luxury public site
(gallery, AI cake builder, quote/booking forms, live Google reviews, AI chat)
plus a full admin back-office (inbox, orders, calendar, pricing, media,
vendors & bills with receipt scanning, business dashboard). Deploy it for a
new client by walking this file top to bottom — roughly **one hour** of setup.

Three places hold ALL configuration:

| Where | What lives there |
|---|---|
| [`src/config/site.ts`](src/config/site.ts) | Business identity: name, owner, city, phone, WhatsApp switch, socials, review IDs |
| [`.env.example`](.env.example) | Every API key, documented, with where to get each |
| [`supabase/setup.sql`](supabase/setup.sql) | The entire database, one paste |

---

## Step 1 — Business identity (5 min)

Edit **`src/config/site.ts`**: business name, owner name, city/region, phone
number, Facebook URL, review figures, SociableKit embed id, Google Place ID,
and the `whatsappEnabled` switch. Everything on the site reads from here.

## Step 2 — Database & admin login (15 min)

1. Create a free project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query** → paste all of **`supabase/setup.sql`** → Run.
   (Optionally run `supabase/seed.sql` after, for demo content.)
3. **Create the admin login** — this is a dashboard action, not an env var:
   **Authentication → Users → Add user** → the owner's email + a **strong**
   password → tick **"Auto confirm user"**. This is what the owner types at
   `/admin`. Add one user per person who should have access.
4. Copy **Project Settings → API** → Project URL + anon public key → they
   become `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in Step 3.

## Step 3 — API keys (15 min)

Copy `.env.example` → `.env.local` for local dev. For production, from this
folder run `vercel env add <NAME> production` per key. The full menu — every
key is optional and its feature simply stays off until added:

| Key(s) | Feature it unlocks | Get it at | Cost note |
|---|---|---|---|
| `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` | Admin panel, inquiries, orders, calendar, uploads, live content | supabase.com → Settings → API | Free tier |
| `ANTHROPIC_API_KEY` | AI chat assistant **and** snap-a-bill receipt reading | console.anthropic.com | Pennies per chat; **set a spend cap** |
| `OPENAI_API_KEY` | Cake Builder AI image previews | platform.openai.com | ~$0.05/image; **set a usage limit** |
| `RESEND_API_KEY` + `NOTIFY_EMAIL` + `NOTIFY_WEBHOOK_SECRET` | Instant email on every inquiry/callback | resend.com (secret: any long random string) | Free tier |
| `VITE_POSTHOG_KEY` + `VITE_POSTHOG_HOST` | Visitor analytics capture | posthog.com | Free tier |
| `POSTHOG_PROJECT_ID` + `POSTHOG_API_KEY` + `POSTHOG_API_HOST` | Admin → Site analytics numbers | posthog.com → Personal API keys | Free tier |

## Step 4 — Deploy (10 min)

```bash
npm install
npm run build          # sanity check
vercel deploy --prod   # from this folder (vercel login first, once)
```

Point the client's domain at the Vercel project and update
`productionUrl` in `site.ts` + `public/sitemap.xml` + `public/robots.txt`.

## Step 5 — Email webhook (5 min, only if using Resend)

Open the commented block at the END of `supabase/setup.sql`, replace
`<YOUR-DOMAIN>` and `<YOUR-NOTIFY-WEBHOOK-SECRET>` (same value as the
`NOTIFY_WEBHOOK_SECRET` env var), uncomment, run in the SQL Editor.

## Step 6 — Client content (the owner does this, no code)

Everything content-ish is edited in **`/admin`** on any device incl. phones:
cakes & photos/videos, prices, calendar & pickup slots, AI assistant facts.

Code-level copy that a new client DOES need edited once (find-replace pass):

- [ ] `src/data/faq.ts` — FAQ answers (policies, lead times)
- [ ] `src/data/pricing.ts` — flavors, sizing chart, bundled price fallbacks
- [ ] `src/pages/TermsPage.tsx` + `PrivacyPage.tsx` — their policies
- [ ] `api/chat.ts` → `STATIC_KNOWLEDGE` — the AI assistant's facts
- [ ] `index.html` — title + meta description
- [ ] `src/data/cakes.ts` seed cakes + `public/cakes`,`public/showcase` images
- [ ] Brand copy sweep: grep the repo for the previous client's name

## What still needs accounts you can't code around

- **Facebook/Instagram DMs in the admin inbox** — Meta Business verification
  or a platform like Chatwoot/Respond.io connected to the client's pages.
- **AI voice calls** — a Vapi (or similar) account + phone number.
- **WhatsApp Business** — flip `whatsappEnabled` once the client wants it.

---

### Current status of THIS deployment (CakeUWish, July 2026)

Done: Supabase ✓ (project `sqqjkfjdtagjlpzhkajp`, all SQL applied) · admin
login ✓ · Vercel env: Supabase keys + `NOTIFY_WEBHOOK_SECRET` ✓ · webhook
trigger ✓ · deployed ✓.
**Missing (features waiting):** `ANTHROPIC_API_KEY` (chat + bill reading),
`OPENAI_API_KEY` (builder previews), `RESEND_API_KEY`+`NOTIFY_EMAIL` (emails),
PostHog ×3 (analytics page), Google Place ID (review deep-link, `site.ts`).
