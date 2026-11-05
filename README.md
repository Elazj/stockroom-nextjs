# Stockroom: Next.js + Supabase

Multi-store stock management, styled with Tailwind CSS v4. Admin and store manager roles, email sign-up with confirmation, Google sign-in,
live dashboards with Chart.js, customer supply sheets with CSV download, reports, settings, dark/light theme.

## Set up (new Supabase project)
1. Create a project at supabase.com.
2. SQL editor: paste all of `supabase/schema.sql` and run it.
   Already ran an older schema? Run `migration-002.sql` through `migration-006.sql` (each once, only if not yet run) in new query tabs.
   Every admin tab shows "permission denied"? Run `migration-005.sql` (or the whole `repair.sql`) once, then reload.
3. Authentication > Providers: keep **Email** on and turn on **Confirm email**. Optional: turn on **Google**.
4. Authentication > Policies: minimum password length 8, require lower case, upper case, digits and symbols.
5. Authentication > URL configuration: set the Site URL and add redirect URLs
   `http://localhost:3000/auth/callback` and `https://YOUR-APP.vercel.app/auth/callback`.
6. Copy `.env.example` to `.env.local` and add the project URL and anon (publishable) key. No quotes, no spaces.
   For the admin **Team** page also add `SUPABASE_SERVICE_ROLE_KEY` (Project Settings > API Keys > service_role, or the secret key). It is SERVER ONLY: never put NEXT_PUBLIC in front of it, never commit it, and add it in Vercel too.
7. `npm install` then `npm run dev` and open http://localhost:3000.

## Styling (Tailwind CSS v4)
- Tailwind is set up through `postcss.config.mjs` and `app/globals.css` (`@import "tailwindcss"`).
- Colors are theme variables in `globals.css` (`bg-panel`, `text-mute`, `border-line`, `bg-acc` ...). Dark and light mode only change those variables, so no `dark:` classes are needed.
- Shared class sets (buttons, panels, chips) live in `lib/tw.ts`. Plain HTML elements (form fields, labels, table cells, dialogs) get their base look in `globals.css`.
- Side bar breakpoint: below 1024px the menu becomes a side bar that opens and closes.

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
- Admin: Dashboard, Stores, Team (create manager accounts, set passwords, assign stores, disable or delete), Products, Supplies, Forecast, Reports, Settings (profile, theme, password, sign out, reset all data).
- Store manager (up to 3 accounts per store): Dashboard, Daily entry (sheets, CSV download, offline queue), Forecast, Reports, Settings.
- Offline entry: a manager who already opened Daily entry while online can record supplies with no connection. They stay in the browser and sync in order when the network returns. If stock ran out or the same supply ID was used, the bar at the top asks them to record a smaller quantity, save anyway, or discard. Run `supabase/migration-006.sql` once so a retry cannot insert the same entry twice.
- Forecast: each product’s daily use (supplied + damaged + missing) is projected with a 7-day moving average and exponential smoothing. The Forecast page scores both on held-out days (MAE, RMSE, sMAPE) and suggests a reorder date 7 days before the predicted stock-out.
- Sign out and the theme toggle are inside Settings, at the bottom of the menu.

## Notes
- Anyone can pick "Admin" when signing up. Before real use, change `handle_new_user()` in `schema.sql`.
- A manager who signs in with Google starts without a store and is asked to choose one.
- Managers cannot edit or delete entries, by design. Admins can delete stores, products and supplies.
