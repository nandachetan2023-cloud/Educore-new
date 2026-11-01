@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1
title EduCore - Full Setup and Launch
color 0A

:: Repo root = folder this script lives in (no hardcoded paths).
:: NOTE: quotes around the whole assignment are required - without them a
:: folder name containing & (e.g. "Full Setup & Launch") splits the command,
:: giving "'Launch' is not recognized" and a bogus ROOT that makes Notepad
:: report "The system cannot find the path specified."
set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"
set "API=%ROOT%\apps\api"
set "WEB=%ROOT%\apps\web"
set "PRISMA=%ROOT%\node_modules\.bin\prisma.cmd"

:: Deployment origin. Defaults to localhost (single-machine install).
:: :configure_origins (called in step 2) switches these to the server's
:: network IP when the app is accessed from other machines - otherwise
:: uploads, OAuth redirects and links keep pointing at the client's own PC.
set "HOST=localhost"
set "SERVER_MODE=0"
set "API_ORIGIN=http://localhost:4000"
set "WEB_ORIGIN=http://localhost:3004"

echo.
echo  =====================================================
echo    EduCore - Automated Setup ^& Launch
echo    Installs Node.js + PostgreSQL if missing, installs
echo    dependencies, sets up the DB, builds and starts
echo    API (:4000^) + Web (:3004^)
echo  =====================================================
echo.

:: ──────────────────────────────────────────────
:: STEP 1 - Node.js v20+ (auto-install if missing)
:: ──────────────────────────────────────────────
echo [1/10] Checking Node.js...
where node >nul 2>&1
if errorlevel 1 call :install_node
if errorlevel 1 (
  echo  ERROR: Node.js is still missing.
  echo  Install Node.js v20 or higher from https://nodejs.org then re-run.
  pause
  exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
for /f "tokens=1 delims=v." %%M in ("%NODE_VER%") do set NODE_MAJOR=%%M
if not defined NODE_MAJOR set NODE_MAJOR=0
if %NODE_MAJOR% LSS 20 (
  echo  ERROR: Node.js %NODE_VER% found - v20 or higher is required.
  pause
  exit /b 1
)
echo  Node.js %NODE_VER% found.
echo.

:: ──────────────────────────────────────────────
:: STEP 2 - Root .env (single env file for API + Prisma)
:: ──────────────────────────────────────────────
echo [2/10] Checking environment file...
if not exist "%ROOT%\.env" (
  if not exist "%ROOT%\.env.example" (
    echo  ERROR: .env.example not found next to this script.
    echo  You probably copied only the .bat file. Copy the WHOLE
    echo  EduCore folder (with apps\, .env.example, package.json^), then re-run.
    pause
    exit /b 1
  )
  echo  .env not found - creating from .env.example...
  copy "%ROOT%\.env.example" "%ROOT%\.env" >nul
  if errorlevel 1 (
    echo  ERROR: could not create .env. Extract the ZIP first
    echo  (right-click ^> Extract All^) - do not run from inside the ZIP.
    pause
    exit /b 1
  )
  call :configure_origins
  echo.
  echo  +-------------------------------------------------+
  echo    ACTION REQUIRED
  echo    Edit  .env  (repo root^) and check DATABASE_URL,
  echo    then re-run this script.
  echo  +-------------------------------------------------+
  echo.
  echo  Opening .env in Notepad...
  echo  Folder: %ROOT%
  if not exist "%ROOT%\.env" (
    echo  ERROR: copy succeeded but "%ROOT%\.env" still not found.
    echo  Rename the folder to remove ^& and special characters,
    echo  e.g. C:\EduCore, then re-run.
    pause
    exit /b 1
  )
  notepad.exe "%ROOT%\.env"
  echo  If Notepad showed "The system cannot find the path specified",
  echo  your folder name contains ^& or special chars. Close this window,
  echo  rename the folder to C:\EduCore and re-run.
  pause
  exit /b 0
) else (
  echo  Root .env exists - skipping.
  call :configure_origins
)
echo.

:: ──────────────────────────────────────────────
:: STEP 3 - Web .env.local (server-side API origin)
:: NOTE: NEXT_PUBLIC_API_URL must NOT be set here. It is baked into the
:: browser bundle at build time - setting it to localhost:4000 breaks the
:: site for every machine except the server (the deployed-login bug).
:: Instead the browser calls same-origin /api (next.config.mjs rewrites it
:: to API_URL), so only the server-side API_URL is configured here.
:: ──────────────────────────────────────────────
echo [3/10] Checking Web environment file...
if not exist "%WEB%\.env.local" (
  echo  Creating apps\web\.env.local...
  > "%WEB%\.env.local" echo API_URL=!API_ORIGIN!
  echo  Created ^(API_URL=!API_ORIGIN!^).
) else (
  call :set_env_key "%WEB%\.env.local" "API_URL" "!API_ORIGIN!"
  echo  Web .env.local updated ^(API_URL=!API_ORIGIN!^).
)
findstr /b "NEXT_PUBLIC_API_URL=" "%WEB%\.env.local" >nul 2>&1
if not errorlevel 1 (
  echo  WARNING: apps\web\.env.local sets NEXT_PUBLIC_API_URL.
  echo  Remove it unless the API has its own public domain - it is baked
  echo  into the browser bundle and breaks login for remote visitors.
)
echo.

:: ──────────────────────────────────────────────
:: STEP 4 - PostgreSQL (auto-install if missing)
:: ──────────────────────────────────────────────
echo [4/10] Checking PostgreSQL...
call :parse_dburl
call :pg_check
if errorlevel 1 call :install_postgres
if errorlevel 1 (
  echo  ERROR: PostgreSQL is not reachable and could not be installed.
  pause
  exit /b 1
)
call :ensure_db
if errorlevel 1 (
  echo  ERROR: Could not prepare the database - see messages above.
  pause
  exit /b 1
)
echo  PostgreSQL is ready.
echo.

:: ──────────────────────────────────────────────
:: STEP 5 - Install all dependencies (npm workspaces)
:: ──────────────────────────────────────────────
echo [5/10] Installing dependencies (npm install - this takes a few minutes^)...
cd /d "%ROOT%"
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo  ERROR: npm install failed. Check your internet connection and re-run.
  pause
  exit /b 1
)
echo  Dependencies installed.
echo.

