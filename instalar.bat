@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
cd /d "%~dp0"

echo.
echo  ╔══════════════════════════════════════════╗
echo  ║       Media Downloader - Instalador      ║
echo  ╚══════════════════════════════════════════╝
echo.

REM ── Verifica permissao de administrador ──────────────────────────────────────
net session >nul 2>&1
if errorlevel 1 (
    echo  [!] Solicitando permissao de administrador...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

REM ── Pasta temporaria para downloads ──────────────────────────────────────────
set "TMP_DIR=%~dp0_instalador_tmp"
if not exist "%TMP_DIR%" mkdir "%TMP_DIR%"

REM ═══════════════════════════════════════════════════════
REM  1. NODE.JS
REM ═══════════════════════════════════════════════════════
echo  [1/4] Verificando Node.js...
node --version >nul 2>&1
if not errorlevel 1 (
    for /f "tokens=*" %%v in ('node --version') do echo  [OK] Node.js %%v ja instalado
    goto :check_python
)

echo  [>>] Baixando Node.js LTS...
set "NODE_URL=https://nodejs.org/dist/v20.11.1/node-v20.11.1-x64.msi"
set "NODE_MSI=%TMP_DIR%\node.msi"
powershell -Command "& { $ProgressPreference='SilentlyContinue'; Invoke-WebRequest -Uri '%NODE_URL%' -OutFile '%NODE_MSI%' }"
if not exist "%NODE_MSI%" ( echo  [ERRO] Falha ao baixar Node.js. & goto :error )
echo  [>>] Instalando Node.js...
msiexec /i "%NODE_MSI%" /qn /norestart
if errorlevel 1 ( echo  [ERRO] Falha ao instalar Node.js. & goto :error )
for /f "tokens=*" %%p in ('powershell -Command "[System.Environment]::GetEnvironmentVariable(\"PATH\",\"Machine\")"') do set "PATH=%%p;%PATH%"
echo  [OK] Node.js instalado

REM ═══════════════════════════════════════════════════════
REM  2. PYTHON
REM ═══════════════════════════════════════════════════════
:check_python
echo.
echo  [2/4] Verificando Python...
python --version >nul 2>&1
if not errorlevel 1 (
    for /f "tokens=*" %%v in ('python --version') do echo  [OK] %%v ja instalado
    goto :check_ffmpeg
)

echo  [>>] Baixando Python 3.11...
set "PY_URL=https://www.python.org/ftp/python/3.11.8/python-3.11.8-amd64.exe"
set "PY_EXE=%TMP_DIR%\python.exe"
powershell -Command "& { $ProgressPreference='SilentlyContinue'; Invoke-WebRequest -Uri '%PY_URL%' -OutFile '%PY_EXE%' }"
if not exist "%PY_EXE%" ( echo  [ERRO] Falha ao baixar Python. & goto :error )
echo  [>>] Instalando Python...
"%PY_EXE%" /quiet InstallAllUsers=1 PrependPath=1 Include_test=0
if errorlevel 1 ( echo  [ERRO] Falha ao instalar Python. & goto :error )
for /f "tokens=*" %%p in ('powershell -Command "[System.Environment]::GetEnvironmentVariable(\"PATH\",\"Machine\")"') do set "PATH=%%p;%PATH%"
echo  [OK] Python instalado

REM ═══════════════════════════════════════════════════════
REM  3. FFMPEG
REM ═══════════════════════════════════════════════════════
:check_ffmpeg
echo.
echo  [3/4] Verificando ffmpeg...
ffmpeg -version >nul 2>&1
if not errorlevel 1 (
    echo  [OK] ffmpeg ja instalado
    goto :install_deps
)

echo  [>>] Baixando ffmpeg...
set "FF_URL=https://github.com/BtbN/ffmpeg-builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"
set "FF_ZIP=%TMP_DIR%\ffmpeg.zip"
set "FF_DIR=%~dp0ffmpeg"
powershell -Command "& { $ProgressPreference='SilentlyContinue'; Invoke-WebRequest -Uri '%FF_URL%' -OutFile '%FF_ZIP%' }"
if not exist "%FF_ZIP%" (
    echo  [AVISO] Falha ao baixar ffmpeg. Downloads funcionarao sem alta qualidade.
    goto :install_deps
)
echo  [>>] Extraindo ffmpeg...
powershell -Command "Expand-Archive -Path '%FF_ZIP%' -DestinationPath '%TMP_DIR%\ffmpeg_ex' -Force"
if not exist "%FF_DIR%" mkdir "%FF_DIR%"
for /d %%d in ("%TMP_DIR%\ffmpeg_ex\*") do xcopy /e /y /q "%%d\bin\*" "%FF_DIR%\" >nul 2>&1
powershell -Command "$p=[System.Environment]::GetEnvironmentVariable('PATH','Machine'); if($p -notlike '*ffmpeg*'){[System.Environment]::SetEnvironmentVariable('PATH',$p+';%FF_DIR%','Machine')}"
set "PATH=%FF_DIR%;%PATH%"
echo  [OK] ffmpeg instalado

REM ═══════════════════════════════════════════════════════
REM  4. YT-DLP + ELECTRON
REM ═══════════════════════════════════════════════════════
:install_deps
echo.
echo  [4/4] Instalando dependencias do app...

echo  [>>] Instalando yt-dlp...
pip install yt-dlp --quiet --disable-pip-version-check 2>nul
if errorlevel 1 python -m pip install yt-dlp --quiet
echo  [OK] yt-dlp instalado

echo  [>>] Instalando Electron (pode demorar alguns minutos)...
call npm install --loglevel=error
if errorlevel 1 ( echo  [ERRO] Falha ao instalar pacotes npm. & goto :error )
echo  [OK] Electron instalado

REM ── Atalho na Area de Trabalho ──────────────────────────────────────────────
echo.
echo  [>>] Criando atalho na Area de Trabalho...
set "SHORTCUT=%USERPROFILE%\Desktop\Media Downloader.lnk"
set "TARGET=%~dp0iniciar.bat"
powershell -Command "$ws=New-Object -ComObject WScript.Shell; $s=$ws.CreateShortcut('%SHORTCUT%'); $s.TargetPath='%TARGET%'; $s.WorkingDirectory='%~dp0'; $s.Description='Media Downloader'; $s.Save()"
echo  [OK] Atalho criado na Area de Trabalho

REM ── Limpeza ─────────────────────────────────────────────────────────────────
rd /s /q "%TMP_DIR%" >nul 2>&1

echo.
echo  ╔══════════════════════════════════════════╗
echo  ║    Instalacao concluida com sucesso!     ║
echo  ║                                          ║
echo  ║  Use o atalho na Area de Trabalho        ║
echo  ║  ou clique duas vezes em iniciar.bat     ║
echo  ╚══════════════════════════════════════════╝
echo.
pause
exit /b 0

:error
echo.
echo  ╔══════════════════════════════════════════╗
echo  ║         Instalacao com erros!            ║
echo  ║  Verifique sua conexao e tente de novo.  ║
echo  ╚══════════════════════════════════════════╝
echo.
pause
exit /b 1
