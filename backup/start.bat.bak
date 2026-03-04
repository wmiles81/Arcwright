@echo off
cd /d "%~dp0"

if not exist "node_modules" (
  echo Installing dependencies...
  call npm install
)

echo Starting Narrative Context Graph...
call npm run dev
pause
