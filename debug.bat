@echo off
chcp 65001 >nul
cd /d "%~dp0"

if exist "%~dp0ffmpeg\ffmpeg.exe" set "PATH=%~dp0ffmpeg;%PATH%"

if not exist "%~dp0node_modules" (
    echo Dependencias nao encontradas. Execute instalar.bat primeiro.
    pause
    exit /b 1
)

echo Verificando yt-dlp...
python -c "import yt_dlp; print('yt-dlp ok')"
if errorlevel 1 (
    echo Instalando yt-dlp...
    python -m pip install yt-dlp
)

echo Testando servidor...
python "%~dp0backend\server.py"
