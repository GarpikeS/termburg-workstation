@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Термбург - Расписание

where node >nul 2>nul
if errorlevel 1 (
  echo Не найден Node.js. Установите Node.js LTS и запустите файл снова.
  pause
  exit /b 1
)

if not exist "frontend\build\index.html" (
  echo Первая сборка приложения...
  if not exist "frontend\node_modules\.bin\vite.cmd" (
    call npm --prefix frontend install
    if errorlevel 1 (
      echo Не удалось установить зависимости.
      pause
      exit /b 1
    )
  )
  call npm --prefix frontend run build
  if errorlevel 1 (
    echo Сборка не удалась. Скопируйте текст ошибки разработчику.
    pause
    exit /b 1
  )
)

start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:4174/schedule/admin"
node server\schedule-server.mjs
