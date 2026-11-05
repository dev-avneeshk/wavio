# House Waitlist

A one-page waitlist on top of a 3D world of towns (the "Lazy Films City" land from the free-house reel). Visitors sign in with Google and type their Instagram username. They're on the waitlist, and their house starts being built on the next empty plot, with their `@username` on it. Entries are stored in Supabase.

- **Stack:** Next.js 16 (App Router), Supabase Auth (Google) + Postgres, Tailwind CSS 4, three.js for the map.
- **Stored per person:** Google email, Google name, Instagram username (lowercase, no `@`), house number, join time.
- **Public:** the Instagram usernames and their house numbers, shown on the houses. Google names and emails are never sent to the browser for anyone but the signed-in person.
- **The world:** every town has 1,000 plots. Town 1 is the first town (the city from the reel). When it's full, Town 2 opens next to it, then Town 3, and so on with no limit, so 100,000 people get 100 towns. House numbers run on across towns: houses 1-1,000 are Town 1, 1,001-2,000 are Town 2. Towns sit along the coast and spread inland in rings around Town 1.
- **A town:** house #1 is on Founders' Row facing the central plaza, and the town fills outward ring by ring. House numbers never change (deleting someone leaves their plot empty; nobody moves).
- **Picking a plot:** before claiming, people can tap any empty plot in the town that's filling now (the pin, the PLOT sign and the "Claim house #N" button move there). If they don't pick, they get the next free plot. The pick survives the trip to Google's sign-in page. The database checks it: a plot someone else took first, or one in a town that isn't open yet, is refused with a clear message. Town 2 only opens once all 1,000 plots in Town 1 are taken.
- **Phones:** smaller one-line tags, town names only when zoomed out, a lighter town, fewer people drawn in full, and fewer redraws while nothing moves.
- **Build times:** a house takes 30 days from joining, 2 days less for every friend who joins from the owner's link, 3 days at the least (`waitlist_build_days()` in the schema; the wording is in `src/lib/house.ts`). Houses on the map show their real stage: foundation, frame, walls, roof, finishing, then a finished house with windows, a door, a garden and no scaffolding. Colours and shape come from the house number, so a house always looks the same. Your own house builds up from the ground when you open the page and has a crane working on it until it's done.
- **Name boards:** every house has a board in its front yard with the owner's `@username`, house number, waves and how far it's built. Only the boards near the camera get writing (to save memory); zoom in to read them.
- **House cards:** tap a house to open its card above it. The `@username` opens their Instagram. The card shows the stage, % built, time left, its value (in-game coins, not money: nearer the plaza, bigger, more built, Town 1, the first 100 houses and waves all add value) and waves, with buttons to wave (once a day per house), message (neighbours only) and share.
- **Links and invites:** `/?h=12` opens the map on house 12 with its card open. Someone who joins after opening it counts as house 12's invite (remembered in the browser for 30 days, so it survives Google sign-in). Your card has your link and a Share button.
- **Neighbours and chat:** neighbours are houses in the same town at most 42 m apart (4 plots along the street, the row behind, and across the road; usually 8-15 houses). Only neighbours can message each other, one to one, and only the two of them can read it. New messages arrive live (Supabase Realtime), pop up as a bubble over the sender's house, and the inbox is also checked every 30 s in case live updates are blocked. Limits: 280 characters, 5 messages per 15 s, 300 a day. Anyone can block a neighbour.
- **Search:** the magnifier on the map finds a house by `@username` (the start of it is enough) or `#number` and flies there.
- **People:** every house comes with the person who lives in it. Their look (body, height, skin, hair, face, glasses or hat, clothes, shoes) is one of 2,548,039,680 combinations; the database gives out combinations one to one with house numbers and keeps them unique, so no two people look the same (`char_look()` in the schema, decoded in `src/components/people/look.ts`). Each also has an age and a personality (hard worker, hothead, sneaky, friendly, laid-back, curious). The tag over their head shows `@username`, income and job. Jobs come later: everyone is "Waiting for a job" at 0 coins/day and starts with 500 coins (in-game).
- **Life in town:** while their owner is away, people live on their own: chores in the front garden, queueing at the Job Centre in the plaza, a jog round the block, a park bench, a nap, a chat with a neighbour, and now and then a fight (the loser loses health and a few coins) or a theft (it can fail). Personality sets how often. Everything that happens is a row in `character_events`, decided 5-10 minutes ahead so every screen shows the same thing at the same moment; people walk there along the pavements and back home. There's no scheduler: a town catches up (`advance_town()`, at most the last 12 hours) whenever someone looks at it or plays in it.
- **Playing:** people with a house press **Play**: the camera goes behind their person, WASD / arrow keys (Shift to run) or the on-screen stick walk them around their town, and buttons let them wave, fight or steal from whoever is next to them (the database decides how it goes; limits: a fight every 45 s, a theft every 2 min, the same person once in 6 hours). While you're in the game your person does nothing on their own, and other players in your town see you move live (Supabase Realtime broadcast, only for people with a house). Leave (close the page, or hide it for 45 s) and they go back to their own life. Coming back shows **While you were away**: what they did and what was done to them, with coins won and lost; **Story** has the full log.
- **Phones:** played in landscape. Held upright, phones are asked to turn sideways (with a "rotation locked" way to carry on). Sideways, the map fills the screen with the card at the side, and Play goes full screen (and locks to landscape on Android).
- **The map:** the town you're looking at is drawn in full detail; all other towns are drawn simply. Zoom out (or press **World**) to see every town with its label, and tap a town to fly there.
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
3. Do the same with `supabase/lots.sql` (where every plot sits, used to check who counts as a neighbour).
4. You should see "Success. No rows returned". Open **Table Editor** and you'll see an empty `waitlist` table.

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

