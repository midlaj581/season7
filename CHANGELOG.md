# Changelog — PPL Season 7 Upgrade

## Security Fixes (Critical)

1. **placeBid rate limiting** — Added per-socket rate limit: max 5 `placeBid` events per second using timestamp-diff approach in `socketHandler.js`.
2. **Content Security Policy** — Re-enabled Helmet CSP with policy allowing socket.io, Google Fonts, Cloudinary, self. Removed `contentSecurityPolicy: false`.
3. **CORS** — Changed from wildcard to `CORS_ORIGIN` env. Throws startup error if wildcard in production (`NODE_ENV=production`).
4. **JWT_SECRET validation** — Startup check: if `JWT_SECRET` equals `"change-this-secret"` in production, server refuses to start.
5. **Global error handler** — Added Express error middleware: `(err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Internal server error' }); }`
6. **.gitignore** — Added `node_modules/`, `backups/`, `.env`, `*.log`.

## Backend Improvements

7. **Zod validation** — Input validation for socket events and REST payloads: `playerId`, `amount`, `teamId`, player fields (name, basePrice, position), team fields (name, budget, color). Invalid payloads rejected with descriptive errors.
8. **Pino logger** — Replaced `console.log`/`console.error` with pino. Timestamp on each log line.
9. **5-level undo stack** — Replaced single-level undo with 5-level stack. New `admin:undoStack` socket event returns stack depth.
10. **Backup rotation** — Keep max 50 auto-backups. `GET /api/backups` (admin JWT) lists backup files with timestamps and sizes.
11. **CSV player import** — `POST /api/players/import` accepts multipart CSV. Columns: name, category/position, basePrice, age. Returns `{ imported, skipped, errors }`.
12. **Auction history API** — `GET /api/auction/history` returns `soldPlayers` with timestamps, team colors, prices.

## Frontend Split

13. **admin.html** — Extracted styles to `public/css/admin.css`. Shell structure preserved.
14. **manager.html** — Styles remain inline; structure ready for split.
15. **projector-overlay.js** — New module for animated transitions (fade out, slide in) between players on projector.
16. **results.html** — New page: auction summary, teams grouped, total spend, unsold list, budget vs spent bar chart (Chart.js).

## New Features

17. **Audio feedback** — Web Audio API: bid placed (ascending beep), timer ≤3s (tick), sold (triumphant chord), unsold (low tone). Mute toggle on admin/manager.
18. **CSV import UI** — (Planned: drag-drop zone in Admin Players tab.)
19. **Auction replay** — (Planned: timeline scrubber on results.html.)
20. **Keyboard shortcuts** — Admin: Space=start/stop, S=sold, U=unsold, Z=undo, R=revert. `?` for cheat-sheet.
21. **Player search & filter** — Live search and category pills in Admin Players tab.
22. **Team analytics** — (Planned: mini chart per team in Admin Teams tab.)

## Dependencies Added

- `zod` — Schema validation
- `pino` — Logging
- `csv-parse` — CSV parsing
- `multer` — Multipart form upload
- Chart.js (CDN) — results.html chart
