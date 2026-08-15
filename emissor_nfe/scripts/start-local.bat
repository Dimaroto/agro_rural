@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Emissor NFe

set "LOGDIR=%LOCALAPPDATA%\Agro Rural Zortea\emissor\logs"
if not exist "%LOGDIR%" mkdir "%LOGDIR%" >nul 2>&1
set "LOG=%LOGDIR%\emissor-start.log"
>>"%LOG%" echo ===== %DATE% %TIME% =====
>>"%LOG%" echo cwd=%CD%

cd /d "%~dp0.."
set "EMISSOR_ROOT=%CD%"

REM Se ja ha servidor na 8000, nao reinicia (evita lock no log / CMD extra)
set "ALREADY="
for /f "tokens=5" %%P in ('netstat -ano 2^>nul ^| findstr ":8000" ^| findstr "LISTENING"') do (
  set "ALREADY=%%P"
)
if defined ALREADY (
  >>"%LOG%" echo Porta 8000 ja LISTENING PID=!ALREADY! — saindo sem restart
  if /I "%AGRO_EMISSOR_HIDDEN%"=="1" exit /b 0
  echo Emissor ja esta rodando em http://127.0.0.1:8000
  exit /b 0
)

REM 1) PHP portatil embutido (preferido)
set "PHP="
set "PHPDIR="
if exist "%EMISSOR_ROOT%\runtime\php\php.exe" (
  set "PHP=%EMISSOR_ROOT%\runtime\php\php.exe"
  set "PHPDIR=%EMISSOR_ROOT%\runtime\php"
  >>"%LOG%" echo Usando PHP portatil: !PHP!
)

if not defined PHP call :FindPhpSystem
if not defined PHP (
  >>"%LOG%" echo PHP nao encontrado. Tentando ensure-php / prepare...
  if exist "%~dp0prepare-portable-php.ps1" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0prepare-portable-php.ps1" >>"%LOG%" 2>&1
  )
  if exist "%EMISSOR_ROOT%\runtime\php\php.exe" (
    set "PHP=%EMISSOR_ROOT%\runtime\php\php.exe"
    set "PHPDIR=%EMISSOR_ROOT%\runtime\php"
  )
)
if not defined PHP (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ensure-php.ps1" >>"%LOG%" 2>&1
  call :FindPhpSystem
)
if not defined PHP (
  >>"%LOG%" echo [ERRO] PHP nao encontrado.
  echo PHP nao encontrado.
  if /I "%AGRO_EMISSOR_HIDDEN%"=="1" exit /b 1
  pause
  exit /b 1
)

>>"%LOG%" echo PHP=!PHP!
set "OPENSSL_CONF=%EMISSOR_ROOT%\openssl-legacy.cnf"
if exist "%PHPDIR%\extras\ssl" set "OPENSSL_MODULES=%PHPDIR%\extras\ssl"
set "Path=%PHPDIR%;%Path%"

REM Temp gravavel (NFePHP cria sped-*/certs aqui) — evita mkdir Permission denied
set "MB_TMP=%LOCALAPPDATA%\Agro Rural Zortea\emissor\tmp"
if not exist "%MB_TMP%" mkdir "%MB_TMP%" >nul 2>&1
set "TMP=%MB_TMP%"
set "TEMP=%MB_TMP%"
set "TMPDIR=%MB_TMP%"
>>"%LOG%" echo TMP=!TMP!

set "SECRETS_DIR=%LOCALAPPDATA%\Agro Rural Zortea\emissor\config"
if exist "%SECRETS_DIR%\.env" (
  copy /Y "%SECRETS_DIR%\.env" "%EMISSOR_ROOT%\.env" >nul
  if exist "%SECRETS_DIR%\.agro_token.txt" copy /Y "%SECRETS_DIR%\.agro_token.txt" "%EMISSOR_ROOT%\.agro_token.txt" >nul
)

if not exist "%EMISSOR_ROOT%\.env" (
  >>"%LOG%" echo [ERRO] .env ausente
  echo .env nao encontrado. Rode o bootstrap da instalacao.
  if /I "%AGRO_EMISSOR_HIDDEN%"=="1" exit /b 1
  pause
  exit /b 1
)

if not exist "%EMISSOR_ROOT%\vendor\autoload.php" (
  >>"%LOG%" echo [ERRO] vendor ausente
  echo vendor ausente.
  if /I "%AGRO_EMISSOR_HIDDEN%"=="1" exit /b 1
  pause
  exit /b 1
)

REM PHP portatil: php.ini ao lado do php.exe. Sistema: gera php-emissor.ini
REM Limpa PHPRC herdado (ini antigo do WinGet quebra extensões / path com acento).
set "PHPRC="
if /I "!PHPDIR!"=="!EMISSOR_ROOT!\runtime\php" (
  >>"%LOG%" echo PHP portatil - php.ini embutido
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0configure-php.ps1" >>"%LOG%" 2>&1
  if errorlevel 1 (
    >>"%LOG%" echo [ERRO] configure-php falhou
    if /I "%AGRO_EMISSOR_HIDDEN%"=="1" exit /b 1
    pause
    exit /b 1
  )
  if exist "%EMISSOR_ROOT%\php-emissor.ini" set "PHPRC=%EMISSOR_ROOT%\php-emissor.ini"
)

