const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const PORT = 8765;
let mainWindow = null;
let pythonProcess = null;

// ── Find Python ────────────────────────────────────────────────────────────────
function findPython() {
  const candidates = ['python', 'python3', 'py'];
  const { spawnSync } = require('child_process');
  for (const cmd of candidates) {
    try {
      const r = spawnSync(cmd, ['--version'], { encoding: 'utf8', timeout: 3000 });
      if (r.status === 0) return cmd;
    } catch {}
  }
  return null;
}

// ── Resolve backend path (works in dev and after packaging) ───────────────────
function getBackendPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'backend', 'server.py');
  }
  return path.join(__dirname, '..', 'backend', 'server.py');
}

// ── Start Python server ────────────────────────────────────────────────────────
function startPython() {
  const python = findPython();
  if (!python) {
    dialog.showErrorBox(
      'Python não encontrado',
      'Instale Python 3.8+ em python.org e reinicie o app.'
    );
    app.quit();
    return;
  }

  const serverPath = getBackendPath();
  pythonProcess = spawn(python, [serverPath], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  pythonProcess.stdout.on('data', d => console.log('[python]', d.toString().trim()));
  pythonProcess.stderr.on('data', d => console.error('[python err]', d.toString().trim()));
  pythonProcess.on('exit', code => console.log('[python] exited with code', code));
}

// ── Wait until server is up, then load it ─────────────────────────────────────
function waitForServer(attempts = 0) {
  if (attempts > 30) {
    dialog.showErrorBox('Erro', 'O servidor Python não iniciou. Verifique se yt-dlp está instalado.');
    return;
  }
  http.get(`http://localhost:${PORT}/api/status`, res => {
    if (res.statusCode === 200) {
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

  // Show splash while server starts
  mainWindow.loadFile(path.join(__dirname, 'splash.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── IPC: open downloads folder ─────────────────────────────────────────────────
ipcMain.handle('open-folder', async (_, folderPath) => {
  if (folderPath && fs.existsSync(folderPath)) {
    shell.openPath(folderPath);
  } else {
    shell.openPath(path.join(require('os').homedir(), 'Downloads', 'media-downloader'));
  }
});

// ── App lifecycle ──────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  startPython();
  createWindow();
  setTimeout(() => waitForServer(), 1500);
});

app.on('window-all-closed', () => {
  if (pythonProcess) {
    pythonProcess.kill();
    pythonProcess = null;
  }
  app.quit();
});

app.on('before-quit', () => {
  if (pythonProcess) {
    pythonProcess.kill();
    pythonProcess = null;
  }
});
