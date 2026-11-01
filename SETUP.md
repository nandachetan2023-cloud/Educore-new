# EduCore — Setup & Run Instructions

## Prerequisites

| Tool | Minimum version | Check |
|------|----------------|-------|
| Node.js | 20+ | `node -v` |
| npm | 9+ | `npm -v` |
| PostgreSQL | 14+ | `psql --version` |

---

## 1. Install dependencies

Open a terminal in the project root:

```
cd educore
npm install
```

This installs packages for both the API and the web app (npm workspaces).

---

## 2. Configure environment — API

Copy the example file and edit it:

```
copy apps\api\.env.example apps\api\.env
```

Open `apps\api\.env` and fill in at minimum:

```env
# PostgreSQL connection string
DATABASE_URL="postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/educore"

# Change these to random secrets before going live
JWT_ACCESS_SECRET=any-long-random-string
JWT_REFRESH_SECRET=another-long-random-string

# Port the API listens on (default 4000 — no change needed for local dev)
API_PORT=4000
```

Payment gateways and mail are **optional** for local development.  
They can also be configured later from the Admin panel.

---

## 3. Configure environment — Web

Usually **nothing is needed**. The browser calls same-origin `/api` and Next
rewrites it to the API host — so the browser never embeds a URL, and deploys
on any host work with no CORS setup.

If you must point at a separate API server (different domain), create
`apps\web\.env.local` — but note this value is baked into the browser bundle:

```env
NEXT_PUBLIC_API_URL=https://api.your-domain.com/api
```

> Never set `NEXT_PUBLIC_API_URL=http://localhost:4000` in a deployment —
> every visitor's browser would try to reach the API on *their own* machine
> (the "deployed login only works on the server" failure). For the server-side
> API origin alone, use `API_URL=http://localhost:4000`.

---

## 4. Set up the database

Create the database in PostgreSQL first:

```sql
CREATE DATABASE educore;
```

Then run migrations and seed initial data:

```
cd educore
npm run db:migrate
npm run db:seed
```

The seed creates:
- Sample categories, levels, and languages
- The default accounts below

### Default accounts

| Role | Email | Password | Notes |
|------|-------|----------|-------|
| Super Admin | `superadmin@gmail.com` | `password` | Tick "Log in as administrator" |
| Admin | `admin@gmail.com` | `password` | Tick "Log in as administrator" |
| Instructor | `instructor@gmail.com` | `12345678` | Instructor dashboard |
| Student | `user@gmail.com` | `12345678` | Student dashboard |

> These are demo credentials from `apps\api\prisma\seed.ts`. Change or remove
> them before going live. They are intentionally not shown on the login page.

---

## 5. Run the application

### Option A — Double-click (easiest)

| File | What it does |
|------|-------------|
| `educore-setup.bat` | Installs prerequisites, sets up the DB, builds both apps and starts them |
| `educore-diag.bat` | Prints a health report (versions, env files, ports, API health) |

### Option B — Manual (two terminals)

**Terminal 1 — API:**
```
cd educore\apps\api
npm run start:dev
```

**Terminal 2 — Web:**
```
cd educore\apps\web
npm run dev
```

---

## 6. Open the app

| URL | Description |
|-----|-------------|
| `http://localhost:3004` | Student-facing website |
| `http://localhost:3004/login` | Login (check "Log in as administrator" for admin) |
| `http://localhost:3004/register` | Register a new student account |
| `http://localhost:4000/api` | API base URL |
| `http://localhost:4000/api/docs` | Swagger API documentation |

---

## 7. First login (admin)

1. Go to `http://localhost:3004/login`
2. Check **"Log in as administrator"**
3. Use the credentials from `apps\api\prisma\seed.ts`
4. You'll land on the admin console at `/dashboard/admin`

From the admin console you can:
- Configure branding (name, logo, colors)
- Set up mail / payment gateways
- Approve instructor applications and courses
- Edit homepage, blog, and contact page content

---

## Useful scripts (run from project root)

| Script | Description |
|--------|-------------|
| `npm run build` | Build both API and web |
| `npm run dev:api` | API with hot-reload |
| `npm run dev:web` | Web with hot-reload |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:seed` | Seed initial data |
| `npm run db:studio` | Open Prisma Studio (DB browser) |

---

## Running on a client / LAN server

Run `educore-setup.bat` on the machine that will host the app. When it asks
**"Will other machines access this server?"**, answer **Y** (or pre-set the
address with `set EDUCORE_HOST=192.168.1.50` or a domain before running).
The script then:

- detects the server's LAN IP and writes `API_URL`, `WEB_URL` and
  `OAUTH_CALLBACK_BASE` into the root `.env`
- writes the matching `API_URL` into `apps\web\.env.local`
- opens inbound firewall ports `3004` (web) and `4000` (API) when run as
  Administrator
- prints the address clients should use, e.g. `http://192.168.1.50:3004`

From another machine open `http://<server-ip>:3004`. If it does not load,
allow TCP `3004` and `4000` in Windows Firewall and confirm both machines are
on the same network. Run `educore-diag.bat` on the server to check ports,
build output and API health.

> Use a static IP or DNS name. Uploaded files and OAuth redirects are built
> from `API_URL`, so changing the server IP later breaks those links.

---

## Troubleshooting

**Port already in use**  
Change `API_PORT` in `apps\api\.env` and `API_URL` in `apps\web\.env.local` to match.

**Database connection error**  
Verify PostgreSQL is running and `DATABASE_URL` in `.env` is correct.

**API starts but web shows errors**  
Make sure the API is running; the web app reaches it same-origin via `/api`
(see `API_URL` in `apps\web\.env.local` if you changed the API port).

**`dist/src/main.js` not found**  
Run `npm run build` from `apps\api` before running `npm run start`.
