@echo off
title EduCore — Stop Servers
color 0C

echo.
echo  Stopping EduCore servers...
echo.

taskkill /f /im node.exe >nul 2>&1
if errorlevel 1 (
  echo  No Node.js processes were running.
) else (
  echo  All Node.js processes stopped.
)

echo.
echo  Done.
echo.
pause
