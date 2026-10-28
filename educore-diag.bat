@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1
title EduCore - Diagnostic Check
color 0E

:: Repo root = folder this script lives in (quoted assignment, see educore-setup.bat
:: notes: a folder name containing & would split the command without quotes).
set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"
set "API=%ROOT%\apps\api"
set "WEB=%ROOT%\apps\web"

echo.
echo  =====================================================
echo    EduCore Diagnostics - quick health report
echo    Collects versions, files, ports and API health
echo  =====================================================
echo.

:: 1 - Node.js / npm
echo  [1/7] Node.js / npm
where node >nul 2>&1
if errorlevel 1 (
  echo        node      : MISSING - run educore-setup.bat to install
  set NODE_VER=n/a
) else (
  for /f "tokens=*" %%v in ('node -v') do echo        node      : %%v
)
where npm >nul 2>&1
if errorlevel 1 (
  echo        npm       : MISSING
) else (
  for /f "tokens=*" %%v in ('npm -v') do echo        npm       : %%v
)
echo.

:: 2 - Environment files
echo  [2/7] Environment files
call :checkenv "%ROOT%\.env"
call :checkenv "%API%\.env"
call :checkenv "%WEB%\.env.local"
echo        (apps\api\.env must exist - Prisma reads env from its own cwd^)
echo.

:: 3 - DATABASE_URL target
echo  [3/7] Database
set "DBHOST=localhost"
set "DBPORT=5432"
for /f "tokens=1* delims==" %%A in ('findstr /b "DATABASE_URL=" "%ROOT%\.env" 2^>nul') do set "DBURL=%%B"
if defined DBURL (
  set "DBURL=%DBURL:"=%"
  for /f "tokens=4 delims=@:" %%C in ("!DBURL!") do if not "%%C"=="" set "DBHOST=%%C"
  for /f "tokens=5 delims=@:" %%C in ("!DBURL!") do for /f "tokens=1 delims=/?" %%D in ("%%C") do if not "%%D"=="" set "DBPORT=%%D"
)
echo        target    : %DBHOST%:%DBPORT%
powershell -NoProfile -NonInteractive -Command "try { $c = New-Object Net.Sockets.TcpClient('%DBHOST%', %DBPORT%); $c.Close(); exit 0 } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
  echo        reach     : FAILED - PostgreSQL not running or wrong host/port
) else (
  echo        reach     : OK ^(port open^)
)
echo.

:: 4 - Dependencies
echo  [4/7] Dependencies
if exist "%ROOT%\node_modules" (
  set "PKGCOUNT=0"
  for /f %%c in ('dir /b /ad "%ROOT%\node_modules" 2^>nul ^| find /c /v ""') do set "PKGCOUNT=%%c"
  echo        node_modules : present ^(!PKGCOUNT! packages^)
) else (
  echo        node_modules : MISSING - run educore-setup.bat
)
if exist "%ROOT%\node_modules\.bin\prisma.cmd" (echo        prisma CLI  : present) else (echo        prisma CLI  : MISSING)
if exist "%ROOT%\node_modules\.prisma\client"  (echo        prisma gen  : present) else (echo        prisma gen  : MISSING - run prisma generate)
echo.

:: 5 - Build outputs
echo  [5/7] Build outputs
if exist "%API%\dist\src\main.js" (echo        API dist    : present) else (echo        API dist    : MISSING - npm run build --workspace=@educore/api)
if exist "%WEB%\.next" (
  echo        Web .next   : present
) else (
  if exist "%WEB%\.next-runtime-dev" (
    echo        Web .next   : dev build only ^(.next-runtime-dev^)
  ) else (
    echo        Web .next   : MISSING - npm run build --workspace=@educore/web
  )
)
if exist "%WEB%\public\brand\logo.svg" (echo        Brand logo  : present) else (echo        Brand logo  : MISSING - apps\web\public\brand\logo.svg)
if exist "%WEB%\public\brand\favicon.ico" (echo        Favicon     : present) else (echo        Favicon     : MISSING - apps\web\public\brand\favicon.ico)
echo.

:: 6 - Ports / running servers
echo  [6/7] Servers / ports
call :portstat "API     " 4000
call :portstat "Web     " 3004
echo.

:: 7 - API health
echo  [7/7] API health check
where curl >nul 2>&1
if errorlevel 1 (
  echo        curl not found - open http://localhost:4000/api/health manually
) else (
  curl -sf -m 5 http://localhost:4000/api/health >"%TEMP%\educore_health.txt" 2>&1
  set "body="
  set /p body=<"%TEMP%\educore_health.txt"
  del "%TEMP%\educore_health.txt" >nul 2>&1
  if errorlevel 1 (
    echo        /api/health : NOT RESPONDING - check the API window for errors
  ) else (
    echo        /api/health : OK - !body!
  )
)
echo.

echo  =====================================================
echo    Report done. Send any FAILED lines when asking for help.
echo  =====================================================
echo.
pause
exit /b 0

:checkenv
if exist %1 (echo        %~1 : present) else (echo        %~1 : MISSING)
exit /b 0

:portstat
powershell -NoProfile -NonInteractive -Command "$l = Get-NetTCPConnection -LocalPort %2 -State Listen -ErrorAction SilentlyContinue; if($l){ Write-Host '        %1 port %2 : LISTENING (server running)' } else { Write-Host '        %1 port %2 : not listening (server stopped)' }"
exit /b 0
