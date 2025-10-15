@echo off
echo Starting Shop Dashboard...
echo.

REM Start the backend server in a new window
start "Shop Dashboard - Server" cmd /k "cd /d %~dp0 && node server.js"

REM Wait 2 seconds for server to start
timeout /t 2 /nobreak >nul

REM Start the React frontend in a new window
start "Shop Dashboard - Frontend" cmd /k "cd /d %~dp0 && npm start"

echo.
echo Dashboard is starting!
echo Server window and Frontend window should now be open.
echo.
echo To stop the dashboard, close both windows.
echo.
pause