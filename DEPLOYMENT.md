# Deployment Guide — PPL Season 7

## Railway / Render Deployment

### 1. Environment Variables (Required)

| Variable        | Description                                      | Example                    |
|----------------|--------------------------------------------------|----------------------------|
| `NODE_ENV`     | Set to `production` for production               | `production`               |
| `PORT`         | Port to listen on (Railway/Render set this)      | `3000`                     |
| `JWT_SECRET`   | **Must be changed** from default in production   | `your-random-secret-here`  |
| `CORS_ORIGIN`  | Allowed origins (comma-separated, no `*` in prod)| `https://yourdomain.com`   |
| `DATABASE_URL` | MySQL connection URL                             | `mysql://user:pass@host/db`|

### 2. Optional Variables

| Variable                | Description                 | Default   |
|------------------------|-----------------------------|-----------|
| `LOG_LEVEL`            | Pino log level              | `info`    |
| `AUTO_BACKUP_INTERVAL_MS` | Auto-backup interval (ms) | `30000`   |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window           | `60000`   |
| `RATE_LIMIT_MAX`       | Max requests per window     | `300`     |

### 3. Database

- Use Railway MySQL or Render PostgreSQL/MySQL add-on.
- Set `DATABASE_URL` in the service environment.
- If using MySQL: `DATABASE_URL=mysql://user:password@host:3306/database?ssl=true`

### 4. Build & Start

```bash
npm install
npm start
```

No build step required for this Node.js app.

### 5. Startup Checks

The server will **refuse to start** if:

- `NODE_ENV=production` and `JWT_SECRET` is `change-this-secret` or empty
- `NODE_ENV=production` and `CORS_ORIGIN` is `*` or unset

### 6. Health Check

- Endpoint: `GET /health`
- Returns: `{ ok: true, service: 'ppl-auction', ts: "..." }`

### 7. Static Files

- `public/` served at root.
- Admin: `/admin.html`
- Projector: `/projector.html`
- Manager: `/manager.html`
- Results: `/results.html`
- Index: `/` or `/index.html`

### 8. API Authentication

- Admin routes require `Authorization: Bearer <JWT>`.
- Obtain JWT via `POST /api/admin/login` with `{ "password": "..." }`.