:: ──────────────────────────────────────────────
:: STEP 6 - Generate Prisma client
:: (Kill stray node processes first: a running API locks
::  the Prisma engine DLL and generate would fail with EPERM.)
:: ──────────────────────────────────────────────
echo [6/10] Generating Prisma client...
taskkill /f /im node.exe >nul 2>&1
timeout /t 2 /nobreak >nul
cd /d "%API%"
:: Prisma CLI only reads .env from its cwd (apps\api), while our
:: source of truth is the root .env. Mirror it so generate + db push
:: see DATABASE_URL without parsing passwords with special chars.
copy /y "%ROOT%\.env" "%API%\.env" >nul
call "%PRISMA%" generate
if errorlevel 1 (
  echo  Retrying after 5 seconds...
  timeout /t 5 /nobreak >nul
  call "%PRISMA%" generate
  if errorlevel 1 (
    echo  ERROR: Prisma generate failed. Close any editors or terminals
    echo  that may hold the Prisma files, then re-run.
    pause
    exit /b 1
  )
)
echo  Prisma client generated.
echo.

:: ──────────────────────────────────────────────
:: STEP 7 - Sync database schema (prisma db push)
:: ──────────────────────────────────────────────
echo [7/10] Syncing database schema...
call "%PRISMA%" db push --skip-generate
if errorlevel 1 (
  echo  ERROR: Database sync failed.
  echo  Make sure PostgreSQL is running and DATABASE_URL in .env is correct.
  pause
  exit /b 1
)
echo  Database schema is in sync.
echo.

