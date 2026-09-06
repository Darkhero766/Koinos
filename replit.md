# KOINOS

KOINOS is a demo-first civic action experience built from the provided hackathon brief. It is intentionally a lightweight Vite single-page app so the core journey can be experienced without authentication or external services.

## Run locally

```bash
npm install
npm run dev
```

The Replit workflow serves the Vite app on port 5000.

## Demo flow

- Use **Report an issue** to walk through the four-step citizen report flow.
- Use map markers and filters in **Explore** to change the selected issue.
- Use **I'm affected too** to increase the community count.
- Drag the before/after slider and verify the repair.

The current report, map, AI analysis, authority queue, and verification interactions are front-end demo state. They are ready to connect to persistence and real services in a later pass.