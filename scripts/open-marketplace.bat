@echo off
setlocal EnableExtensions
title The Official Robot
cd /d "%~dp0.."

set "PATH=%ProgramFiles%\nodejs;%PATH%"
set "ROOT=%cd%"
set "URL=http://127.0.0.1:5173/"

echo Starting The Official Robot marketplace...
echo.

call :port_up 3001
if errorlevel 1 (
  echo Starting API on port 3001...
  start "Official Robot API" /min cmd /c "cd /d %ROOT% && node server\index.js"
) else (
  echo API already running.
)

call :port_up 5173
if errorlevel 1 (
  echo Starting marketplace on port 5173...
  start "Official Robot Marketplace" /min cmd /c "cd /d %ROOT% && npm.cmd run dev --prefix client"
) else (
  echo Marketplace already running.
)

echo Waiting for http://127.0.0.1:5173/ ...
set /a tries=0
:wait
set /a tries+=1
curl.exe -s -o NUL -m 2 http://127.0.0.1:5173/ && goto open
if %tries% GEQ 40 (
  echo Could not reach the marketplace. Check the "Official Robot API" and "Official Robot Marketplace" windows.
  pause
  exit /b 1
)
timeout /t 1 /nobreak >NUL
goto wait

:open
start "" "%URL%"
exit /b 0

:port_up
curl.exe -s -o NUL -m 1 "http://127.0.0.1:%~1/"
if errorlevel 1 exit /b 1
exit /b 0