:: ──────────────────────────────────────────────
:: STEP 8 - Seed demo data (RESETS demo content)
:: ──────────────────────────────────────────────
echo [8/10] Seeding database with demo data...
echo  NOTE: the seed resets demo tenants/users/courses.
cd /d "%API%"
call node -e "require('dotenv').config({path:'../../.env'}); require('ts-node').register({transpileOnly:true, compilerOptions:{module:'commonjs'}}); require('./prisma/seed.ts')"
if errorlevel 1 (
  echo  ERROR: Seed failed - see the error above, then re-run.
  pause
  exit /b 1
)
echo  Seed complete ^(tenants, courses, users, leads ^& resellers^).
echo.

:: ──────────────────────────────────────────────
:: STEP 9 - Build API + Web
:: ──────────────────────────────────────────────
echo [9/10] Building API...
cd /d "%ROOT%"
call npm run build --workspace=@educore/api
if errorlevel 1 (
  echo  ERROR: API build failed.
  pause
  exit /b 1
)
echo  API built.
echo.
echo  Building Web (this may take 1-2 minutes^)...
call npm run build --workspace=@educore/web
if errorlevel 1 (
  echo  ERROR: Web build failed.
  pause
  exit /b 1
)
echo  Web built.
echo.

:: ──────────────────────────────────────────────
:: STEP 10 - Start both servers + verify API health
:: ──────────────────────────────────────────────
echo [10/10] Starting servers...
echo.
if "%SERVER_MODE%"=="1" call :open_firewall
start "EduCore API  :4000" /d "%ROOT%" cmd /k "npm run start:api"
timeout /t 6 /nobreak >nul
start "EduCore Web  :3004" /d "%ROOT%" cmd /k "npm run start:web"

echo  Waiting for the API to become ready...
set API_READY=0
where curl >nul 2>&1
if errorlevel 1 (
  echo  (curl not found - skipping automatic health check.^)
  timeout /t 10 /nobreak >nul
) else (
  for /l %%i in (1,1,30) do (
    curl -sf !API_ORIGIN!/api/health >nul 2>&1
    if not errorlevel 1 (
      set API_READY=1
      goto :api_ready
    )
    timeout /t 2 /nobreak >nul
  )
)
:api_ready
if "%API_READY%"=="1" (
  echo  API health check passed.
) else (
  echo  WARNING: API did not answer /api/health within 60s.
  echo  Check the "EduCore API" window for errors.
)
echo.

:: Open browser
start %WEB_ORIGIN%

echo.
echo  =====================================================
echo    EduCore is running!
echo  =====================================================
echo.
echo    Website  :  %WEB_ORIGIN%
echo    API      :  %API_ORIGIN%/api
echo    Swagger  :  %API_ORIGIN%/api/docs
if "%SERVER_MODE%"=="1" (
  echo.
  echo    Server mode: share %WEB_ORIGIN% with your client.
  echo    If they still cannot reach it, check Windows Firewall
  echo    and that both machines are on the same network.
)
echo.
echo    Default login credentials  (log in at /login^)
echo    +--------------------------------------------------+
echo    Role          Email                 Password
echo    ----------------------------------------------------
echo    Super Admin   superadmin@gmail.com  password
echo    Admin         admin@gmail.com       password
echo    Instructor    instructor@gmail.com  12345678
echo    Student       user@gmail.com        12345678
echo    +--------------------------------------------------+
echo    Tick "administrator" for the two admin tiers.
echo.
echo    Both servers are open in separate windows.
echo    Close those windows to stop the servers.
echo.
pause
exit /b 0

:: ══════════════════════════════════════════════════════
:: Subroutine: install Node.js automatically.
:: winget system install first, portable download fallback.
:: Returns errorlevel 0 when `node` works afterwards.
:: ══════════════════════════════════════════════════════
:install_node
echo  Node.js not found - attempting automatic install...
echo.
where winget >nul 2>&1
if errorlevel 1 goto :node_portable
echo  Installing Node.js LTS via winget...
echo  ^(Approve the admin prompt if Windows asks.^)
winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
where node >nul 2>&1
if not errorlevel 1 goto :node_installed
if exist "C:\Program Files\nodejs\node.exe" set "PATH=C:\Program Files\nodejs;%PATH%"
where node >nul 2>&1
if not errorlevel 1 goto :node_installed
echo  winget finished but node is still not on PATH.
echo  Close this window and re-run the script.
pause
exit 1

