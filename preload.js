// preload.js — runs with elevated privileges BEFORE the page's JS starts
// CSP cannot block this file.

const fs = require('fs');
const path = require('path');
const logFile = path.join(__dirname, 'jam-debug.log');

function log(msg) {
  const line = `[PRELOAD ${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(logFile, line + '\n'); } catch(e) {}
}

log('preload.js started');

// ── Wait for the YouTube SPA to finish painting, then inject ────────────────
function waitAndInject() {
  log('waitAndInject called, readyState=' + document.readyState);

  // YouTube Music renders into #layout — wait for that
  const check = () => {
    const target = document.getElementById('layout') || document.querySelector('ytmusic-app');
    if (target) {
      log('YTM root element found, injecting UI...');
      injectJamUI();
    } else {
      log('YTM root not ready yet, retrying in 500ms...');
      setTimeout(check, 500);
    }
  };

  check();
}

if (document.readyState === 'loading') {
  log('Document still loading, attaching DOMContentLoaded listener');
  document.addEventListener('DOMContentLoaded', waitAndInject);
} else {
  log('Document already loaded, calling waitAndInject immediately');
  waitAndInject();
}

// ── The actual UI injection ─────────────────────────────────────────────────
function injectJamUI() {
  if (document.getElementById('jam-hub-btn')) {
    log('UI already injected, skipping.');
    return;
  }

  log('Injecting styles...');
  const style = document.createElement('style');
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
    #jam-hub-btn {
      position: fixed; bottom: 88px; right: 20px;
      width: 52px; height: 52px;
      background: linear-gradient(135deg, #5865F2, #7289DA);
      border-radius: 50%; display: flex; align-items: center;
      justify-content: center; cursor: pointer;
      box-shadow: 0 4px 20px rgba(88,101,242,0.6);
      border: none; z-index: 2147483647;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    #jam-hub-btn:hover { transform: scale(1.12); box-shadow: 0 6px 28px rgba(88,101,242,0.8); }
    #jam-panel {
      position: fixed; bottom: 152px; right: 20px; width: 300px;
      border-radius: 16px; background: rgba(15,16,20,0.97);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255,255,255,0.08);
      box-shadow: 0 16px 48px rgba(0,0,0,0.7);
      z-index: 2147483646; color: #fff;
      font-family: 'Inter', sans-serif;
      padding: 20px; flex-direction: column; gap: 12px;
      display: none;
    }
    .jam-title { font-size: 15px; font-weight: 700; display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
    .jam-divider { text-align: center; color: #555; font-size: 12px; margin: 2px 0; }
    .jam-input {
      width: 100%; background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.1); color: #fff;
      padding: 10px 14px; border-radius: 8px; font-size: 14px;
      outline: none; box-sizing: border-box;
      letter-spacing: 2px; text-transform: uppercase;
      transition: border-color 0.2s;
    }
    .jam-input:focus { border-color: #5865F2; }
    .jam-input::placeholder { letter-spacing: 0; text-transform: none; color: #555; }
    .jam-btn {
      background: #5865F2; color: #fff; border: none;
      padding: 10px 14px; border-radius: 8px; font-size: 14px;
      font-weight: 600; cursor: pointer; transition: background 0.2s;
    }
    .jam-btn:hover { background: #4752C4; }
    .jam-btn.outline { background: transparent; border: 1px solid rgba(255,255,255,0.15); color: #ccc; }
    .jam-btn.outline:hover { background: rgba(255,255,255,0.07); }
    #jam-code-display {
      text-align: center; font-size: 28px; font-weight: 700;
      letter-spacing: 6px; color: #5865F2;
      background: rgba(88,101,242,0.1); border-radius: 8px;
      padding: 10px; display: none;
    }
    #jam-status { font-size: 12px; color: #666; text-align: center; min-height: 16px; }
  `;
  document.head.appendChild(style);
  log('Styles injected.');

  log('Injecting HTML elements...');
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <button id="jam-hub-btn" title="Jam Session">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M12 3C7 3 3 7 3 12s4 9 9 9 9-4 9-9-4-9-9-9zm-1.5 13V8l7 4-7 4z" fill="#fff"/>
      </svg>
    </button>
    <div id="jam-panel">
      <div class="jam-title">🎵 Jam Session</div>
      <button class="jam-btn" id="start-jam-btn">🚀 Start a New Jam</button>
      <div id="jam-code-display"></div>
      <div class="jam-divider">— or join one —</div>
      <input class="jam-input" id="jam-code-input" placeholder="Enter 6-digit code" maxlength="6"/>
      <button class="jam-btn outline" id="join-jam-btn">🔗 Join Jam</button>
      <div id="jam-status">Not connected</div>
    </div>
  `;
  document.documentElement.appendChild(wrap);
  log('HTML injected into documentElement.');

  // ── Toggle panel ────────────────────────────────────────────────────────
  const hubBtn   = document.getElementById('jam-hub-btn');
  const panel    = document.getElementById('jam-panel');
  const status   = document.getElementById('jam-status');
  const codeDisp = document.getElementById('jam-code-display');

  hubBtn.addEventListener('click', () => {
    log('Jam button clicked');
    panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex';
  });

  // ── Load Socket.IO then wire up networking ───────────────────────────────
  log('Loading Socket.IO from CDN...');
  const ioScript = document.createElement('script');
  ioScript.src = 'https://cdn.socket.io/4.7.4/socket.io.min.js';
  ioScript.onload = () => {
    log('Socket.IO loaded OK. Connecting to Railway server...');
    const socket = io('https://ytm-jam-server-production.up.railway.app');
    let roomCode = null;
    let isExternal = false;

    socket.on('connect',    () => { log('Connected to server!'); status.textContent = '✅ Connected'; status.style.color = '#43B581'; });
    socket.on('disconnect', () => { log('Disconnected from server'); status.textContent = '❌ Disconnected'; status.style.color = '#F04747'; });
    socket.on('connect_error', (e) => log('Connection error: ' + e.message));

    document.getElementById('start-jam-btn').addEventListener('click', () => {
      roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      socket.emit('join_room', roomCode);
      codeDisp.textContent = roomCode;
      codeDisp.style.display = 'block';
      status.innerHTML = '👑 You are the DJ — share the code!';
      status.style.color = '#fff';
      log('Started Jam room: ' + roomCode);
    });

    document.getElementById('join-jam-btn').addEventListener('click', () => {
      const code = document.getElementById('jam-code-input').value.trim().toUpperCase();
      if (!code) return;
      roomCode = code;
      socket.emit('join_room', roomCode);
      status.innerHTML = '🎧 Joined room <strong style="color:#5865F2">' + roomCode + '</strong>';
      status.style.color = '#fff';
      log('Joined Jam room: ' + roomCode);
    });

    socket.on('force_play', (time) => {
      const v = document.querySelector('video');
      if (!v) return;
      isExternal = true;
      if (Math.abs(v.currentTime - time) > 1.5) v.currentTime = time;
      v.play();
      setTimeout(() => isExternal = false, 600);
    });
    socket.on('force_pause', (time) => {
      const v = document.querySelector('video');
      if (!v) return;
      isExternal = true;
      v.currentTime = time;
      v.pause();
      setTimeout(() => isExternal = false, 600);
    });

    setInterval(() => {
      const v = document.querySelector('video');
      if (v && !v._jamHooked) {
        v._jamHooked = true;
        v.addEventListener('play',  () => { if (!isExternal && roomCode) socket.emit('play_music',  { roomCode, time: v.currentTime }); });
        v.addEventListener('pause', () => { if (!isExternal && roomCode) socket.emit('pause_music', { roomCode, time: v.currentTime }); });
        log('Video player hooked for sync events.');
      }
    }, 1500);
  };
  ioScript.onerror = (e) => log('ERROR loading Socket.IO: ' + e);
  document.head.appendChild(ioScript);

  log('injectJamUI() complete!');
}
