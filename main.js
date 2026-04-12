const { app, BrowserWindow, session, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

const APP_URL = 'https://music.youtube.com';

let logFile = '';
let cspHookInstalled = false;

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);

  if (!logFile) {
    return;
  }

  try {
    fs.appendFileSync(logFile, `${line}\n`);
  } catch (_) {
    // Logging should never crash the app.
  }
}

function ensureLogFile() {
  logFile = path.join(app.getPath('userData'), 'jam-debug.log');

  try {
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    fs.writeFileSync(logFile, `=== JAM DEBUG LOG - ${new Date().toISOString()} ===\n`);
    log(`Log file ready at: ${logFile}`);
  } catch (error) {
    console.error('Failed to create log file:', error.message);
  }
}

function resolvePreloadPath() {
  const resourcePath = process.resourcesPath || '';
  const candidates = [
    path.join(__dirname, 'preload.js'),
    path.join(resourcePath, 'app.asar', 'preload.js'),
    path.join(resourcePath, 'preload.js'),
  ];

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

function installCspBypass() {
  if (cspHookInstalled) {
    return;
  }

  session.defaultSession.webRequest.onHeadersReceived(
    {
      urls: ['https://music.youtube.com/*', 'https://*.youtube.com/*'],
    },
    (details, callback) => {
      const headers = { ...details.responseHeaders };
      delete headers['content-security-policy'];
      delete headers['Content-Security-Policy'];
      callback({ responseHeaders: headers });
    }
  );

  cspHookInstalled = true;
  log('Installed CSP bypass for YouTube Music.');
}

function createWindow() {
  const preloadPath = resolvePreloadPath();
  const iconPath = path.join(__dirname, 'build', 'icon.ico');
  log(`Using preload path: ${preloadPath}`);
  log(`Preload exists: ${fs.existsSync(preloadPath)}`);
  log(`Icon exists: ${fs.existsSync(iconPath)}`);

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 980,
    minHeight: 640,
    title: 'YouTube Music Jam',
    autoHideMenuBar: true,
    show: false,
    icon: iconPath,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: false,
      nodeIntegration: true,
      sandbox: false,
      webSecurity: false,
    },
  });

  win.once('ready-to-show', () => {
    win.show();
    log('Window is ready to show.');
  });

  win.webContents.on('did-start-loading', () => log('Page: did-start-loading'));
  win.webContents.on('did-finish-load', () => log('Page: did-finish-load'));
  win.webContents.on('dom-ready', () => log('Page: dom-ready'));
  win.webContents.on('did-fail-load', (_event, code, desc, url) => {
    log(`Page: did-fail-load code=${code} desc=${desc} url=${url}`);
  });
  win.webContents.on('preload-error', (_event, preloadFile, error) => {
    log(`PRELOAD ERROR in ${preloadFile}: ${error}`);
  });
  win.webContents.on('render-process-gone', (_event, details) => {
    log(`Renderer gone: reason=${details.reason} exitCode=${details.exitCode}`);
  });
  win.webContents.on('console-message', (_event, level, msg, line, sourceId) => {
    log(`[Renderer L${level} line:${line}] ${msg} (${sourceId})`);
  });

  log(`Loading ${APP_URL} ...`);
  win.loadURL(APP_URL).catch((error) => {
    log(`loadURL failed: ${error.message}`);
  });
}

process.on('uncaughtException', (error) => {
  log(`UNCAUGHT EXCEPTION: ${error.stack || error.message}`);
});

process.on('unhandledRejection', (reason) => {
  const text = reason && reason.stack ? reason.stack : String(reason);
  log(`UNHANDLED REJECTION: ${text}`);
});

app.whenReady().then(() => {
  ensureLogFile();
  installCspBypass();

  ipcMain.on('log', (_event, message) => {
    log(`[PRELOAD] ${message}`);
  });

  log('App is ready.');
  log(`__dirname: ${__dirname}`);
  log(`process.resourcesPath: ${process.resourcesPath}`);

  createWindow();
});

app.on('window-all-closed', () => {
  log('All windows closed.');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
