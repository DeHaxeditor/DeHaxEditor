@echo off
setlocal
cd /d "%~dp0"

where py >nul 2>nul
if %errorlevel%==0 (
  start "DeHax Demo Server" cmd /k "cd /d ""%~dp0"" && py -m http.server 8765"
) else (
  where python >nul 2>nul
  if %errorlevel%==0 (
    start "DeHax Demo Server" cmd /k "cd /d ""%~dp0"" && python -m http.server 8765"
  ) else (
    echo Python nao foi encontrado neste computador.
    echo Instale o Python ou inicie o servidor manualmente.
    pause
    exit /b 1
  )
)

timeout /t 2 /nobreak >nul
start "" "http://localhost:8765/entrar/"
endlocal
