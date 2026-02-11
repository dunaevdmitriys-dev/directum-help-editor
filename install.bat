@echo off
title Help Editor - Install

echo ============================================
echo       Help Editor - Install
echo ============================================
echo.

where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js not found!
    echo.
    echo Download Node.js LTS from https://nodejs.org/
    echo Install it, then RESTART your computer.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do echo Node.js: %%i
echo.

echo Installing dependencies (npm install)...
echo This may take 1-2 minutes...
echo.
call npm install
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] npm install failed.
    echo Check your internet connection.
    pause
    exit /b 1
)

echo.
echo ============================================
echo    Install complete!
echo ============================================
echo.
echo To start: run start.bat
echo.
pause
