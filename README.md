# Stockroom: Next.js + Supabase

Multi-store stock management styled with Tailwind CSS. Admin and store manager roles, email sign-up with confirmation, Google sign-in,
live dashboards with Chart.js, customer supply sheets with CSV download, reports, settings, dark/light theme.

## Set up (new Supabase project)
1. Create a project at supabase.com.
2. SQL editor: paste all of `supabase/schema.sql` and run it.
   Already ran an older schema? Run `migration-002.sql` (if not yet run) and then `migration-003.sql`, each once, in a new query tab.
3. Authentication > Providers: keep **Email** on and turn on **Confirm email**. Optional: turn on **Google**.
4. Authentication > Policies: minimum password length 8, require lower case, upper case, digits and symbols.
5. Authentication > URL configuration: set the Site URL and add redirect URLs
   `http://localhost:3000/auth/callback` and `https://YOUR-APP.vercel.app/auth/callback`.
6. Copy `.env.example` to `.env.local` and add the project URL and anon (publishable) key. No quotes, no spaces.
7. `npm install` then `npm run dev` and open http://localhost:3000.

## Deploy to Vercel
Push to GitHub, import the repo in Vercel, add the same two environment variables (all environments),
deploy, then add your Vercel address to the Supabase redirect URLs. Redeploy after changing any variable.

## "Failed to fetch" on login or sign up
The browser cannot reach Supabase. The login page shows a red notice that says which of these it is:
- the Supabase project is paused (free projects pause after a week of no use): open the dashboard and Restore it
- `NEXT_PUBLIC_SUPABASE_URL` is wrong, or has quotes or spaces around it
- the key is wrong (copy the anon or publishable key again)
- an ad blocker or firewall blocks supabase.co
- the Vercel variables were changed but the site was not redeployed

## Using it
- Admin: Dashboard, Stores, Products, Supplies, Reports, Settings (profile, theme, password, sign out, reset all data).
- Store manager (up to 3 accounts per store): Dashboard, Daily entry (sheets, CSV download), Reports, Settings.
- Sign out and the theme toggle are inside Settings, at the bottom of the menu.

## Notes
- Anyone can pick "Admin" when signing up. Before real use, change `handle_new_user()` in `schema.sql`.
- A manager who signs in with Google starts without a store and is asked to choose one.
- Managers cannot edit or delete entries, by design. Admins can delete stores, products and supplies.
