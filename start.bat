@echo off
title EduCore Startup
color 0A

echo ============================================
echo   EduCore - Build and Start
echo ============================================
echo.

cd /d C:\work\erp\Educore-main

:: ── Build API ─────────────────────────────────
echo [1/4] Building API...
cd apps\api
call npm run build
if errorlevel 1 (
  echo ERROR: API build failed.
  pause
  exit /b 1
)
echo API build complete.
echo.

:: ── Build Web ─────────────────────────────────
echo [2/4] Building Web...
cd ..\web
call npm run build
if errorlevel 1 (
  echo ERROR: Web build failed.
  pause
  exit /b 1
)
echo Web build complete.
echo.

:: ── Start API in new window ────────────────────
echo [3/4] Starting API on http://localhost:4000/api ...
start "EduCore API" cmd /k "cd /d C:\work\erp\Educore-main\apps\api && npm run start"

:: Give API a moment to boot
timeout /t 3 /nobreak >nul

:: ── Start Web in new window ────────────────────
echo [4/4] Starting Web on http://localhost:3000 ...
start "EduCore Web" cmd /k "cd /d C:\work\erp\Educore-main\apps\web && npm run start"

echo.
echo ============================================
echo   Both servers are starting in new windows.
echo   API  : http://localhost:4000/api
echo   Web  : http://localhost:3000
echo ============================================
echo.
pause
