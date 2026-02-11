@echo off
chcp 65001 >nul 2>&1
title Help Editor - Установка

echo ============================================
echo         Help Editor - Установка
echo ============================================
echo.

:: Проверяем Node.js
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ОШИБКА] Node.js не найден!
    echo.
    echo Скачайте и установите Node.js с сайта:
    echo https://nodejs.org/
    echo.
    echo После установки перезапустите этот файл.
    echo.
    pause
    exit /b 1
)

:: Показываем версию
for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo Node.js: %NODE_VER%
echo.

:: Устанавливаем зависимости
echo Установка зависимостей (npm install)...
echo Это может занять 1-2 минуты...
echo.
call npm install
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ОШИБКА] Не удалось установить зависимости.
    echo Проверьте подключение к интернету.
    pause
    exit /b 1
)

echo.
echo ============================================
echo    Установка завершена успешно!
echo ============================================
echo.
echo Для запуска используйте файл: start.bat
echo.
pause
