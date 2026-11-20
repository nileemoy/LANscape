Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "        Starting LANscape Platform        " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Start Backend in a separate window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; Write-Host '--- LANscape Backend (FastAPI) ---' -ForegroundColor Cyan; & '.\.venv\Scripts\python.exe' -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"

# Start Frontend in a separate window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; Write-Host '--- LANscape Frontend (Vite) ---' -ForegroundColor Cyan; npm run dev"

Write-Host "`nBoth services are starting!" -ForegroundColor Green
Write-Host "• Frontend UI:    http://localhost:3000" -ForegroundColor White
Write-Host "• Backend API:   http://127.0.0.1:8000/docs`n" -ForegroundColor White
