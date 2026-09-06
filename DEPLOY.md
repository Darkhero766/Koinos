# KOINOS — production deployment checklist

## Architecture

- `index.html` + CSS + browser JS → Render Static Site
- `server/` → Render Web Service (`koinos-api`)
- Render PostgreSQL → persistent civic data
- Supabase Auth + Storage → sign-in and public issue photos
- OpenStreetMap + Leaflet → real map tiles and coordinates
- Nominatim → human-readable location labels
- KartaView → optional public street-level context

## 1. Deploy Supabase

Create/open your Supabase project.

### Browser config

Copy the Project URL and the **publishable/anon key** into `supabase-config.js`:

```js
window.KOINOS_SUPABASE = {
  url: 'https://YOUR_PROJECT.supabase.co',
  anonKey: 'YOUR_PUBLISHABLE_OR_ANON_KEY'
};
```

The publishable/anon key is designed for browser use. **Never** put the `service_role` key in the frontend.

### Storage

Create a **public** bucket named exactly:

```text
issue-images
```

Recommended limit: 12 MB. Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`.

Then open Supabase → SQL Editor and run `supabase-storage.sql` from this repository. The app uploads to `issue-images`; older policies for `issue-photos` or `issue-images` with the wrong folder rule will not fix the app.

A public bucket only makes downloads public; uploads still require Storage RLS policies. Supabase also recommends a matching SELECT policy because an upload may need to return object metadata. citeturn6search1turn6search9

## 2. Deploy the database

Render → New → PostgreSQL.

Create a database such as `koinos-db`.

Copy its **Internal Database URL**.

## 3. Deploy the API

Render → New → Web Service → connect `Darkhero766/Koinos`.

Settings:

- Branch: `main`
- Root Directory: `server`
- Build Command: `npm install`
- Start Command: `npm start`

Environment variables:

```text
NODE_ENV=production
DATABASE_URL=<Render Internal Database URL>
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_ANON_KEY=<Supabase publishable/anon key>
CORS_ORIGIN=https://koinos.onrender.com
ADMIN_KEY=<long random secret>
```

Name the service `koinos-api` if possible. The frontend now also tries the existing `koinos-api-5v03.onrender.com` endpoint, so a Render service rename is less likely to break the site.

After deploy, test:

```text
https://koinos-api.onrender.com/api/health
```

You want `database: true` and `mode: "postgresql"`.

## 4. Deploy the citizen site

Render → New → Static Site → connect the same repository.

- Branch: `main`
- Build Command: leave empty
- Publish Directory: `.`

No npm install is required for the citizen site.

## 5. Test the real journey

1. Open KOINOS on a phone.
2. Allow location permission.
3. Open Report an issue.
4. Pick a JPG/PNG/WebP photo. The browser now compresses large images before upload.
5. Confirm the preview fits inside the card instead of expanding the page.
6. Pin the exact location.
7. Submit.
8. Confirm the photo appears in Supabase Storage → `issue-images`.
9. Confirm the report appears in PostgreSQL.
10. Submit another nearby report and verify the API returns `communityMatch: true` within the 350 m matching radius.
11. Tap support on an issue.
12. Open `/api/analytics` and confirm counts change.
13. Use the authority API with `X-Admin-Key` to move an issue through `reported`, `in_progress`, and `resolved`.
14. Use community verification to confirm the fix.

## Important

The severity/priority engine is deterministic and transparent, not an LLM. That is intentional for reliability. An LLM provider can be added later behind the API without exposing a secret in the browser.

Do not put `DATABASE_URL`, `ADMIN_KEY`, or any AI provider secret in frontend code.
