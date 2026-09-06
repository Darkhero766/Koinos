# KOINOS API (reference backend)

A small Express API demonstrating the "Backend APIs" skill from the problem statement.
It's kept separate from the static front-end (`index.html` / `app.js`) so the deployed
demo keeps working standalone even if this server isn't running — this avoided touching
the existing Render static-site deploy.

## Run it

```bash
cd server
npm install
npm start
```

Listens on `http://localhost:4000` by default (`PORT` env var to change it). Data persists
to `data/issues.json`.

## Endpoints

| Method | Path                        | Description                                   |
|--------|-----------------------------|------------------------------------------------|
| GET    | `/api/issues`               | List all issues, newest first                  |
| GET    | `/api/issues/:id`           | Get one issue, with an AI-style summary        |
| POST   | `/api/issues`                | Create a report (photo, description, location) |
| POST   | `/api/issues/:id/upvote`     | "I'm affected too"                              |
| PATCH  | `/api/issues/:id/status`     | Move Reported → In Progress → Resolved         |
| GET    | `/api/analytics`             | Totals, resolution rate, avg. fix time, category breakdown |

`severity` is auto-predicted from the report description (bonus: severity prediction),
and every issue can return a short auto-generated summary (bonus: AI-generated summaries).

## Wiring it to the front-end

The front-end works fully offline by default. To point it at this API, set before
`app.js` loads:

```html
<script>window.KOINOS_API_BASE = "http://localhost:4000";</script>
```

New reports submitted through the demo modal will then also be mirrored to this API.
