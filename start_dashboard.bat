@echo off
title Fitbit Air Dashboard Launcher
echo =====================================================================
echo                Fitbit Air Physiological Dashboard                    
echo =====================================================================
echo.

:: 1. Verify Python Installation
python --version >nul 2>&1
if errorlevel 1 goto PythonError

:: 2. Verify Node.js/npm Installation
:: NOTE: npm is a batch file on Windows (npm.cmd), so we must prefix it with CALL
:: otherwise cmd.exe will hand over execution and exit the launcher script immediately!
call npm --version >nul 2>&1
if errorlevel 1 goto NpmError

:: 3. Setup Python Backend Virtual Environment
echo [1/3] Setting up Python virtual environment...
if exist "google-health-service\venv\Scripts\activate.bat" goto VenvReady
echo Creating virtual environment in google-health-service\venv...
python -m venv google-health-service\venv
if errorlevel 1 goto VenvError

:VenvReady
echo [OK] Python virtual environment ready.
echo.

:: 4. Install Backend Dependencies
echo [2/3] Checking backend dependencies...
call google-health-service\venv\Scripts\activate.bat
pip install -r google-health-service\requirements.txt
if errorlevel 1 goto PipError
echo [OK] Backend dependencies satisfied.
echo.

:: 5. Install Frontend Dependencies
echo [3/3] Checking frontend dependencies...
if exist "health-dashboard\node_modules" goto NodeModulesReady
echo Installing Next.js dependencies (this may take a minute)...
cd health-dashboard
call npm install
if errorlevel 1 goto NpmInstallError
cd ..
goto NodeModulesReady

:NodeModulesReady
echo [OK] Frontend dependencies ready.
echo.

:: 6. Launch Backend in a separate window
echo Launching Google Health API Gateway (FastAPI) on port 8000...
start "Fitbit Air Backend" cmd /c "cd google-health-service && venv\Scripts\activate && uvicorn main:app --port 8000"

:: 7. Open Browser
echo Opening dashboard in your browser...
start http://localhost:3000

:: 8. Launch Frontend in current window
echo Launching Next.js frontend on port 3000...
cd health-dashboard
call npm run dev
cd ..
exit /b 0


:PythonError
echo [ERROR] Python is not installed or not in your system PATH.
echo Please install Python 3.11+ from python.org and check "Add Python to PATH".
echo.
pause
exit /b 1

:NpmError
echo [ERROR] Node.js/npm is not installed or not in your system PATH.
echo Please install Node.js (LTS version) from nodejs.org.
echo.
pause
exit /b 1

:VenvError
echo [ERROR] Failed to create virtual environment.
echo.
pause
exit /b 1

:PipError
echo [ERROR] Failed to install backend dependencies.
echo.
pause
exit /b 1

:NpmInstallError
echo [ERROR] Failed to install frontend npm dependencies.
echo.
cd ..
pause
exit /b 1