:node_portable
echo  winget is not available - installing portable Node.js, no admin needed...
set "NODE_HOME=%LOCALAPPDATA%\EduCore\node"
if exist "%NODE_HOME%\node.exe" goto :node_portable_ready
echo  Downloading the current Node.js LTS for Windows x64...
powershell -NoProfile -NonInteractive -Command "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; $v=(Invoke-RestMethod 'https://nodejs.org/dist/index.json' | Where-Object { $_.lts } | Select-Object -First 1).version; if(-not $v){exit 1}; $u='https://nodejs.org/dist/'+$v+'/node-'+$v+'-win-x64.zip'; $z=$env:TEMP+'\node-portable.zip'; Invoke-WebRequest -Uri $u -OutFile $z; $d=$env:TEMP+'\node-portable'; if(Test-Path $d){Remove-Item -Recurse -Force $d}; Expand-Archive -Path $z -DestinationPath $d; $inner=(Get-ChildItem $d -Directory | Select-Object -First 1).FullName; $dest=$env:LOCALAPPDATA+'\EduCore\node'; if(Test-Path $dest){Remove-Item -Recurse -Force $dest}; New-Item -ItemType Directory -Force -Path $dest | Out-Null; Copy-Item ($inner+'\*') $dest -Recurse -Force; Remove-Item -Force $z; Remove-Item -Recurse -Force $d"
if errorlevel 1 (
  echo  ERROR: portable download failed - check your internet connection.
  echo  Install Node.js manually from https://nodejs.org then re-run.
  exit /b 1
)
:node_portable_ready
set "PATH=%NODE_HOME%;%PATH%"
powershell -NoProfile -NonInteractive -Command "$p=[Environment]::GetEnvironmentVariable('Path','User'); if($p -notlike '*EduCore\node*'){[Environment]::SetEnvironmentVariable('Path',($p+';'+$env:LOCALAPPDATA+'\EduCore\node'),'User'); Write-Host 'Added portable Node.js to your user PATH.'}" >nul 2>&1
where node >nul 2>&1
if errorlevel 1 exit /b 1

:node_installed
for /f "tokens=*" %%v in ('node -v') do echo  Node.js %%v ready.
echo.
exit /b 0

:: ══════════════════════════════════════════════════════
:: Subroutine: choose localhost vs. this server's network
:: IP, then write API_URL / WEB_URL / OAUTH_CALLBACK_BASE.
:: Keeps an existing non-localhost URL so re-runs do not
:: reset a client-server install back to localhost.
:: ══════════════════════════════════════════════════════
:configure_origins
:: Optional override, e.g. `set EDUCORE_HOST=edu.example.com` before running.
if defined EDUCORE_HOST (
  set "HOST=!EDUCORE_HOST!"
  if /i "!HOST!"=="localhost" (set "SERVER_MODE=0") else (set "SERVER_MODE=1")
  goto :origins_write
)
set "CUR_API_URL="
set "CUR_HOST="
for /f "tokens=1* delims==" %%A in ('findstr /b "API_URL=" "%ROOT%\.env" 2^>nul') do set "CUR_API_URL=%%B"
if defined CUR_API_URL (
  set "CUR_API_URL=!CUR_API_URL:"=!"
  for /f "tokens=2 delims=:/" %%A in ("!CUR_API_URL!") do set "CUR_HOST=%%A"
)
if defined CUR_HOST if /i not "!CUR_HOST!"=="localhost" if not "!CUR_HOST!"=="127.0.0.1" (
  set "HOST=!CUR_HOST!"
  set "SERVER_MODE=1"
  echo  Keeping server address from .env ^(API_URL host: !HOST!^).
  goto :origins_write
)
choice /c YN /n /m "  Will other machines access this server? (Y/N) "
if errorlevel 2 goto :origins_local
call :detect_lan_ip
if not defined LAN_IP (
  echo  WARNING: could not detect a network IP - keeping localhost.
  goto :origins_local
)
set "HOST=!LAN_IP!"
set "SERVER_MODE=1"
echo  Using this server's network address: !HOST!
goto :origins_write
:origins_local
set "HOST=localhost"
set "SERVER_MODE=0"
:origins_write
set "API_ORIGIN=http://!HOST!:4000"
set "WEB_ORIGIN=http://!HOST!:3004"
call :set_env_key "%ROOT%\.env" "API_URL" "!API_ORIGIN!"
call :set_env_key "%ROOT%\.env" "WEB_URL" "!WEB_ORIGIN!"
call :set_env_key "%ROOT%\.env" "OAUTH_CALLBACK_BASE" "!API_ORIGIN!"
echo  API_URL=%API_ORIGIN%
echo  WEB_URL=%WEB_ORIGIN%
exit /b 0

