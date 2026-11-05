# House Waitlist

A one-page waitlist on top of a 3D empty city (the "Lazy Films City" land from the free-house reel). Visitors sign in with Google, type their Instagram username, and a house goes up on the next empty plot with their `@username` on it. Entries are stored in Supabase.

- **Stack:** Next.js 16 (App Router), Supabase Auth (Google) + Postgres, Tailwind CSS 4, three.js for the city.
- **Stored per person:** Google email, Google name, Instagram username (lowercase, no `@`), join time.
- **Public:** the Instagram usernames, shown on the houses in join order (plot #1 is the first person). Google names and emails are never sent to the browser for anyone but the signed-in person.
- **The city:** plot #1 is on Founders' Row facing the central plaza, and the city fills outward ring by ring. Plot numbers never change. Each house's colours and shape come from the username, so the same person always gets the same house.
- **Rules:** one entry per Google account, one entry per Instagram username. Only a valid Instagram username is accepted (1-30 characters; letters, numbers, `.` and `_`; no link, no spaces, no email, no leading/trailing or double period). The form checks it, the server checks it again, and the database refuses anything else.
- **Wording:** all page text is in `src/lib/site.ts`.

---

## Setup guide

You'll do 4 things: create the Supabase project, create the table, set up Google sign-in, then run the site. About 15 minutes.

### Step 1. Create the Supabase project

1. Go to https://supabase.com, sign up, and click **New project**.
2. Pick a name (e.g. `house-waitlist`), set a database password and save it somewhere, and choose the region closest to your visitors (for India: **Mumbai**).
3. Leave **Enable Data API** switched on. Click **Create new project** and wait about a minute.

### Step 2. Create the waitlist table

1. In the project, open **SQL Editor** (left sidebar) and click **New query**.
2. Open `supabase/schema.sql` from this project, copy all of it, paste it into the editor, and click **Run**.
3. You should see "Success. No rows returned". Open **Table Editor** and you'll see an empty `waitlist` table.

### Step 3. Put your Supabase keys in the project

1. In Supabase, click the **Connect** button at the top (or go to **Project Settings -> API Keys**).
2. Copy the **Project URL** and the **Publishable key** (starts with `sb_publishable_`).
   Do **not** use the secret key / `service_role` key.
3. In this folder, copy `.env.example` to a new file named `.env.local` and paste the two values:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxx
   ```

   `.env.local` is git-ignored, so it never gets committed.

### Step 4. Set up "Sign in with Google"

**4a. Get the callback URL from Supabase.**
Supabase -> **Authentication -> Sign In / Providers -> Google**. Copy the **Callback URL (for OAuth)**. It looks like `https://xxxxxxxxxxxx.supabase.co/auth/v1/callback`. Keep this tab open.

**4b. Create the Google OAuth client.**

1. Go to https://console.cloud.google.com and create a new project (top bar -> project picker -> **New project**).
2. Open **Google Auth Platform** (search for it in the top search bar) and click **Get started**:
   - **App name:** what people see on the Google screen, e.g. `Lazy Films City`.
   - **User support email:** your email.
   - **Audience:** **External**.
   - **Contact email:** your email. Agree and **Create**.
3. **Data Access** -> **Add or remove scopes** -> tick `openid`, `.../auth/userinfo.email` and `.../auth/userinfo.profile` -> **Update** -> **Save**.
4. **Clients** -> **Create client**:
   - **Application type:** Web application.
   - **Authorized JavaScript origins:** `http://localhost:3000` (add your live URL here later).
   - **Authorized redirect URIs:** paste the Supabase callback URL from 4a.
   - Click **Create**, then copy the **Client ID** and **Client secret**.
5. **Audience** -> click **Publish app** -> **Confirm**.
   While the app is in "Testing", only Google accounts you list as test users can sign in. Publishing lets anyone sign in. This app only asks for name and email, so Google doesn't require a review for it.

**4c. Turn on Google in Supabase.**
Back in the Supabase Google provider page: switch **Enable Sign in with Google** on, paste the **Client ID** and **Client Secret**, and click **Save**.

**4d. Tell Supabase where your site is.**
Supabase -> **Authentication -> URL Configuration**:

- **Site URL:** `http://localhost:3000` for now (change it to your live URL when you deploy).
- **Redirect URLs** -> **Add URL:** `http://localhost:3000/**`

### Step 5. Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000, click **Continue with Google**, pick an account, enter an Instagram username, and click **Join the waitlist**. Then check Supabase **Table Editor -> waitlist**: your row is there.

---

## Seeing and exporting the list

- **Table Editor -> waitlist** shows everyone, in join order (`id`).
- To download it: Table Editor -> `waitlist` -> **Export -> Export as CSV**.
- To remove or fix an entry (e.g. someone typo'd their username), edit or delete the row in Table Editor. Visitors can't edit or delete entries from the website.
- Handy query for the SQL Editor:

  ```sql
  select row_number() over (order by id) as plot, instagram_username, full_name, email, created_at
  from public.waitlist
  order by id;
  ```

## Putting it online (Vercel)

1. Push this project to GitHub, then on https://vercel.com click **Add New -> Project** and import it.
   Create a **new** Vercel project. The old portfolio's Vercel link was removed from this folder on purpose so the waitlist doesn't overwrite the live portfolio site.
2. In the Vercel project, add the same two environment variables from `.env.local` (Settings -> Environment Variables), then deploy.
3. Add your live URL (e.g. `https://house-waitlist.vercel.app`) in three places:
   - Google Cloud -> Google Auth Platform -> Clients -> your client -> **Authorized JavaScript origins**.
   - Supabase -> Authentication -> URL Configuration -> **Site URL** (set it to the live URL).
   - Supabase -> Authentication -> URL Configuration -> **Redirect URLs** -> add `https://your-live-url/**`.

## Troubleshooting

| What you see | Fix |
| --- | --- |
| Page says "Supabase isn't connected yet" | `.env.local` is missing or a value is empty. Fix it and restart `npm run dev`. |
| Google says `redirect_uri_mismatch` | The Google client's redirect URI must be exactly the Supabase callback URL from step 4a. |
| Google says "Access blocked" or only you can sign in | The Google app is still in Testing. Publish it (step 4b.5). |
| After Google you land back on the page with "Google sign-in didn't finish" | Add your site's URL with `/**` to Supabase Redirect URLs (step 4d). |
| After Google you end up on `localhost` when using the live site | Set the Supabase **Site URL** to your live URL and add the live URL to Redirect URLs. |
| "Couldn't save your spot" or "Couldn't load your house" | The table is probably missing. Run `supabase/schema.sql` again. The exact error is in the terminal running `npm run dev`. |
| The city shows no houses even though people joined | Run the latest `supabase/schema.sql` again (it adds the `waitlist_houses` function the map reads). |
| The map says it needs WebGL | That browser has 3D graphics turned off. Joining still works. |

## Project layout

```
supabase/schema.sql             table, security rules, public list of houses
src/app/page.tsx                loads the houses + the visitor's state and picks what to show
src/app/actions.ts              join the waitlist / sign out (server side)
src/app/auth/callback/route.ts  finishes Google sign-in
src/proxy.ts                    keeps the login session fresh
src/lib/instagram.ts            Instagram username rules
src/lib/site.ts                 all page wording
src/components/waitlist-ui.tsx  the card (steps, sign-in, Instagram form, your house)
src/components/land/layout.ts   city grid and plot numbering
src/components/land/build.ts    builds the city, plots and houses
src/components/land/engine.ts   3D scene, camera, pin, PLOT sign, name tags
```

The previous portfolio is saved in git under the tag `portfolio-backup-2026-11-05` (`git checkout portfolio-backup-2026-11-05` to look at it).
