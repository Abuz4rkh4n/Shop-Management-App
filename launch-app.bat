@echo off
echo Starting Shop Management Application...
echo =====================================

:: Set environment variables
set NODE_ENV=development
set PORT=3001
set VITE_API_URL=http://localhost:3001

:: Start backend in a new command window
start "Backend" cmd /k "cd /d "%~dp0backend" && npm start"

:: Give backend a moment to start
timeout /t 5 /nobreak >nul

:: Start frontend in a new command window
start "Frontend" cmd /k "cd /d "%~dp0" && npm run dev"

:: Open the application in the default browser
timeout /t 2 /nobreak >nul
start http://localhost:5173

echo.
echo Application is starting...
echo - Backend: http://localhost:3001
echo - Frontend: http://localhost:5173
echo.
echo Press any key to close all windows...
pause >nul

taskkill /f /im node.exe >nul 2>&1
taskkill /f /im cmd.exe /fi "WINDOWTITLE eq Backend*" >nul 2>&1
taskkill /f /im cmd.exe /fi "WINDOWTITLE eq Frontend*" >nul 2>&1
exit
