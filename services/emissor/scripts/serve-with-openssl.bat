@echo off
setlocal
title Emissor NFe OpenSSL

set "PHPDIR=%LOCALAPPDATA%\Microsoft\WinGet\Packages\PHP.PHP.8.4_Microsoft.Winget.Source_8wekyb3d8bbwe"
if not exist "%PHPDIR%\php.exe" (
  for /d %%D in ("%LOCALAPPDATA%\Microsoft\WinGet\Packages\PHP.PHP.8.4_*") do (
    if exist "%%D\php.exe" set "PHPDIR=%%D"
  )
)

set "PHP=%PHPDIR%\php.exe"
if not exist "%PHP%" (
  echo PHP nao encontrado
  pause
  exit /b 1
)

cd /d "%~dp0.."
set "OPENSSL_CONF=%CD%\openssl-legacy.cnf"
set "OPENSSL_MODULES=%PHPDIR%\extras\ssl"
set "Path=%PHPDIR%;%Path%"

echo OPENSSL_CONF=%OPENSSL_CONF%
echo OPENSSL_MODULES=%OPENSSL_MODULES%
echo.
"%PHP%" artisan serve --host=127.0.0.1 --port=8000
