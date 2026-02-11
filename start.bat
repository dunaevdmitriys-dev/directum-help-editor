@echo off
chcp 65001 >nul 2>&1
title Help Editor

echo ============================================
echo         Help Editor
echo ============================================
echo.

:: Проверяем Node.js
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ОШИБКА] Node.js не найден!
    echo.
    echo 1. Скачайте Node.js LTS с https://nodejs.org/
    echo 2. Установите (Next - Next - Finish)
    echo 3. ПЕРЕЗАГРУЗИТЕ компьютер
    echo 4. Запустите этот файл снова
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do echo Node.js: %%i
echo.

:: Проверяем что зависимости установлены
if not exist "node_modules" (
    echo Первый запуск: установка зависимостей...
    echo Это займет 1-2 минуты, подождите...
    echo.
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo.
        echo [ОШИБКА] Не удалось установить зависимости.
        echo Проверьте подключение к интернету.
        echo.
        pause
        exit /b 1
    )
    echo.
    echo Зависимости установлены!
    echo.
)

echo Запуск сервера...
echo Браузер откроется автоматически.
echo.
echo Для остановки закройте это окно
echo или нажмите Ctrl+C
echo ============================================
echo.

node cli.js

echo.
echo ============================================
echo Сервер остановлен.
echo ============================================
pause
