@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
cd /d "%~dp0"

echo.
echo  Media Downloader - Instalador
echo  ==============================
echo.

net session >nul 2>&1
if errorlevel 1 (
    echo Solicitando permissao de administrador...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

set "TMP=%~dp0_tmp"
if not exist "%TMP%" mkdir "%TMP%"

REM --- Adiciona caminhos comuns ao PATH ---
set "PATH=%PATH%;C:\Program Files\nodejs;%APPDATA%\npm"
set "PATH=%PATH%;%LOCALAPPDATA%\Programs\Python\Python314"
set "PATH=%PATH%;%LOCALAPPDATA%\Programs\Python\Python313"
set "PATH=%PATH%;%LOCALAPPDATA%\Programs\Python\Python312"
set "PATH=%PATH%;%LOCALAPPDATA%\Programs\Python\Python311"
set "PATH=%PATH%;C:\Python314;C:\Python313;C:\Python312;C:\Python311"

echo [1/4] Verificando Node.js...
node --version >nul 2>&1
if not errorlevel 1 (
    for /f "tokens=*" %%v in ('node --version') do echo [OK] Node.js %%v
    goto python
)
echo [..] Baixando Node.js...
powershell -Command "$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.11.1/node-v20.11.1-x64.msi' -OutFile '%TMP%\node.msi'"
if not exist "%TMP%\node.msi" ( echo [ERRO] Falha ao baixar Node.js & goto erro )
echo [..] Instalando Node.js...
msiexec /i "%TMP%\node.msi" /qn /norestart
ping -n 6 127.0.0.1 >nul
set "PATH=%PATH%;C:\Program Files\nodejs;%APPDATA%\npm"
for /f "tokens=*" %%p in ('powershell -Command "[Environment]::GetEnvironmentVariable(\"PATH\",\"Machine\")"') do set "PATH=%%p;%PATH%"
echo [OK] Node.js instalado

:python
echo.
echo [2/4] Verificando Python...
python --version >nul 2>&1
if not errorlevel 1 (
    for /f "tokens=*" %%v in ('python --version') do echo [OK] %%v
    goto ffmpeg
)
echo [..] Baixando Python...
powershell -Command "$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.11.8/python-3.11.8-amd64.exe' -OutFile '%TMP%\python.exe'"
if not exist "%TMP%\python.exe" ( echo [ERRO] Falha ao baixar Python & goto erro )
echo [..] Instalando Python...
"%TMP%\python.exe" /quiet InstallAllUsers=1 PrependPath=1 Include_test=0
ping -n 4 127.0.0.1 >nul
for /f "tokens=*" %%p in ('powershell -Command "[Environment]::GetEnvironmentVariable(\"PATH\",\"Machine\")"') do set "PATH=%%p;%PATH%"
echo [OK] Python instalado

:ffmpeg
echo.
echo [3/4] Verificando ffmpeg...
ffmpeg -version >nul 2>&1
if not errorlevel 1 (
    echo [OK] ffmpeg ja instalado
    goto deps
)
echo [..] Baixando ffmpeg...
powershell -Command "$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -Uri 'https://github.com/BtbN/ffmpeg-builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip' -OutFile '%TMP%\ffmpeg.zip'"
if not exist "%TMP%\ffmpeg.zip" (
    echo [AVISO] ffmpeg nao baixado. Qualidade pode ser limitada.
    goto deps
)
echo [..] Extraindo ffmpeg...
powershell -Command "Expand-Archive -Path '%TMP%\ffmpeg.zip' -DestinationPath '%TMP%\ffx' -Force"
if not exist "%~dp0ffmpeg" mkdir "%~dp0ffmpeg"
for /d %%d in ("%TMP%\ffx\*") do xcopy /e /y /q "%%d\bin\*" "%~dp0ffmpeg\" >nul 2>&1
powershell -Command "$p=[Environment]::GetEnvironmentVariable('PATH','Machine'); if($p -notlike '*ffmpeg*'){[Environment]::SetEnvironmentVariable('PATH',$p+';%~dp0ffmpeg','Machine')}"
set "PATH=%~dp0ffmpeg;%PATH%"
echo [OK] ffmpeg instalado

:deps
echo.
echo [4/4] Instalando dependencias do app...
echo [..] Instalando yt-dlp...
pip install yt-dlp --quiet --disable-pip-version-check 2>nul
if errorlevel 1 python -m pip install yt-dlp --quiet
echo [OK] yt-dlp instalado

echo [..] Instalando Electron...
call npm install --loglevel=error 2>nul
if errorlevel 1 call "C:\Program Files\nodejs\npm.cmd" install --loglevel=error
if errorlevel 1 ( echo [ERRO] Falha no npm install & goto erro )
echo [OK] Electron instalado

echo [..] Criando atalho na Area de Trabalho...
set "ICON=%~dp0src\icon.ico"
set "TARGET=%~dp0iniciar.bat"
powershell -Command "$ws=New-Object -ComObject WScript.Shell; $s=$ws.CreateShortcut([Environment]::GetFolderPath('Desktop')+'\Media Downloader.lnk'); $s.TargetPath='%TARGET%'; $s.WorkingDirectory='%~dp0'; $s.IconLocation='%ICON%'; $s.Save()"
echo [OK] Atalho criado

rd /s /q "%TMP%" >nul 2>&1

echo.
echo  ==============================
echo  Instalacao concluida!
echo  Use o atalho na Area de Trabalho
echo  ou clique em iniciar.bat
echo  ==============================
echo.
pause
exit /b 0

:erro
echo.
echo  ==============================
echo  Instalacao com erros!
echo  Verifique sua internet e tente novamente.
echo  ==============================
echo.
pause
exit /b 1
