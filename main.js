const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const fs = require('fs');

// ── LOGGER ───────────────────────────────────────────────────────────────────
const logFile = path.join(__dirname, 'jam-debug.log');
fs.writeFileSync(logFile, `=== JAM DEBUG LOG - ${new Date().toISOString()} ===\n`);

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(logFile, line + '\n');
}

log('App starting...');
log('__dirname: ' + __dirname);

const preloadPath = path.join(__dirname, 'preload.js');
log('Preload path: ' + preloadPath);
log('Preload exists: ' + fs.existsSync(preloadPath));

// ── MAIN WINDOW ───────────────────────────────────────────────────────────────
function createWindow() {
  log('Creating BrowserWindow...');

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'YouTube Music Jam',
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: false,
      nodeIntegration: true,   // needed so preload can use fs/path for logging
      webSecurity: false,
    },
  });

  // Wipe YouTube's CSP so our injected scripts are allowed to run
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...details.responseHeaders };
    delete headers['content-security-policy'];
    delete headers['Content-Security-Policy'];
    callback({ responseHeaders: headers });
  });

  win.webContents.on('did-start-loading', () => log('Page: did-start-loading'));
  win.webContents.on('did-finish-load',   () => log('Page: did-finish-load'));
  win.webContents.on('did-fail-load',     (e, code, desc) => log(`Page: did-fail-load code=${code} desc=${desc}`));
  win.webContents.on('dom-ready',         () => log('Page: dom-ready'));
  win.webContents.on('preload-error',     (e, preloadPath, err) => log(`PRELOAD ERROR: ${err}`));

  // Mirror renderer console into our log file
  win.webContents.on('console-message', (e, level, msg, line) => {
    log(`[Renderer L${level} line:${line}] ${msg}`);
  });

  log('Loading https://music.youtube.com ...');
  win.loadURL('https://music.youtube.com');
}

app.whenReady().then(() => {
  log('app is ready');
  createWindow();
});

app.on('window-all-closed', () => {
  log('All windows closed, quitting.');
  if (process.platform !== 'darwin') app.quit();
});
