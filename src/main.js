const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn, spawnSync, execSync } = require('child_process');
const http = require('http');
const fs = require('fs');
const os = require('os');

const PORT = 8765;
const HOST = '127.0.0.1'; // mesmo que o servidor Python
let mainWindow = null;
let pythonProcess = null;

// ── Mata processo anterior na porta ───────────────────────────────────────────
function killOldServer() {
  try {
    const result = execSync(`netstat -ano | findstr :${PORT}`, { encoding: 'utf8', timeout: 3000 });
    const lines = result.split('\n').filter(l => l.includes('LISTENING'));
    for (const line of lines) {
      const pid = line.trim().split(/\s+/).pop();
      if (pid && !isNaN(pid)) {
        try { execSync(`taskkill /PID ${pid} /F`, { timeout: 2000 }); console.log('[kill] pid', pid); } catch {}
      }
    }
  } catch {}
}

// ── Find Python ────────────────────────────────────────────────────────────────
function findPython() {
  const candidates = [
    'python',
    'python3',
    'py',
    path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python314', 'python.exe'),
    path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python313', 'python.exe'),
    path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python312', 'python.exe'),
    path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python311', 'python.exe'),
    path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python310', 'python.exe'),
  ];
  for (const cmd of candidates) {
    try {
      const r = spawnSync(cmd, ['--version'], { encoding: 'utf8', timeout: 3000, windowsHide: true });
      if (r.status === 0) { console.log('[python] found:', cmd); return cmd; }
    } catch {}
  }
  return null;
}

// ── Ensure yt-dlp ─────────────────────────────────────────────────────────────
function ensureYtDlp(python) {
  const check = spawnSync(python, ['-c', 'import yt_dlp'], { encoding: 'utf8', timeout: 5000, windowsHide: true });
  if (check.status !== 0) {
    console.log('[yt-dlp] installing...');
    spawnSync(python, ['-m', 'pip', 'install', 'yt-dlp', '--quiet'], { encoding: 'utf8', timeout: 60000, windowsHide: true });
  } else {
    console.log('[yt-dlp] ok');
  }
}

// ── Resolve backend path ───────────────────────────────────────────────────────
function getBackendPath() {
  if (app.isPackaged) return path.join(process.resourcesPath, 'backend', 'server.py');
  return path.join(__dirname, '..', 'backend', 'server.py');
}

// ── Start Python server ────────────────────────────────────────────────────────
function startPython() {
  const python = findPython();
  if (!python) {
    dialog.showErrorBox('Python não encontrado', 'Instale Python em python.org e marque "Add Python to PATH".');
    app.quit();
    return;
  }

  ensureYtDlp(python);

  const serverPath = getBackendPath();
  const ffmpegDir = path.join(__dirname, '..', 'ffmpeg');
  const envPath = fs.existsSync(ffmpegDir) ? `${ffmpegDir};${process.env.PATH}` : process.env.PATH;

  console.log('[python] starting:', serverPath);
  pythonProcess = spawn(python, [serverPath], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    env: { ...process.env, PATH: envPath },
  });

  pythonProcess.stdout.on('data', d => {
    const msg = d.toString().trim();
    console.log('[py]', msg);
    // Assim que o servidor estiver pronto, carrega a UI
    if (msg.includes('Pronto em')) {
      setTimeout(() => {
        if (mainWindow) mainWindow.loadURL(`http://${HOST}:${PORT}`);
      }, 300);
    }
  });
  pythonProcess.stderr.on('data', d => console.error('[py err]', d.toString().trim()));
  pythonProcess.on('exit', code => {
    console.log('[python] exit:', code);
    if (code !== 0 && code !== null) {
      dialog.showErrorBox('Erro', `Servidor encerrou inesperadamente (código ${code}).\nRode instalar.bat novamente.`);
    }
  });
}

// ── Fallback: polling caso o stdout não dispare ────────────────────────────────
function waitForServer(attempts = 0) {
  if (attempts > 120) return; // desiste após 60s
  const req = http.get(`http://${HOST}:${PORT}/api/status`, { timeout: 1000 }, res => {
    if (res.statusCode === 200 && mainWindow && !mainWindow.webContents.getURL().includes('/api/')) {
      console.log('[server] ready via polling');
      mainWindow.loadURL(`http://${HOST}:${PORT}`);
    }
  });
  req.on('error', () => setTimeout(() => waitForServer(attempts + 1), 500));
  req.on('timeout', () => { req.destroy(); setTimeout(() => waitForServer(attempts + 1), 500); });
}

// ── Create window ──────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 780, height: 900, minWidth: 600, minHeight: 700,
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
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── IPC ────────────────────────────────────────────────────────────────────────
ipcMain.handle('open-folder', async (_, folderPath) => {
  const target = folderPath && fs.existsSync(folderPath) ? folderPath : path.join(os.homedir(), 'Downloads', 'media-downloader');
  shell.openPath(target);
});

// ── Lifecycle ──────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  killOldServer();
  createWindow();
  setTimeout(() => {
    startPython();
    setTimeout(() => waitForServer(), 3000); // fallback polling
  }, 500);
});

app.on('window-all-closed', () => {
  if (pythonProcess) { pythonProcess.kill(); pythonProcess = null; }
  app.quit();
});

app.on('before-quit', () => {
  if (pythonProcess) { pythonProcess.kill(); pythonProcess = null; }
});
