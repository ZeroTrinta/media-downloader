@echo off
chcp 65001 >nul
cd /d "%~dp0"

REM Adiciona ffmpeg local ao PATH se existir
if exist "%~dp0ffmpeg\ffmpeg.exe" set "PATH=%~dp0ffmpeg;%PATH%"

REM Verifica se as dependencias estao instaladas
if not exist "%~dp0node_modules" (
    echo Dependencias nao encontradas. Execute instalar.bat primeiro.
    pause
    exit /b 1
)

start "" npx electron .