Open http://localhost:3000, click **Continue with Google**, pick an account, enter an Instagram username, and click **Claim house #1**. Then check Supabase **Table Editor -> waitlist**: your row is there with `plot` 1.

---

## Seeing and exporting the list

- **Table Editor -> waitlist** shows everyone. The `plot` column is their house number.
- To download it: Table Editor -> `waitlist` -> **Export -> Export as CSV**.
- To remove or fix an entry (e.g. someone typo'd their username), edit or delete the row in Table Editor. Visitors can't edit or delete entries from the website. Don't change `plot` numbers by hand: two people can't share one, and the map uses them.
- Handy query for the SQL Editor:

  ```sql
  select plot as house, (plot - 1) / 1000 + 1 as town, instagram_username, full_name, email, created_at
  from public.waitlist
  order by plot;
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
| The map shows no houses even though people joined | Run the latest `supabase/schema.sql` again (it adds the `plot` column and the `waitlist_world` function the map reads). |
| No people in town, or Play stays greyed out | Run the latest `supabase/schema.sql` again (it adds `characters`, `character_events` and the game functions, and gives everyone already on the list their person). |
| The map says it needs WebGL | That browser has 3D graphics turned off. Joining still works. |
| Every message says "You can only message houses within 4 plots of yours" | `supabase/lots.sql` hasn't been run, so the database doesn't know where plots are. Run it. |
| Messages only show up after a few seconds | Live updates aren't connected (the inbox check every 30 s still works). In Supabase -> **Database -> Publications**, `supabase_realtime` must include `messages`; running `schema.sql` adds it. |

## Project layout

```
supabase/schema.sql             tables, security rules, house numbers, build times, waves, messages, the map's data function, people and life in town
supabase/lots.sql               where each of a town's 1,000 plots sits (for the neighbour check)
src/app/page.tsx                loads the world + the visitor's state and picks what to show
src/app/actions.ts              join the waitlist / sign out (server side)
src/app/auth/callback/route.ts  finishes Google sign-in
src/proxy.ts                    keeps the login session fresh
src/lib/instagram.ts            Instagram username rules
src/lib/world.ts                town size (1,000), house number -> town maths, the map data's shape
src/lib/house.ts                build times in words (stage, % built, time left), Instagram and house links
src/lib/social.ts               shared chat state (inbox, chat window) for the map, chat and card
src/lib/social-api.ts           waves, messages, blocking and search calls, with error wording
src/lib/invite.ts               remembers the house link someone came from
src/lib/site.ts                 all page wording (and town names)
src/components/waitlist-ui.tsx  the card (steps, sign-in, Instagram form, your house)
src/components/my-house-status.tsx  your build progress, value, invite link, neighbours button
src/components/chat/            the neighbour chat window and its live updates
src/components/land/layout.ts   where towns sit in the world, the town grid, plot numbering
src/components/land/spec.ts     each house's look and stage, its value, who your neighbours are
src/components/land/build.ts    builds one town in detail: plaza, parks, plots, houses, name boards, cranes
src/components/land/boards.ts   the writing on the name boards near the camera
src/components/land/country.ts  countryside, sea, highways, and every other town in simple form
src/components/land/engine.ts   3D scene, camera, pin, signs, tags, bubbles, the house card's position, switching towns
src/components/land/house-popup.tsx  the card over a tapped house
src/components/land/find-house.tsx   search by @username or #number
src/lib/game.ts                 shared game state (your person, play mode, story, notes) and its wording
src/lib/game-api.ts             game calls (enter, ping, leave, fight / steal, story, town events)
src/lib/game-live.ts            live positions of players (Realtime broadcast, one channel per town)
src/components/people/look.ts   a look number -> the person (hair, skin, clothes...), personalities
src/components/people/rig.ts    a person in 3D with a skeleton, and every pose and move
src/components/people/nav.ts    pavements and crossings, garden spots, the Job Centre queue, park benches
src/components/people/timeline.ts  where someone is at any moment, from the town's events
src/components/people/people.ts the town's people in the scene: bodies, tags, you walking, other players
src/components/game/            Play controls and stick, the person card, While you were away / Story, rotate prompt
```

The previous portfolio is saved in git under the tag `portfolio-backup-2026-11-05` (`git checkout portfolio-backup-2026-11-05` to look at it).
