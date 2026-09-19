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
cd C:\work\erp\Educore-main
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

Create `apps\web\.env.local`:

```
copy NUL apps\web\.env.local
```

Add this single line (matches the default API port):

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

---

## 4. Set up the database

Create the database in PostgreSQL first:

```sql
CREATE DATABASE educore;
```

Then run migrations and seed initial data:

```
cd C:\work\erp\Educore-main
npm run db:migrate
npm run db:seed
```

The seed creates:
- A **super admin** account  
- Sample categories, levels, and languages

> Check `apps\api\prisma\seed.ts` for the seeded admin email/password.

---

## 5. Run the application

### Option A — Double-click (easiest)

| File | What it does |
|------|-------------|
| `start.bat` | Builds both apps then starts them (production mode) |
| `start-dev.bat` | Starts both in dev mode with hot-reload (no build step) |

### Option B — Manual (two terminals)

**Terminal 1 — API:**
```
cd C:\work\erp\Educore-main\apps\api
npm run start:dev
```

**Terminal 2 — Web:**
```
cd C:\work\erp\Educore-main\apps\web
npm run dev
```

---

## 6. Open the app

| URL | Description |
|-----|-------------|
| `http://localhost:3000` | Student-facing website |
| `http://localhost:3000/login` | Login (check "Log in as administrator" for admin) |
| `http://localhost:3000/register` | Register a new student account |
| `http://localhost:4000/api` | API base URL |
| `http://localhost:4000/api/docs` | Swagger API documentation |

---

## 7. First login (admin)

1. Go to `http://localhost:3000/login`
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

## Troubleshooting

**Port already in use**  
Change `API_PORT` in `apps\api\.env` and update `NEXT_PUBLIC_API_URL` in `apps\web\.env.local` to match.

**Database connection error**  
Verify PostgreSQL is running and `DATABASE_URL` in `.env` is correct.

**API starts but web shows errors**  
Make sure `NEXT_PUBLIC_API_URL` in `apps\web\.env.local` points to the correct API address and the API is running.

**`dist/src/main.js` not found**  
Run `npm run build` from `apps\api` before running `npm run start`.
