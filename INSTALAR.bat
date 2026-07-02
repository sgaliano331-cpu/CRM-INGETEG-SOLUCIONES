@echo off
echo ==========================================
echo   CRM INGETEG SOLUCIONES - Instalador
echo ==========================================
echo.

REM Verificar Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no esta instalado.
    echo Descargalo desde: https://nodejs.org/en/download
    echo Instala la version LTS (recomendada).
    pause
    exit /b 1
)

echo [OK] Node.js encontrado.
echo.

REM === BACKEND ===
echo [1/4] Instalando dependencias del servidor (backend)...
cd /d "%~dp0server"
call npm install
if %errorlevel% neq 0 (echo [ERROR] Fallo npm install en server && pause && exit /b 1)

echo [2/4] Creando usuarios iniciales en la base de datos...
call node seed.js
echo.

REM === FRONTEND ===
echo [3/4] Creando proyecto React (puede tardar unos minutos)...
cd /d "%~dp0"
call npm create vite@latest client -- --template react

echo [4/4] Instalando dependencias del frontend...
cd /d "%~dp0client"
call npm install
call npm install react-router-dom axios recharts date-fns
call npm install -D tailwindcss@3 postcss autoprefixer
call npx tailwindcss init -p

echo.
echo ==========================================
echo   Instalacion completada exitosamente!
echo ==========================================
echo.
echo Para INICIAR el sistema, ejecuta: INICIAR_CRM.bat
echo.
pause
