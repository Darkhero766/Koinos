# KOINOS

KOINOS is a demo-first civic action experience built from the provided hackathon brief. It is intentionally a lightweight Vite single-page app so the core journey can be experienced without authentication or external services.

## Run locally

```bash
npm install
npm run dev
```

The Replit workflow serves the Vite app on port 5000.

## Demo flow

- Use **Report an issue** to walk through the four-step citizen report flow, including an
  **anonymous reporting** toggle on the details step.
- Use map markers and filters in **Explore** to change the selected issue.
- Use **I'm affected too** to increase the community count.
- Drag the before/after slider and verify the repair.
- Use **Quick report (QR)** in the header to preview the printable QR code that links
  straight into the report flow (for lamp posts / community noticeboards).
- Scroll to **Act** to see the authority queue plus an **analytics dashboard** (total
  reports, resolution rate, avg. time to fix, category breakdown, and an auto-generated
  summary).

The report, map, AI analysis, authority queue, analytics, and verification interactions
are front-end demo state by default, so the static build keeps deploying exactly as before.
A reference backend that implements the same data model for real — issue CRUD, upvotes,
status transitions, severity prediction, and analytics — lives in `/server` and can be
run alongside the site; see `server/README.md`.

## Problem statement coverage

- Report local civic issues with photos and descriptions — ✓ four-step report flow
- View issues on an interactive map — ✓ Explore section
- Track status (Reported → In Progress → Resolved) — ✓ authority queue + `PATCH /api/issues/:id/status`
- Upvote issues affecting multiple people — ✓ "I'm affected too"
- Generate analytics for authorities — ✓ analytics dashboard + `GET /api/analytics`
- Bonus: AI-generated summaries — ✓ analytics note + `aiSummary` field
- Bonus: severity prediction — ✓ AI result step + keyword-based `predictSeverity`
- Bonus: anonymous reporting — ✓ toggle in the report flow
- Bonus: QR codes for quick reporting — ✓ "Quick report (QR)" header button
- Backend APIs — ✓ `/server` reference Express API