:: ══════════════════════════════════════════════════════
:: Subroutine: detect the primary LAN IPv4 address.
:: Sets LAN_IP (empty when none found).
:: ══════════════════════════════════════════════════════
:detect_lan_ip
set "LAN_IP="
for /f "usebackq delims=" %%i in (`powershell -NoProfile -NonInteractive -Command "$ip = Get-NetIPConfiguration | Where-Object {$_.IPv4DefaultGateway -ne $null -and $_.NetAdapter.Status -eq 'Up'} | ForEach-Object {$_.IPv4Address.IPAddress} | Select-Object -First 1; if(-not $ip){ $ip = Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -notmatch '^(127\.|169\.254\.)' -and $_.InterfaceAlias -notmatch 'Loopback|vEthernet|VMware|VirtualBox'} | Select-Object -First 1 -ExpandProperty IPAddress }; Write-Output $ip"`) do set "LAN_IP=%%i"
exit /b 0

:: ══════════════════════════════════════════════════════
:: Subroutine: set KEY=VALUE in an env file, updating the
:: first match or appending the key when it is missing.
:: ══════════════════════════════════════════════════════
:set_env_key
set "ENV_FILE=%~1"
set "ENV_KEY=%~2"
set "ENV_VAL=%~3"
powershell -NoProfile -NonInteractive -Command "$p=$env:ENV_FILE; $k=$env:ENV_KEY; $v=$env:ENV_VAL; $enc=New-Object System.Text.UTF8Encoding $false; $lines=New-Object System.Collections.Generic.List[string]; if(Test-Path $p){ foreach($l in [System.IO.File]::ReadAllLines($p,[System.Text.Encoding]::UTF8)){ $lines.Add($l) } }; $found=$false; for($i=0;$i -lt $lines.Count;$i++){ if($lines[$i] -match ('^'+[regex]::Escape($k)+'=')){ $lines[$i]=$k+'='+$v; $found=$true } }; if(-not $found){ $lines.Add($k+'='+$v) }; [System.IO.File]::WriteAllLines($p,$lines,$enc)"
exit /b 0

:: ══════════════════════════════════════════════════════
:: Subroutine: allow inbound API/Web ports for LAN access.
:: Needs Administrator; failure is only a warning.
:: ══════════════════════════════════════════════════════
:open_firewall
netsh advfirewall firewall add rule name="EduCore API 4000" dir=in action=allow protocol=TCP localport=4000 >nul 2>&1
netsh advfirewall firewall add rule name="EduCore Web 3004" dir=in action=allow protocol=TCP localport=3004 >nul 2>&1
if errorlevel 1 (
  echo  NOTE: could not add firewall rules - run as Administrator or
  echo  allow inbound TCP 3004 and 4000 manually.
) else (
  echo  Firewall ports 3004 and 4000 opened.
)
exit /b 0

