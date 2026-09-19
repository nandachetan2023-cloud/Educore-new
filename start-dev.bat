@echo off
title EduCore Dev
color 0B

echo ============================================
echo   EduCore - Dev Mode (no build, hot-reload)
echo ============================================
echo.

echo Starting API dev server on http://localhost:4000/api ...
start "EduCore API (dev)" cmd /k "cd /d C:\work\erp\Educore-main\apps\api && npm run start:dev"

timeout /t 3 /nobreak >nul

echo Starting Web dev server on http://localhost:3000 ...
start "EduCore Web (dev)" cmd /k "cd /d C:\work\erp\Educore-main\apps\web && npm run dev"

echo.
echo Both dev servers started in separate windows.
echo   API  : http://localhost:4000/api
echo   Web  : http://localhost:3000
echo.
pause
