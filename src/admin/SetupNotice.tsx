/**
 * Shown at /admin when Supabase env vars are absent. The site still runs fine on
 * its bundled content — this just tells the owner how to switch the backend on.
 */
export default function SetupNotice() {
  return (
    <div className="min-h-screen bg-background px-6 py-16 text-foreground">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-3xl font-bold">Admin panel — almost ready</h1>
        <p className="mt-4 text-muted-foreground">
          The admin panel needs a Supabase project to store your content and sign you in. Until
          it's connected, your website keeps running normally on its built-in content.
        </p>

        <div className="mt-8 rounded-2xl border border-border bg-card p-6">
          <h2 className="font-display text-lg font-bold">To turn it on</h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>
              Create a free project at{' '}
              <a className="text-primary underline" href="https://supabase.com" target="_blank" rel="noreferrer">
                supabase.com
              </a>
              .
            </li>
            <li>
              Run the SQL in <code className="rounded bg-muted px-1.5 py-0.5">supabase/migrations</code> (and{' '}
              <code className="rounded bg-muted px-1.5 py-0.5">seed.sql</code>) in the Supabase SQL editor.
            </li>
            <li>
              Add <code className="rounded bg-muted px-1.5 py-0.5">VITE_SUPABASE_URL</code> and{' '}
              <code className="rounded bg-muted px-1.5 py-0.5">VITE_SUPABASE_ANON_KEY</code> to your env (see{' '}
              <code className="rounded bg-muted px-1.5 py-0.5">.env.example</code>) and redeploy.
            </li>
            <li>Create your admin login in Supabase → Authentication → Users.</li>
          </ol>
          <p className="mt-4 text-sm text-muted-foreground">
            Full step-by-step instructions are in <code className="rounded bg-muted px-1.5 py-0.5">SETUP.md</code>.
          </p>
        </div>

        <a href="/" className="mt-8 inline-block text-sm text-primary underline">
          ← Back to the website
        </a>
      </div>
    </div>
  )
}
