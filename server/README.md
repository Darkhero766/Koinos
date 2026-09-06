# KOINOS API

Production-oriented civic API for the KOINOS static citizen experience.

## What is real

- PostgreSQL persistence when `DATABASE_URL` is configured.
- OpenStreetMap/Leaflet-compatible latitude/longitude issue data.
- Proximity matching for active reports (350 m) to surface possible community clusters.
- Reverse-geocoded location labels are supplied by the frontend using OpenStreetMap Nominatim.
- One-vote-per-device protection using `X-Device-ID`.
- Severity prediction from report text and a transparent 0–100 priority score.
- Status history: `reported` → `in_progress` → `resolved`.
- Community resolution verification.
- Authority analytics and prioritized issue queue.
- Safe fallback to `server/data/issues.json` when PostgreSQL is not configured, useful for local demos.

## Run locally

```bash
cd server
npm install
npm start
```

The server listens on `http://localhost:4000` by default.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Service + database health |
| GET | `/api/issues` | Nearby/filterable civic issues |
| GET | `/api/issues/:id` | Issue + status history + nearby similar issues |
| GET | `/api/issues/:id/similar` | Nearby active reports |
| POST | `/api/issues` | Create a civic report |
| POST | `/api/issues/:id/upvote` | Confirm “I'm affected too” |
| POST | `/api/issues/:id/verify` | Community says fixed / still open |
| PATCH | `/api/issues/:id/status` | Authority status transition |
| GET | `/api/analytics` | Authority analytics |
| GET | `/api/admin/issues` | Prioritized authority queue |

## Render deployment

Create two services from this repository:

### 1. PostgreSQL

Create a Render PostgreSQL database and copy its **Internal Database URL**.

### 2. API Web Service

- Repository: `Darkhero766/Koinos`
- Root directory: `server`
- Build command: `npm install`
- Start command: `npm start`
- Environment: `NODE_ENV=production`
- `DATABASE_URL`: Internal Database URL from Render PostgreSQL
- `CORS_ORIGIN`: `https://koinos.onrender.com`
- `ADMIN_KEY`: a long random secret used only by authority tooling

Name the API service `koinos-api` so the existing production frontend automatically uses:
`https://koinos-api.onrender.com`.

### 3. Citizen frontend

Deploy the repository root as a Render Static Site:

- Build command: leave empty
- Publish directory: `.`

No Node/npm build is required for the citizen frontend.

## Privacy notes

Anonymous reporting hides the reporter identity from the product model; the current demo identifies a device only for duplicate-vote protection. Do not store personal information in the description or photo unless your deployment has the appropriate privacy policy and retention controls.
