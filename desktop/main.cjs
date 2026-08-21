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
const EMISSOR_URL = 'http://127.0.0.1:8001';
const EMISSOR_HOME = `${EMISSOR_URL}/`;
const TOOLBAR_H = 44;

let mainWindow = null;
let toolbarView = null;
let adminView = null;
/** @type {'admin' | 'emissor'} */
let contentMode = 'admin';
let pollTimer = null;
let lastOnline = false;

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

function isEmissorUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
    const port = u.port === '8001';
    return host && port && (u.protocol === 'http:' || u.protocol === 'https:');
  } catch {
    return false;
  }
}

function broadcastStatus(online) {
  lastOnline = online;
  const payload = { online: !!online, mode: contentMode };
  for (const view of [toolbarView, adminView]) {
    if (view && !view.webContents.isDestroyed()) {
      view.webContents.send('emissor:status', payload);
    }
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('emissor:status', payload);
  }
}

async function pollOnce() {
  const online = await checkEmissorUp();
  broadcastStatus(online);
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
    adminView.setBounds({
      x: 0,
      y: bar,
      width,
      height: Math.max(0, height - bar),
    });
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

function showAdmin() {
  if (!adminView || adminView.webContents.isDestroyed()) return;
  contentMode = 'admin';
  adminView.webContents.loadURL(ADMIN_URL);
  broadcastStatus(lastOnline);
}

function showEmissor(url) {
  if (!adminView || adminView.webContents.isDestroyed()) return;
  const target =
    typeof url === 'string' && url.trim() && isEmissorUrl(url)
      ? url.trim()
      : EMISSOR_HOME;
  contentMode = 'emissor';
  adminView.webContents.loadURL(target);
  broadcastStatus(lastOnline);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.focus();
  }
}

async function ensureEmissorOnline() {
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
      'Emissor offline em 127.0.0.1:8001. Rode emissor_nfe\\scripts\\start-local.bat'
    );
  }
}

async function startThenShow(url) {
  await ensureEmissorOnline();
  showEmissor(url);
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
    show: true,
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

  // Qualquer link do painel para o Laravel fica na mesma janela.
  adminView.webContents.setWindowOpenHandler(({ url }) => {
    if (isEmissorUrl(url)) {
      void (async () => {
        try {
          await ensureEmissorOnline();
          showEmissor(url);
        } catch (e) {
          const msg = e && e.message ? e.message : String(e);
          if (mainWindow && !mainWindow.isDestroyed()) {
            const { dialog } = require('electron');
            dialog.showErrorBox('Emissor NF-e', msg);
          }
        }
      })();
      return { action: 'deny' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  adminView.webContents.on('will-navigate', (event, url) => {
    if (isEmissorUrl(url)) {
      contentMode = 'emissor';
      broadcastStatus(lastOnline);
      return;
    }
    try {
      const u = new URL(url);
      if (
        u.hostname.includes('agroruralzortea.com.br') ||
        u.hostname === 'localhost' ||
        u.hostname === '127.0.0.1'
      ) {
        contentMode = 'admin';
        broadcastStatus(lastOnline);
      }
    } catch {
      /* ignore */
    }
  });

  mainWindow.on('resize', layoutViews);
  mainWindow.on('enter-full-screen', layoutViews);
  mainWindow.on('leave-full-screen', layoutViews);
  mainWindow.focus();
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

  ipcMain.handle('emissor:start', async (_e, url) => {
    await startThenShow(url);
    return true;
  });
  ipcMain.handle('emissor:open', async (_e, url) => {
    await startThenShow(url);
    return true;
  });
  ipcMain.handle('emissor:online', async () => lastOnline);
  /** Proxy HTTP → emissor local (evita mixed content no admin HTTPS). */
  ipcMain.handle('emissor:request', async (_e, opts) => {
    const path = String(opts?.path || '');
    if (!path.startsWith('/')) {
      return { ok: false, status: 0, body: 'Caminho inválido', error: 'path' };
    }
    const method = String(opts?.method || 'GET').toUpperCase();
    const headers = opts?.headers && typeof opts.headers === 'object' ? opts.headers : {};
    const url = `http://127.0.0.1:8001${path}`;
    try {
      const init = {
        method,
        headers,
        body:
          opts?.body != null && method !== 'GET' && method !== 'HEAD'
            ? String(opts.body)
            : undefined,
      };
      const res = await fetch(url, init);
      const contentType = res.headers.get('content-type') || '';
      const buf = Buffer.from(await res.arrayBuffer());
      const isBinary = /pdf|octet-stream|xml|zip|image\//i.test(contentType);
      return {
        ok: res.ok,
        status: res.status,
        body: isBinary ? buf.toString('base64') : buf.toString('utf8'),
        encoding: isBinary ? 'base64' : 'utf8',
        contentType,
      };
    } catch (err) {
      return {
        ok: false,
        status: 0,
        body: '',
        error: err instanceof Error ? err.message : 'Falha de rede no emissor',
      };
    }
  });
  ipcMain.handle('app:show-admin', async () => {
    showAdmin();
    return true;
  });
  ipcMain.handle('window:fullscreen', () => toggleFullscreen());
});

app.on('window-all-closed', () => {
  if (pollTimer) clearInterval(pollTimer);
  app.quit();
});
