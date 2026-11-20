@echo off
echo ==========================================
echo         Starting LANscape Platform         
echo ==========================================

start "LANscape Backend (FastAPI)" cmd /k "cd /d %~dp0backend && echo Starting Backend... && .venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"

start "LANscape Frontend (Vite)" cmd /k "cd /d %~dp0frontend && echo Starting Frontend... && npm run dev"

echo.
echo Both services launched in separate windows!
echo - Frontend UI:   http://localhost:3000
echo - Backend API:  http://127.0.0.1:8000/docs
echo.
pause