set "PDOCHK=%~dp0check-pdo-pgsql.php"
if not exist "%PDOCHK%" (
  >>"%LOG%" echo [ERRO] check-pdo-pgsql.php ausente
  echo check-pdo-pgsql.php ausente.
  if /I "%AGRO_EMISSOR_HIDDEN%"=="1" exit /b 1
  pause
  exit /b 1
)

if defined PHPRC (
  "%PHP%" -c "%PHPRC%" "%PDOCHK%"
) else (
  "%PHP%" "%PDOCHK%"
)
set "PDO_RC=!ERRORLEVEL!"
if not "!PDO_RC!"=="0" (
  >>"%LOG%" echo [ERRO] PDO sem pgsql
  echo ERRO: could not find driver ^(pgsql^). Log: %LOG%
  if /I "%AGRO_EMISSOR_HIDDEN%"=="1" exit /b 1
  pause
  exit /b 1
)

REM Pastas Laravel gravaveis (evita mkdir Permission denied)
if exist "%~dp0ensure-storage.ps1" (
  >>"%LOG%" echo ensure-storage ...
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ensure-storage.ps1" >>"%LOG%" 2>&1
)

REM Token Sanctum para o Flutter (evita Unauthenticated)
if exist "%~dp0ensure-agro-token.php" (
  >>"%LOG%" echo ensure-agro-token ...
  if defined PHPRC (
    "%PHP%" -c "%PHPRC%" "%~dp0ensure-agro-token.php" >>"%LOG%" 2>&1
  ) else (
    "%PHP%" "%~dp0ensure-agro-token.php" >>"%LOG%" 2>&1
  )
)

REM Nao usar "artisan serve": no Windows com usuario acentuado (ex.: Camara),
REM PHP_BINARY sai com encoding quebrado e o processo filho do Symfony morre (exit 1).
REM php -S com o path do .bat preserva o caminho correto.
set "ROUTER=%EMISSOR_ROOT%\server.php"
if not exist "!ROUTER!" set "ROUTER=%EMISSOR_ROOT%\vendor\laravel\framework\src\Illuminate\Foundation\resources\server.php"
if not exist "!ROUTER!" (
  >>"%LOG%" echo [ERRO] server.php router ausente
  echo server.php ausente.
  if /I "%AGRO_EMISSOR_HIDDEN%"=="1" exit /b 1
  pause
  exit /b 1
)

>>"%LOG%" echo Iniciando php -S 127.0.0.1:8000 router=!ROUTER!
cd /d "%EMISSOR_ROOT%\public"
if defined PHPRC (
  if /I "%AGRO_EMISSOR_HIDDEN%"=="1" (
    "%PHP%" -c "%PHPRC%" -S 127.0.0.1:8000 "!ROUTER!" >>"%LOG%" 2>&1
  ) else (
    "%PHP%" -c "%PHPRC%" -S 127.0.0.1:8000 "!ROUTER!"
  )
) else (
  if /I "%AGRO_EMISSOR_HIDDEN%"=="1" (
    "%PHP%" -S 127.0.0.1:8000 "!ROUTER!" >>"%LOG%" 2>&1
  ) else (
    "%PHP%" -S 127.0.0.1:8000 "!ROUTER!"
  )
)
set "RC=!ERRORLEVEL!"
>>"%LOG%" echo php-S exit=!RC!
if /I "%AGRO_EMISSOR_HIDDEN%"=="1" exit /b !RC!
if not "!RC!"=="0" pause
exit /b !RC!

:FindPhpSystem
set "PHP="
set "PHPDIR="
for /d %%D in ("%LOCALAPPDATA%\Microsoft\WinGet\Packages\PHP.PHP.8.4_*") do (
  if exist "%%D\php.exe" (
    set "PHPDIR=%%D"
    set "PHP=%%D\php.exe"
    goto :eof
  )
)
for /d %%D in ("%LOCALAPPDATA%\Microsoft\WinGet\Packages\PHP.PHP.NTS.8.4_*") do (
  if exist "%%D\php.exe" (
    set "PHPDIR=%%D"
    set "PHP=%%D\php.exe"
    goto :eof
  )
)
for /d %%D in ("%LOCALAPPDATA%\Microsoft\WinGet\Packages\PHP.PHP.8.3_*") do (
  if exist "%%D\php.exe" (
    set "PHPDIR=%%D"
    set "PHP=%%D\php.exe"
    goto :eof
  )
)
where php >nul 2>&1
if errorlevel 1 goto :eof
for /f "delims=" %%P in ('where php') do (
  set "PHP=%%P"
  for %%I in ("%%P") do set "PHPDIR=%%~dpI"
  if defined PHPDIR if "!PHPDIR:~-1!"=="\" set "PHPDIR=!PHPDIR:~0,-1!"
  goto :eof
)
goto :eof
