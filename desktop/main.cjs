const {
  app,
  BrowserWindow,
  BrowserView,
  ipcMain,
  shell,
} = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

const ADMIN_URL =
  process.env.AGRO_ADMIN_URL ||
  'https://agroruralzortea.com.br/admin/app-boot?client=desktop';
const EMISSOR_URL = 'http://127.0.0.1:8000';
const EMISSOR_CONFIG = `${EMISSOR_URL}/configuracoes`;
const TOOLBAR_H = 44;

let mainWindow = null;
let toolbarView = null;
let adminView = null;
let emissorWindow = null;
let pollTimer = null;
let lastOnline = false;

function isDev() {
  return !app.isPackaged;
}

function resolveEmissorRoot() {
  const exeDir = path.dirname(app.getPath('exe'));
  const candidates = [
    path.join(exeDir, 'emissor_nfe'),
    path.join(process.resourcesPath || '', 'emissor_nfe'),
    path.join(__dirname, '..', 'emissor_nfe'),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function startEmissorHidden() {
  const root = resolveEmissorRoot();
  if (!root) {
    throw new Error(
      'Pasta emissor_nfe nao encontrada ao lado do app. Reinstale o AgroRural-Setup.'
    );
  }
  const vbs = path.join(root, 'scripts', 'start-local-hidden.vbs');
  const bat = path.join(root, 'scripts', 'start-local.bat');
  if (fs.existsSync(vbs)) {
    spawn('wscript.exe', ['//nologo', vbs], {
      cwd: root,
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    }).unref();
    return;
  }
  if (fs.existsSync(bat)) {
    spawn('cmd.exe', ['/c', bat], {
      cwd: root,
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, AGRO_EMISSOR_HIDDEN: '1' },
      windowsHide: true,
    }).unref();
    return;
  }
  throw new Error('start-local-hidden.vbs nao encontrado.');
}

function checkEmissorUp() {
  return new Promise((resolve) => {
    const req = http.get(`${EMISSOR_URL}/up`, { timeout: 2500 }, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 400);
    });
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
  });
}

function broadcastStatus(online) {
  lastOnline = online;
  if (toolbarView && !toolbarView.webContents.isDestroyed()) {
    toolbarView.webContents.send('emissor:status', online);
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('emissor:status', online);
  }
  if (adminView && !adminView.webContents.isDestroyed()) {
    adminView.webContents.send('emissor:status', online);
  }
}

async function pollOnce() {
  const online = await checkEmissorUp();
  if (online !== lastOnline) broadcastStatus(online);
  else broadcastStatus(online);
}

function layoutViews() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const { width, height } = mainWindow.getContentBounds();
  const full = mainWindow.isFullScreen();
  const bar = full ? 0 : TOOLBAR_H;
  if (toolbarView) {
    toolbarView.setBounds({ x: 0, y: 0, width, height: bar });
    toolbarView.setAutoResize({ width: true });
  }
  if (adminView) {
    adminView.setBounds({ x: 0, y: bar, width, height: Math.max(0, height - bar) });
    adminView.setAutoResize({ width: true, height: true });
  }
}

function attachF11(contents) {
  contents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      event.preventDefault();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setFullScreen(!mainWindow.isFullScreen());
      }
    }
  });
}

function toggleFullscreen() {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  mainWindow.setFullScreen(!mainWindow.isFullScreen());
  return mainWindow.isFullScreen();
}

function openEmissorWindow() {
  if (emissorWindow && !emissorWindow.isDestroyed()) {
    emissorWindow.show();
    emissorWindow.focus();
    emissorWindow.loadURL(EMISSOR_CONFIG);
    return;
  }
  emissorWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    title: 'Emissor NF-e — Agro Rural',
    icon: path.join(__dirname, 'assets', 'logo.ico'),
    backgroundColor: '#0f1419',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  attachF11(emissorWindow.webContents);
  emissorWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  emissorWindow.on('closed', () => {
    emissorWindow = null;
  });
  emissorWindow.loadURL(EMISSOR_CONFIG);
}

async function startThenOpen() {
  const already = await checkEmissorUp();
  if (!already) {
    startEmissorHidden();
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 1000));
      if (await checkEmissorUp()) break;
    }
  }
  const online = await checkEmissorUp();
  broadcastStatus(online);
  if (!online) {
    throw new Error(
      'Emissor offline em 127.0.0.1:8000. Rode emissor_nfe\\scripts\\start-local.bat'
    );
  }
  openEmissorWindow();
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Agro Rural',
    icon: path.join(__dirname, 'assets', 'logo.ico'),
    backgroundColor: '#0f3d2e',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  toolbarView = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  adminView = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.addBrowserView(toolbarView);
  mainWindow.addBrowserView(adminView);
  layoutViews();

  toolbarView.webContents.loadFile(path.join(__dirname, 'toolbar.html'));
  adminView.webContents.loadURL(ADMIN_URL);

  attachF11(mainWindow.webContents);
  attachF11(toolbarView.webContents);
  attachF11(adminView.webContents);

  adminView.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('resize', layoutViews);
  mainWindow.on('enter-full-screen', layoutViews);
  mainWindow.on('leave-full-screen', layoutViews);
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
    toolbarView = null;
    adminView = null;
  });
}

app.whenReady().then(() => {
  createMainWindow();
  void pollOnce();
  pollTimer = setInterval(() => void pollOnce(), 3000);

  ipcMain.handle('emissor:start', async () => {
    await startThenOpen();
    return true;
  });
  ipcMain.handle('emissor:open', async () => {
    const online = await checkEmissorUp();
    if (!online) {
      await startThenOpen();
      return true;
    }
    openEmissorWindow();
    return true;
  });
  ipcMain.handle('window:fullscreen', () => toggleFullscreen());
});

app.on('window-all-closed', () => {
  if (pollTimer) clearInterval(pollTimer);
  app.quit();
});
