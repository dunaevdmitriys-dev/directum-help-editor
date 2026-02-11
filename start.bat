@echo off
title Help Editor

echo ============================================
echo         Help Editor
echo ============================================
echo.

where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js not found!
    echo.
    echo Download Node.js LTS from https://nodejs.org/
    echo Install it, then RESTART your computer.
    echo Then run this file again.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do echo Node.js: %%i
echo.

if not exist "node_modules" (
    echo Installing dependencies, please wait...
    echo.
    call npm install --omit=dev
    if %ERRORLEVEL% neq 0 (
        echo.
        echo [ERROR] npm install failed.
        echo Check your internet connection.
        echo.
        pause
        exit /b 1
    )
    echo.
)

echo Starting server...
echo Browser will open automatically.
echo Close this window to stop.
echo ============================================
echo.

node cli.js

echo.
echo ============================================
echo Server stopped.
echo ============================================
pause