:: ══════════════════════════════════════════════════════
:: Subroutine: read DB connection parts from root .env
:: DATABASE_URL. Defaults = local postgres/postgres.
:: Sets DBUSER DBPASS DBHOST DBPORT DBNAME.
:: ══════════════════════════════════════════════════════
:parse_dburl
set "DBUSER=postgres"
set "DBPASS=postgres"
set "DBHOST=localhost"
set "DBPORT=5432"
set "DBNAME=educore"
set "DBURL="
for /f "tokens=1* delims==" %%A in ('findstr /b "DATABASE_URL=" "%ROOT%\.env" 2^>nul') do set "DBURL=%%B"
if not defined DBURL exit /b 0
set "DBURL=%DBURL:"=%"
for /f "tokens=2 delims=/" %%A in ("%DBURL%") do set "DBAUTH_HOST=%%A"
for /f "tokens=1 delims=@" %%A in ("%DBAUTH_HOST%") do set "DBAUTH=%%A"
for /f "tokens=1,2 delims=:" %%A in ("%DBAUTH%") do (
  if not "%%A"=="" set "DBUSER=%%A"
  if not "%%B"=="" set "DBPASS=%%B"
)
for /f "tokens=2 delims=@" %%A in ("%DBAUTH_HOST%") do set "DBHOSTPORT=%%A"
for /f "tokens=1,2 delims=:" %%A in ("%DBHOSTPORT%") do (
  if not "%%A"=="" set "DBHOST=%%A"
  if not "%%B"=="" set "DBPORT=%%B"
)
for /f "tokens=3 delims=/" %%A in ("%DBURL%") do set "DBNAME_Q=%%A"
for /f "tokens=1 delims=?" %%A in ("%DBNAME_Q%") do if not "%%A"=="" set "DBNAME=%%A"
exit /b 0

:: ══════════════════════════════════════════════════════
:: Subroutine: TCP check on %DBHOST%:%DBPORT%.
:: Returns errorlevel 0 when reachable.
:: ══════════════════════════════════════════════════════
:pg_check
powershell -NoProfile -NonInteractive -Command "try { $c = New-Object Net.Sockets.TcpClient('%DBHOST%', %DBPORT%); $c.Close(); exit 0 } catch { exit 1 }" >nul 2>&1
exit /b

:: ══════════════════════════════════════════════════════
:: Subroutine: wait up to ~60s for PostgreSQL.
:: ══════════════════════════════════════════════════════
:pg_wait
for /l %%i in (1,1,30) do (
  call :pg_check
  if not errorlevel 1 exit /b 0
  timeout /t 2 /nobreak >nul
)
exit /b 1

:: ══════════════════════════════════════════════════════
:: Subroutine: install/start PostgreSQL automatically.
:: 1) start it if installed-but-stopped,
:: 2) unattended winget install using the .env password.
:: Returns errorlevel 0 when the port is reachable.
:: ══════════════════════════════════════════════════════
:install_postgres
if /i not "%DBHOST%"=="localhost" if /i not "%DBHOST%"=="127.0.0.1" if /i not "%DBHOST%"=="::1" (
  echo  ERROR: DATABASE_URL points to %DBHOST% - remote databases cannot be auto-installed.
  echo  Make it reachable and re-run.
  exit /b 1
)
echo  PostgreSQL is not running - attempting automatic install...
echo.
for %%V in (18 17 16 15 14) do (
  net start postgresql-x64-%%V >nul 2>&1
  call :pg_check
  if not errorlevel 1 (
    echo  Started the existing PostgreSQL service.
    exit /b 0
  )
)
where winget >nul 2>&1
if errorlevel 1 goto :pg_manual
for %%P in (PostgreSQL.PostgreSQL.18 PostgreSQL.PostgreSQL.17) do (
  echo  Installing %%P - downloads ~400MB and takes several minutes...
  echo  ^(Approve the admin prompt if Windows asks.^)
  winget install -e --id %%P --override "--mode unattended --unattendedmodeui none --superpassword %DBPASS% --port %DBPORT%" --accept-package-agreements --accept-source-agreements
  call :pg_wait
  if not errorlevel 1 (
    echo  PostgreSQL installed and running.
    exit /b 0
  )
  echo  That install did not bring the server up - trying the next option...
)
:pg_manual
echo  ERROR: Automatic PostgreSQL install did not succeed.
echo  Install PostgreSQL manually from https://www.postgresql.org/download/windows/
echo  Use superuser password "%DBPASS%" ^(from .env DATABASE_URL^),
echo  create database "%DBNAME%", then re-run this script.
exit /b 1

