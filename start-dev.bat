@echo off
cd /d "%~dp0"
echo Diretorio: %CD%
if not exist node_modules (
  echo Instalando dependencias...
  call npm install
  if errorlevel 1 exit /b 1
)
if not exist prisma\dev.db (
  echo Configurando banco...
  call npm run db:push
  call npm run db:seed
  if errorlevel 1 exit /b 1
)
start http://localhost:3000/s/saboart
echo Iniciando servidor em http://localhost:3000/s/saboart
call npm run dev
