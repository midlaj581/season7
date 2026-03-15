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

- Admin panel login uses password verification (socket or HTTP). **Default password** (if you never changed it in Settings): `ppl2024`. Change it in Admin → Settings after first login.
- Admin API routes require `Authorization: Bearer <JWT>`.
- Obtain JWT via `POST /api/admin/login` with `{ "password": "..." }`.

---

## Troubleshooting

### `Error: connect ETIMEDOUT` (Railway / cloud)

The app cannot reach the MySQL server. Fix:

1. **Use the right database URL**
   - On **Railway**: add the **MySQL** plugin to your project and use the `DATABASE_URL` (or `MYSQL_URL`) Railway provides. Do **not** set `DATABASE_URL` to `localhost` or a host that only works on your machine.
   - If you use an **external** MySQL (PlanetScale, Aiven, etc.), the host must be **publicly reachable** and allow connections from the cloud (e.g. allow 0.0.0.0/0 or Railway’s egress IPs).

2. **Check the host in logs**
   - After deploy, the log line `Connecting to MySQL at <host>:<port>` shows which host is used. If it’s `127.0.0.1` or `localhost`, your env is wrong for cloud (that only works on the same machine).

3. **Env vars**
   - Prefer a single **`DATABASE_URL`** (e.g. `mysql://user:password@host:3306/database?ssl=true`). If you set both `DATABASE_URL` and `DB_HOST`, the app uses `DATABASE_URL` and ignores `DB_HOST`.

4. **Optional**
   - `DB_CONNECT_TIMEOUT_MS` (default `15000`) — increase if the DB is slow to accept connections.
   - `DB_SSL=true` or `?ssl=true` in the URL if your provider requires SSL.

### Using Aiven MySQL (e.g. with Railway)

1. **Connection URI**
   - In Aiven Console → your MySQL service → **Connection information**.
   - Copy the **Connection URI** (or **Public** host/port and build it). Use the **public** hostname (e.g. `mysql-<project>-<service>.aivencloud.com`), not a private/VPC host, so Railway can reach it.

2. **Allow access from the internet**
   - In Aiven: same service → **Networking** (or **Settings**).
   - Enable **Public access** or add **0.0.0.0/0** to allowed networks so Railway’s outbound IPs can connect. Without this, you get `ETIMEDOUT`.

3. **SSL**
   - Aiven requires SSL. Either:
     - Append `?ssl-mode=require` or `?ssl=true` to your `DATABASE_URL`, or  
     - Set `DB_SSL=true` in the app env.

4. **Example `DATABASE_URL`**
   ```text
   mysql://avnadmin:YOUR_PASSWORD@mysql-yourproject-yourservice.aivencloud.com:PORT/defaultdb?ssl-mode=require
   ```
   Replace `defaultdb` with your database name if you created a different one.
