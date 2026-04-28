const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const http = require('http');
const fs = require('fs');
const os = require('os');

const PORT = 8765;
let mainWindow = null;
let pythonProcess = null;

// ── Find Python ────────────────────────────────────────────────────────────────
function findPython() {
  const candidates = [
    'python',
    'python3',
    'py',
    path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python311', 'python.exe'),
    path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python312', 'python.exe'),
    path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python310', 'python.exe'),
    path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python39', 'python.exe'),
    'C:\\Python311\\python.exe',
    'C:\\Python312\\python.exe',
    'C:\\Python310\\python.exe',
    'C:\\Program Files\\Python311\\python.exe',
    'C:\\Program Files\\Python312\\python.exe',
  ];

  for (const cmd of candidates) {
    try {
      const r = spawnSync(cmd, ['--version'], {
        encoding: 'utf8', timeout: 3000, windowsHide: true,
      });
      if (r.status === 0) {
        console.log('[python] found at:', cmd, r.stdout.trim());
        return cmd;
      }
    } catch {}
  }
  return null;
}

// ── Ensure yt-dlp is installed ─────────────────────────────────────────────────
function ensureYtDlp(python) {
  console.log('[yt-dlp] checking...');
  const check = spawnSync(python, ['-c', 'import yt_dlp'], {
    encoding: 'utf8', timeout: 5000, windowsHide: true,
  });
  if (check.status !== 0) {
    console.log('[yt-dlp] not found, installing...');
    const install = spawnSync(python, ['-m', 'pip', 'install', 'yt-dlp', '--quiet'], {
      encoding: 'utf8', timeout: 60000, windowsHide: true,
    });
    console.log('[yt-dlp] install result:', install.status);
  } else {
    console.log('[yt-dlp] already installed');
  }
}

// ── Resolve backend path ───────────────────────────────────────────────────────
function getBackendPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'backend', 'server.py');
  }
  return path.join(__dirname, '..', 'backend', 'server.py');
}

// ── Build PATH with local ffmpeg ───────────────────────────────────────────────
function buildEnvPath() {
  const ffmpegDir = path.join(__dirname, '..', 'ffmpeg');
  return fs.existsSync(ffmpegDir)
    ? `${ffmpegDir};${process.env.PATH}`
    : process.env.PATH;
}

// ── Start Python server ────────────────────────────────────────────────────────
function startPython() {
  const python = findPython();
  if (!python) {
    dialog.showErrorBox(
      'Python não encontrado',
      'Instale Python 3.8+ em python.org\ne marque "Add Python to PATH".\nDepois reinicie o app.'
    );
    app.quit();
    return;
  }

  // Auto-instala yt-dlp se necessário
  ensureYtDlp(python);

  const serverPath = getBackendPath();
  console.log('[python] starting:', serverPath);

  pythonProcess = spawn(python, [serverPath], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    env: { ...process.env, PATH: buildEnvPath() },
  });

  pythonProcess.stdout.on('data', d => console.log('[py]', d.toString().trim()));
  pythonProcess.stderr.on('data', d => console.error('[py err]', d.toString().trim()));
  pythonProcess.on('exit', code => {
    console.log('[python] exit code:', code);
    if (code !== 0 && code !== null) {
      dialog.showErrorBox('Erro no servidor', `O servidor Python encerrou inesperadamente (código ${code}).\nTente reinstalar com instalar.bat`);
    }
  });
}

// ── Wait for server ────────────────────────────────────────────────────────────
function waitForServer(attempts = 0) {
  if (attempts > 60) {
    dialog.showErrorBox('Tempo esgotado', 'O servidor demorou demais para iniciar.\nTente fechar e abrir o app novamente.');
    return;
  }
  http.get(`http://localhost:${PORT}/api/status`, res => {
    if (res.statusCode === 200) {
      console.log('[server] ready!');
      mainWindow.loadURL(`http://localhost:${PORT}`);
    } else {
      setTimeout(() => waitForServer(attempts + 1), 500);
    }
  }).on('error', () => setTimeout(() => waitForServer(attempts + 1), 500));
}

// ── Create window ──────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 780,
    height: 900,
    minWidth: 600,
    minHeight: 700,
    title: 'Media Downloader',
    backgroundColor: '#0f0f11',
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    autoHideMenuBar: true,
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, 'splash.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── IPC ────────────────────────────────────────────────────────────────────────
ipcMain.handle('open-folder', async (_, folderPath) => {
  const target = folderPath && fs.existsSync(folderPath)
    ? folderPath
    : path.join(os.homedir(), 'Downloads', 'media-downloader');
  shell.openPath(target);
});

// ── Lifecycle ──────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  // startPython pode demorar (instala yt-dlp), roda em background
  setTimeout(() => {
    startPython();
    setTimeout(() => waitForServer(), 3000);
  }, 100);
});

app.on('window-all-closed', () => {
  if (pythonProcess) { pythonProcess.kill(); pythonProcess = null; }
  app.quit();
});

app.on('before-quit', () => {
  if (pythonProcess) { pythonProcess.kill(); pythonProcess = null; }
});
