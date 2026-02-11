@echo off
chcp 65001 >nul 2>&1
title Help Editor

:: Проверяем что зависимости установлены
if not exist "node_modules" (
    echo Зависимости не установлены. Запускаю установку...
    echo.
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo.
        echo [ОШИБКА] Не удалось установить зависимости.
        pause
        exit /b 1
    )
    echo.
)

echo ============================================
echo         Help Editor
echo ============================================
echo.
echo Запуск сервера...
echo Браузер откроется автоматически.
echo.
echo Для остановки закройте это окно
echo или нажмите Ctrl+C
echo ============================================
echo.

node cli.js
