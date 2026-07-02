@echo off
echo ==========================================
echo   CRM INGETEG SOLUCIONES
echo ==========================================
echo.
echo Iniciando servidor backend (puerto 3001)...
start "CRM Backend" cmd /k "cd /d "%~dp0server" && node server.js"

timeout /t 3 >nul

echo Iniciando aplicacion frontend (puerto 5173)...
start "CRM Frontend" cmd /k "cd /d "%~dp0client" && npm run dev"

timeout /t 4 >nul

echo Abriendo el navegador...
start http://localhost:5173

echo.
echo [OK] CRM INGETEG iniciado correctamente.
echo Backend: http://localhost:3001
echo Frontend: http://localhost:5173
echo.
