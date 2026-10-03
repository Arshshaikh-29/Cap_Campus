@echo off
cd /d "%~dp0"
start "CAP Compass API" cmd /k "py -m pip install -r backend\requirements.txt && py -m uvicorn backend.api.main:app --reload --host 127.0.0.1 --port 8000"
timeout /t 4 /nobreak >nul
start "CAP Compass Frontend" cmd /k "cd /d frontend && if not exist node_modules npm install && npm run dev"
echo Started API and frontend in separate windows.
echo Frontend: http://localhost:3000
 echo API docs: http://127.0.0.1:8000/docs
pause
