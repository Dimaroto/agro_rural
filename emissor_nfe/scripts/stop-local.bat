@echo off
setlocal EnableExtensions EnableDelayedExpansion
REM Para o PHP do emissor Agro Rural (porta 8001) sem afetar outros PHP do PC.
set "EMISSOR_PORT=8001"
set "EMISSOR_ROOT=%~dp0.."
cd /d "%EMISSOR_ROOT%"
set "EMISSOR_ROOT=%CD%"
set "PORTABLE_PHP=%EMISSOR_ROOT%\runtime\php\php.exe"

set "LOGDIR=%LOCALAPPDATA%\Agro Rural Zortea\emissor\logs"
if not exist "%LOGDIR%" mkdir "%LOGDIR%" >nul 2>&1
set "LOG=%LOGDIR%\emissor-stop.log"
>>"%LOG%" echo ===== %DATE% %TIME% stop =====

REM Mata PIDs em LISTENING na porta 8001
for /f "tokens=5" %%P in ('netstat -ano 2^>nul ^| findstr ":!EMISSOR_PORT!" ^| findstr "LISTENING"') do (
  >>"%LOG%" echo taskkill porta !EMISSOR_PORT! PID=%%P
  taskkill /F /PID %%P >nul 2>&1
)

REM Mata php.exe cujo caminho e o PHP portatil deste emissor
if exist "%PORTABLE_PHP%" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$php='%~dp0..\runtime\php\php.exe'; $full=(Resolve-Path -LiteralPath $php -ErrorAction SilentlyContinue).Path; if(-not $full){exit 0}; Get-CimInstance Win32_Process -Filter \"Name='php.exe'\" -ErrorAction SilentlyContinue | Where-Object { $_.ExecutablePath -and ($_.ExecutablePath -ieq $full) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
)

exit /b 0
