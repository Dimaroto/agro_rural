@echo off
setlocal EnableExtensions
REM Protocolo agro-emissor:// registrado pelo instalador.
REM Uso: protocol-handler.bat "agro-emissor://start" | "agro-emissor://config" | "agro-emissor://config?tab=certificado"

set "RAW=%~1"
if "%RAW%"=="" set "RAW=agro-emissor://start"

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%.."

echo %RAW% | findstr /I /C:"config" >nul
if not errorlevel 1 goto CONFIG

REM start (padrao)
if exist "%SCRIPT_DIR%start-local-hidden.vbs" (
  wscript.exe //nologo "%SCRIPT_DIR%start-local-hidden.vbs"
  exit /b 0
)
if exist "%SCRIPT_DIR%start-local.bat" (
  set "AGRO_EMISSOR_HIDDEN=1"
  start "" /MIN cmd /c "%SCRIPT_DIR%start-local.bat"
  exit /b 0
)
exit /b 1

:CONFIG
set "TAB="
echo %RAW% | findstr /I /C:"tab=certificado" >nul
if not errorlevel 1 set "TAB=?tab=certificado"
echo %RAW% | findstr /I /C:"tab=numeracao" >nul
if not errorlevel 1 set "TAB=?tab=numeracao"
echo %RAW% | findstr /I /C:"tab=integracao" >nul
if not errorlevel 1 set "TAB=?tab=integracao"
echo %RAW% | findstr /I /C:"tab=empresa" >nul
if not errorlevel 1 set "TAB=?tab=empresa"

start "" "http://127.0.0.1:8001/configuracoes%TAB%"
exit /b 0
