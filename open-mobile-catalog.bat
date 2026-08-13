@echo off
setlocal
cd /d "%~dp0"

REM Atualiza PATH com o ADB instalado pelo winget
for /f "tokens=2*" %%a in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "USER_PATH=%%b"
for /f "tokens=2*" %%a in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "MACHINE_PATH=%%b"
set "PATH=%MACHINE_PATH%;%USER_PATH%"

echo.
echo === SaboArt - Abrir catalogo no celular (USB) ===
echo.

adb version >nul 2>&1
if errorlevel 1 (
  echo [ERRO] ADB nao encontrado. Instale com:
  echo   winget install Google.PlatformTools
  exit /b 1
)

echo Verificando celular conectado...
adb devices
echo.

for /f "skip=1 tokens=1" %%d in ('adb devices ^| findstr /r "device$"') do set "DEVICE=%%d"

if not defined DEVICE (
  echo [AVISO] Nenhum celular detectado via USB.
  echo.
  echo No Android:
  echo   1. Configuracoes ^> Sobre o telefone ^> toque 7x em "Numero da versao"
  echo   2. Configuracoes ^> Opcoes do desenvolvedor ^> Depuracao USB = ATIVADA
  echo   3. Conecte o cabo USB e aceite "Permitir depuracao USB" no celular
  echo   4. Execute este script novamente
  echo.
  pause
  exit /b 1
)

echo Celular detectado: %DEVICE%
echo Configurando tunel USB (localhost:3000 no celular -^> PC)...
adb reverse tcp:3000 tcp:3000
if errorlevel 1 (
  echo [ERRO] Falha ao criar tunel. Tente desconectar e reconectar o cabo.
  pause
  exit /b 1
)

echo Abrindo catalogo no navegador do celular...
adb shell am start -a android.intent.action.VIEW -d "http://localhost:3000/s/saboart"
if errorlevel 1 (
  echo [ERRO] Nao foi possivel abrir o link. Verifique se o servidor esta rodando: npm run dev
  pause
  exit /b 1
)

echo.
echo Pronto! O catalogo deve ter aberto no celular.
echo Certifique-se de que o servidor esta rodando: npm run dev
echo.
pause
