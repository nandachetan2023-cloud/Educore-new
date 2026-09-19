@echo off
setlocal enabledelayedexpansion
title EduCore — Full Setup & Launch
color 0A

set ROOT=C:\work\erp\Educore-main
set API=%ROOT%\apps\api
set WEB=%ROOT%\apps\web

echo.
echo  =====================================================
echo    EduCore — Automated Setup ^& Launch
echo  =====================================================
echo.

:: ══════════════════════════════════════════════════════
:: STEP 1 — Check Node.js
:: ══════════════════════════════════════════════════════
echo [1/9] Checking Node.js...
node -v >nul 2>&1
if errorlevel 1 (
  echo  ERROR: Node.js is not installed or not in PATH.
  echo  Download from https://nodejs.org  (v20 or higher required^)
  pause & exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo  Node.js %NODE_VER% found.
echo.

:: ══════════════════════════════════════════════════════
:: STEP 2 — Create API .env if missing
:: ══════════════════════════════════════════════════════
echo [2/9] Checking API environment file...
if not exist "%API%\.env" (
  echo  .env not found — creating from example...
  copy "%API%\.env.example" "%API%\.env" >nul
  echo.
  echo  ┌─────────────────────────────────────────────────┐
  echo  │  ACTION REQUIRED                                │
  echo  │  Edit  apps\api\.env  and set DATABASE_URL      │
  echo  │  then re-run this script.                       │
  echo  └─────────────────────────────────────────────────┘
  echo.
  echo  Opening .env in Notepad...
  start notepad "%API%\.env"
  pause & exit /b 0
) else (
  echo  API .env exists — skipping.
)
echo.

:: ══════════════════════════════════════════════════════
:: STEP 3 — Create Web .env.local if missing
:: ══════════════════════════════════════════════════════
echo [3/9] Checking Web environment file...
if not exist "%WEB%\.env.local" (
  echo  Creating apps\web\.env.local...
  echo NEXT_PUBLIC_API_URL=http://localhost:4000/api> "%WEB%\.env.local"
  echo  Created.
) else (
  echo  Web .env.local exists — skipping.
)
echo.

:: ══════════════════════════════════════════════════════
:: STEP 4 — Install dependencies
:: ══════════════════════════════════════════════════════
echo [4/9] Installing dependencies (npm install)...
cd /d "%ROOT%"
call npm install
if errorlevel 1 (
  echo  ERROR: npm install failed.
  pause & exit /b 1
)
echo  Dependencies installed.
echo.

:: ══════════════════════════════════════════════════════
:: STEP 5 — Prisma generate
:: ══════════════════════════════════════════════════════
echo [5/9] Generating Prisma client...
echo  Stopping any running Node processes that may lock Prisma DLL...
taskkill /f /im node.exe >nul 2>&1
timeout /t 2 /nobreak >nul
cd /d "%API%"
call npx prisma generate --schema=prisma/schema.prisma
if errorlevel 1 (
  echo  Retrying after 5 seconds...
  timeout /t 5 /nobreak >nul
  call npx prisma generate --schema=prisma/schema.prisma
  if errorlevel 1 (
    echo  ERROR: Prisma generate failed. Close any editors or terminals
    echo  that may be holding the file, then re-run.
    pause & exit /b 1
  )
)
echo  Prisma client generated.
echo.

:: ══════════════════════════════════════════════════════
:: STEP 6 — Run database migrations
:: ══════════════════════════════════════════════════════
echo [6/9] Running database migrations...
call npx prisma migrate deploy
if errorlevel 1 (
  echo  WARNING: migrate deploy failed — trying migrate dev...
  call npx prisma migrate dev --name init
  if errorlevel 1 (
    echo  ERROR: Database migration failed.
    echo  Make sure PostgreSQL is running and DATABASE_URL in apps\api\.env is correct.
    pause & exit /b 1
  )
)
echo  Migrations applied.
echo.

:: ══════════════════════════════════════════════════════
:: STEP 7 — Seed the database
:: ══════════════════════════════════════════════════════
echo [7/9] Seeding database with demo data...
cd /d "%API%"
call npx ts-node prisma/seed.ts
if errorlevel 1 (
  echo  WARNING: Seed had errors (data may already exist — continuing^).
)
echo  Seed complete.
echo.

:: ══════════════════════════════════════════════════════
:: STEP 8 — Build API + Web
:: ══════════════════════════════════════════════════════
echo [8/9] Building API...
cd /d "%API%"
call npm run build
if errorlevel 1 (
  echo  ERROR: API build failed.
  pause & exit /b 1
)
echo  API built.
echo.

echo  Building Web (this may take 1-2 minutes^)...
cd /d "%WEB%"
call npm run build
if errorlevel 1 (
  echo  ERROR: Web build failed.
  pause & exit /b 1
)
echo  Web built.
echo.

:: ══════════════════════════════════════════════════════
:: STEP 9 — Start both servers
:: ══════════════════════════════════════════════════════
echo [9/9] Starting servers...
echo.
start "EduCore API  :4000" cmd /k "cd /d %API% && npm run start"
timeout /t 4 /nobreak >nul
start "EduCore Web  :3000" cmd /k "cd /d %WEB% && npm run start"
timeout /t 4 /nobreak >nul

:: Open browser
start http://localhost:3000

echo.
echo  =====================================================
echo    EduCore is running!
echo  =====================================================
echo.
echo    Website  :  http://localhost:3000
echo    API      :  http://localhost:4000/api
echo    Swagger  :  http://localhost:4000/api/docs
echo.
echo    Default login credentials
echo    ┌──────────────────┬───────────────────────┬──────────────┐
echo    │ Role             │ Email                 │ Password     │
echo    ├──────────────────┼───────────────────────┼──────────────┤
echo    │ Super Admin      │ superadmin@gmail.com  │ password     │
echo    │ Admin            │ admin@gmail.com       │ password     │
echo    │ Instructor       │ instructor@gmail.com  │ password     │
echo    │ Student          │ user@gmail.com        │ password     │
echo    └──────────────────┴───────────────────────┴──────────────┘
echo.
echo    Both servers are open in separate windows.
echo    Close those windows to stop the servers.
echo.
pause
