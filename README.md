# Stockroom: Next.js + Supabase

Multi-store stock management with admin and store manager roles, real email sign-up with confirmation,
Google sign-in, live dashboards, customer supply sheets with CSV download, reports, and a dark/light theme.

## Set up (new Supabase project)
1. Create a project at supabase.com.
2. SQL editor: paste all of `supabase/schema.sql` and run it.
   (Already ran an older schema? Run `supabase/migration-002.sql` instead, once.)
3. Authentication > Providers: keep **Email** on and turn on **Confirm email**. Optional: turn on **Google**.
4. Authentication > Policies: minimum password length 8, require lower case, upper case, digits and symbols.
5. Authentication > URL configuration: set Site URL and add redirect URLs
   `http://localhost:3000/auth/callback` and `https://YOUR-APP.vercel.app/auth/callback`.
6. Copy `.env.example` to `.env.local` and add your project URL and anon (publishable) key.
7. `npm install` then `npm run dev` and open http://localhost:3000.

If login shows a connection error, verify that `.env.local` contains the Supabase project URL and publishable key from **Project Settings > API**, then restart `npm run dev`. For Vercel, add both as environment variables and redeploy. The URL must be the project URL (for example, `https://your-project.supabase.co`), not the dashboard URL.

For an existing project, run `supabase/migration-003.sql` once in the Supabase SQL editor to enable the admin reset action.

## Deploy to Vercel
Push to GitHub, import the repo in Vercel, add the same two environment variables, deploy,
then add your Vercel address to the Supabase redirect URLs (step 5).

## Using it
- Admin: Stores (add, activate), Products (create from a container: total - damaged - missing = amount to supply),
  Supplies (add a product to a store, view and download sheets), Reports (read, resolve), Reset all data.
- Store manager (up to 3 accounts per store): Dashboard, Daily entry (create a sheet per product, record customer
  supplies with a supply ID, record damaged or missing, download CSV), Reports (write to the admin).
- Everything updates live through Supabase Realtime.

## Notes
- Anyone can pick "Admin" when signing up. Before real use, change `handle_new_user()` in `schema.sql`
  so only the first account (or invited people) can be admin.
- A manager who signs in with Google starts without a store and is asked to choose one (3 account limit applies).
- Entries cannot be edited or deleted by managers, by design.
