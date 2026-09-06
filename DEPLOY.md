# KOINOS — production deployment checklist

## Architecture

- `index.html` + CSS + browser JS → Render Static Site
- `server/` → Render Web Service (`koinos-api`)
- Render PostgreSQL → persistent civic data
- OpenStreetMap + Leaflet → real map tiles and coordinates
- Nominatim → human-readable location labels

## 1. Deploy the database

Render → New → PostgreSQL.

Create a database such as `koinos-db`.

Copy its **Internal Database URL**.

## 2. Deploy the API

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
CORS_ORIGIN=https://koinos.onrender.com
ADMIN_KEY=<long random secret>
```

Name the service exactly `koinos-api` if you want the existing citizen frontend to discover it automatically.

After deploy, test:

`https://koinos-api.onrender.com/api/health`

You want `database: true` and `mode: "postgresql"`.

## 3. Deploy the citizen site

Render → New → Static Site → connect the same repository.

- Branch: `main`
- Build Command: leave empty
- Publish Directory: `.`

No npm install is required for the citizen site.

## 4. Test the real journey

1. Open KOINOS on a phone.
2. Allow location permission.
3. Open Report an issue.
4. Take a photo.
5. Describe the problem.
6. Submit.
7. Confirm the report appears in the database.
8. Submit another nearby report and verify the API returns `communityMatch: true` when it is within the 350 m matching radius.
9. Tap “I'm affected too” from the issue view.
10. Open `/api/analytics` and confirm counts change.
11. Use the authority API with `X-Admin-Key` to move an issue through `reported`, `in_progress`, and `resolved`.
12. Use the community verification action to confirm the fix.

## Important

The current severity/priority engine is deterministic and transparent, not an LLM. That is intentional for reliability. An LLM provider can be added later behind the API without exposing a secret in the browser.

Do not put `DATABASE_URL`, `ADMIN_KEY`, or any AI provider secret in frontend code.
