@echo off
setlocal EnableExtensions
cd /d "%~dp0.."
set "ID=%~1"
if "%ID%"=="" set "ID=1"
set "PHP=%CD%\runtime\php\php.exe"
if not exist "%PHP%" set "PHP=php"
echo Vinculando empresa id=%ID% ...
"%PHP%" "%CD%\scripts\usar-empresa.php" %ID%
if errorlevel 1 pause
exit /b %ERRORLEVEL%
