@echo off
title EduCore — Create ZIP
color 0B

set ROOT=C:\work\erp\Educore-main
set ZIPFILE=C:\work\erp\EduCore-source.zip

echo.
echo  Creating EduCore source ZIP (excluding node_modules, .next, dist^)...
echo  Output: %ZIPFILE%
echo.

:: Remove old zip if exists
if exist "%ZIPFILE%" del /f /q "%ZIPFILE%"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Add-Type -Assembly 'System.IO.Compression.FileSystem';" ^
  "$src  = '%ROOT%';" ^
  "$dest = '%ZIPFILE%';" ^
  "$exclude = @('node_modules','.next','dist','.git','*.log','npm-debug*');" ^
  "$zip = [System.IO.Compression.ZipFile]::Open($dest, 'Create');" ^
  "$base = [System.IO.DirectoryInfo]::new($src);" ^
  "Get-ChildItem -Path $src -Recurse -File | Where-Object {" ^
  "  $rel = $_.FullName.Substring($src.Length + 1);" ^
  "  $parts = $rel -split '\\';" ^
  "  -not ($parts | Where-Object { $exclude -contains $_ })" ^
  "} | ForEach-Object {" ^
  "  $rel = $_.FullName.Substring($src.Length + 1);" ^
  "  [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, 'EduCore\' + $rel, 'Optimal') | Out-Null;" ^
  "  Write-Host ('  + ' + $rel);" ^
  "};" ^
  "$zip.Dispose();" ^
  "Write-Host '';" ^
  "Write-Host ' ZIP created: %ZIPFILE%';"

if errorlevel 1 (
  echo.
  echo  ERROR: ZIP creation failed.
) else (
  echo.
  echo  =====================================================
  echo    Done!  EduCore-source.zip is ready at:
  echo    %ZIPFILE%
  echo.
  echo    Recipient must run after unzipping:
  echo      npm install
  echo      (then set up .env and run educore-setup.bat^)
  echo  =====================================================
)
echo.
pause
