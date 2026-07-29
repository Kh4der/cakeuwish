# CakeUWish Admin Panel — Setup

> **Status (July 21, 2026):** Supabase is provisioned (project `cakeuwish` in the
> `whozby` org), migrations 0001–0005 are applied, content is seeded, and the
> URL + anon key are set on Vercel (Production + Development) — Part 1 and Part 3
> below are DONE except creating your login. **What's left:**
> 1. Create your admin login (Part 1, step 6) — 2 minutes.
> 2. Add `ANTHROPIC_API_KEY` on Vercel to turn on the AI chat assistant
>    (`vercel env add ANTHROPIC_API_KEY production` from `D:\CakeUwish\web`,
>    key from https://console.anthropic.com — set a monthly spend cap there too).
> 3. Optional: PostHog keys (Part 2) for the analytics dashboard.
> 4. **Email notifications for new inquiries** (webhook already wired &amp; tested):
>    create a free account at https://resend.com, get an API key, then from
>    `D:\CakeUwish\web` run `vercel env add RESEND_API_KEY production` and
>    `vercel env add NOTIFY_EMAIL production` (the address that should receive
>    them) and redeploy. Every quote / message / callback then emails you
>    instantly.

Your website now has an **admin panel** at **`/admin`** with two parts:

1. **Visitor analytics** — visits + WhatsApp/Enquire conversions (powered by PostHog).
2. **Picture dashboards** — edit the featured cakes (hero + "A taste of what's possible")
   and the showcase photo wall, with uploads going live instantly.

Until you connect the two free services below, the site keeps running exactly as it
does today on its built-in content, and `/admin` shows a friendly setup screen.

Everything is free-tier friendly for a site this size.

---

## Part 1 — Supabase (content + login) · ~10 min

1. Create a free project at **https://supabase.com** (pick a region near your customers).
2. In the project: **SQL Editor → New query**, paste the contents of
   **`supabase/migrations/0001_init.sql`**, and click **Run**.
3. New query again, paste **`supabase/seed.sql`**, **Run**. (This loads your current
   7 cakes + 23 photos so the admin starts with today's content.)
4. New query again, paste **`supabase/migrations/0002_gallery_inquiries.sql`**, **Run**.
   (Adds the gallery metadata — flavor/servings/tags/extra photos — plus the
   **inquiries** table behind the quote-request and contact forms, and the
   inspiration-photo upload bucket. **Already set up before? Just run this one
   new file** — it's safe to run on an existing project.)
5. Get your keys: **Project Settings → API** → copy the **Project URL** and the
   **anon public** key.
6. Create your login: **Authentication → Users → Add user** → enter your email and a
   password (tick "Auto confirm"). Optionally turn **off** public sign-ups under
   **Authentication → Providers → Email** so only you can get in.

## Part 2 — PostHog (analytics) · ~5 min

1. Create a free project at **https://posthog.com** (note whether you're on the
   **US** or **EU** cloud — it changes the host URLs).
2. Capture key: **Settings → Project API Key** (`phc_…`).
3. Dashboard read: **Settings → Project ID** (a number) and **Settings → Personal
   API Keys → Create**, give it the **Query Read** scope (`phx_…`).

## Part 3 — Plug in the keys

**Locally:** copy `.env.example` to `.env.local` and fill in the values, then
`npm run dev`. (The analytics *dashboard numbers* only run on Vercel or via
`vercel dev`, but capture + the picture editors work locally.)

**On Vercel:** Project → **Settings → Environment Variables**, add each variable
from `.env.example` (Production + Preview), then redeploy:

```
npm run build        # local sanity check
vercel --prod --yes  # from D:\CakeUwish\web
```

> Important: anything starting with `VITE_` is sent to the browser (that's fine —
> the anon key and PostHog project key are designed to be public). The
> `POSTHOG_API_KEY` and `POSTHOG_PROJECT_ID` have **no** `VITE_` prefix on purpose
> so they stay server-side only.

---

## Using it

Go to **`https://your-site/admin`**, sign in, and you'll land on the **Overview** —
sales today / this month, cash in vs. paid out, a 30-day sales graph, a
"needs attention" list (new messages, callbacks to make, today's pickups,
unpriced orders), and a **vendor payment ledger** for recording expenses.
The sidebar groups the rest:

- **Dashboard** — visits, unique visitors, WhatsApp + Enquire clicks (with a
  conversion rate), a daily-visits chart, where people click, and most-requested
  cakes. Switch between 7 / 30 / 90 days.
- **Inquiries** — every quote request and contact message from the website, with
  the customer's details, inspiration photos, a one-tap WhatsApp reply link, a
  status workflow (New → Quoted → Confirmed → Closed), private notes, and a
  one-click **Convert to order**.
- **Orders** — confirmed orders tracked through pickup: price, deposit paid,
  status (Pending → Confirmed → Ready → Completed), plus a this-week load strip
  that turns amber/red as days reach capacity.
- **Calendar** — block days (or whole vacation ranges), set minimum lead days,
  max orders per day, and the pickup time slots customers choose from. Blocked
  days and lead time are enforced on the website's quote form automatically.
- **AI Facts** — the knowledge base for the website's AI chat assistant: add
  seasonal specials, current lead times, anything timely — the assistant uses
  these within seconds, no redeploy needed.
- **Featured cakes** — edit title/blurb/category/background, replace the photo,
  reorder, show/hide, add or delete — plus **flavor, servings, search tags, and
  extra photos** that power the gallery pages. *Photo tip:* for the hero, upload a
  PNG of the cake on a **transparent background** so it floats cleanly on the
  colored backdrop.
- **Showcase** — upload photos AND short videos (MP4/WebM/MOV, under 50 MB; multiple
  at once), edit alt text, reorder, show/hide, delete. Videos appear on the gallery
  page with a play button; the home scatter wall stays photos-only for performance.
- **Pricing** — edit every starting price and add-on shown on the pricing page.
- **Vendors & bills** — every expense in one place: snap a photo of any receipt or
  invoice (works from your phone's camera) and the fields fill themselves via AI
  (needs ANTHROPIC_API_KEY; without it the photo still stores and you type the
  fields). Also shows the AI features' own metered running costs (chat + image
  previews). Record hosting/API invoices here under "Software & hosting".

## Pricing

The `/pricing` page ships with sensible **starting prices** (single-tier from $95,
two-tier from $185, wedding from $325, sculpted from $165, cupcakes/cake pops from
$35/dozen — plus add-ons). Change any number, wording, or row in **Admin → Pricing**;
the public page updates on the next load, no redeploy needed. Leaving a price empty
shows "Request a quote" instead. Flavors and the sizing chart still live in
`src/data/pricing.ts`.

Changes are saved to Supabase; the public site picks them up on the next page load.

## How content loads (so nothing ever breaks)

The site ships with its current content built in. If Supabase is configured, it
fetches the live content on load and uses it; if Supabase is down, empty, or not
configured, it silently falls back to the built-in content. You can't "break" the
site from the admin panel — worst case it shows the original cakes.

## Notes / possible follow-ups

- The `/api/analytics` endpoint currently returns aggregate counts without an auth
  check (no personal data — just totals). If you'd like, it can be locked to your
  admin session as a hardening step.
- Auto-deploy from GitHub isn't connected (deploys are the manual `vercel --prod`
  command above). See the project notes for how to enable it on the Kh4der repo.
