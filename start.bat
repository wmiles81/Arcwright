@echo off
REM Arcwright launcher - Windows
REM Double-click to install dependencies (first run only) and start the app.

setlocal
cd /d "%~dp0"

echo --- Arcwright -----------------------------------------------------
echo Working directory: %CD%
echo.

REM --- Node.js check ---
where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js is not installed.
  echo Install Node.js v18 or later from https://nodejs.org
  echo Then double-click this file again.
  echo.
  pause
  exit /b 1
)

for /f "tokens=1 delims=." %%a in ('node -v') do set NODE_VER=%%a
set NODE_VER=%NODE_VER:v=%

if %NODE_VER% LSS 18 (
  echo ERROR: Arcwright requires Node.js v18 or later.
  for /f %%v in ('node -v') do echo You have: %%v
  echo Update from https://nodejs.org
  echo.
  pause
  exit /b 1
)

for /f %%v in ('node -v') do echo Node.js: %%v OK

REM --- Install deps if needed ---
if not exist node_modules (
  echo.
  echo First-time setup - installing dependencies.
  echo This will take 1-2 minutes and uses about 500 MB of disk space.
  echo.
  call npm install --production
  if errorlevel 1 (
    echo.
    echo Install failed. Check the messages above.
    pause
    exit /b 1
  )
  echo.
  echo Setup complete.
)

echo.
echo Starting Arcwright on http://localhost:3000
echo --- KEEP THIS WINDOW OPEN while using the app --------------------
echo.

REM Open the browser shortly after the server starts.
start "" "" /b cmd /c "timeout /t 2 /nobreak >nul && start "" http://localhost:3000"

call npm start
pause
