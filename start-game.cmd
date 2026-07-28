@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Please install Node.js 22 or newer.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing game dependencies for the first launch...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo Dependency installation failed.
    pause
    exit /b 1
  )
)

echo Checking the local Hearthstone card-art cache...
call npm run assets:sync -- --startup
if errorlevel 1 (
  echo Some card art could not be cached. The game will use online images or a text fallback.
)

start "" powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 3; Start-Process 'http://localhost:3000/'"
echo Starting Classic Battlegrounds at http://localhost:3000/
echo Press Ctrl+C to stop the game.
call npm run dev

endlocal