:: ══════════════════════════════════════════════════════
:: Subroutine: quick `SELECT 1` through psql.
:: Needs PGBIN + PGPASSWORD set. Returns psql errorlevel.
:: ══════════════════════════════════════════════════════
:db_ping
"%PGBIN%\psql.exe" -h "%DBHOST%" -p "%DBPORT%" -U "%DBUSER%" -d postgres -tAc "SELECT 1" >nul 2>&1
exit /b

:: ══════════════════════════════════════════════════════
:: Subroutine: make sure database %DBNAME% exists.
:: If the .env password is wrong, asks for the real one
:: once and writes it back to .env DATABASE_URL.
:: ══════════════════════════════════════════════════════
:ensure_db
set "PGBIN="
for %%V in (14 15 16 17 18) do (
  if exist "%PROGRAMFILES%\PostgreSQL\%%V\bin\psql.exe" set "PGBIN=%PROGRAMFILES%\PostgreSQL\%%V\bin"
)
if not defined PGBIN (
  echo  NOTE: local PostgreSQL binaries not found - skipping database check.
  echo  Make sure database "%DBNAME%" exists on %DBHOST%:%DBPORT%.
  exit /b 0
)
set "PGPASSWORD=%DBPASS%"
call :db_ping
if not errorlevel 1 goto :db_exists_check
echo  WARNING: the password in .env DATABASE_URL does not match PostgreSQL.
echo  ^(TIP: stick to letters and numbers in the password.^)
set /p DBPASS_NEW="Type the current '%DBUSER%' password for %DBHOST%: "
if "%DBPASS_NEW%"=="" exit /b 1
set "DBPASS=%DBPASS_NEW%"
set "EDU_ENV=%ROOT%\.env"
set "EDU_DBURL=DATABASE_URL="postgresql://%DBUSER%:%DBPASS%@%DBHOST%:%DBPORT%/%DBNAME%?schema=public""
powershell -NoProfile -NonInteractive -Command "$p=$env:EDU_ENV; $n=$env:EDU_DBURL; $out=New-Object System.Collections.Generic.List[string]; foreach($l in ([System.IO.File]::ReadAllLines($p, [System.Text.Encoding]::UTF8))){ if($l -match '^DATABASE_URL='){ $out.Add($n) } else { $out.Add($l) } }; [System.IO.File]::WriteAllLines($p, $out, (New-Object System.Text.UTF8Encoding $false))"
set "PGPASSWORD=%DBPASS%"
call :db_ping
if errorlevel 1 (
  echo  ERROR: that password did not work either. Fix .env DATABASE_URL and re-run.
  exit /b 1
)
echo  .env DATABASE_URL updated.
:db_exists_check
"%PGBIN%\psql.exe" -h "%DBHOST%" -p "%DBPORT%" -U "%DBUSER%" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='%DBNAME%'" > "%TEMP%\educore_dbcheck.txt" 2>&1
set "DBEXISTS="
set /p DBEXISTS=<"%TEMP%\educore_dbcheck.txt"
if "%DBEXISTS: =%"=="1" (
  echo  Database "%DBNAME%" exists.
  del "%TEMP%\educore_dbcheck.txt" >nul 2>&1
  exit /b 0
)
echo  Creating database "%DBNAME%"...
"%PGBIN%\createdb.exe" -h "%DBHOST%" -p "%DBPORT%" -U "%DBUSER%" "%DBNAME%" >nul 2>&1
if errorlevel 1 (
  echo  ERROR: could not create database "%DBNAME%".
  exit /b 1
)
del "%TEMP%\educore_dbcheck.txt" >nul 2>&1
echo  Database "%DBNAME%" created.
exit /b 0
