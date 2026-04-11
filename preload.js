const { ipcRenderer } = require('electron');

const SOCKET_IO_CDN = 'https://cdn.socket.io/4.7.4/socket.io.min.js';
const SOCKET_SERVER_URL = 'https://ytm-jam-server-production.up.railway.app';

let uiInjected = false;
let socketScriptRequested = false;

function log(message) {
  try {
    ipcRenderer.send('log', message);
  } catch (_) {
    console.log('[PRELOAD] ' + message);
  }
}

function rootReady() {
  return Boolean(document.getElementById('layout') || document.querySelector('ytmusic-app'));
}

function appendToHeadOrRoot(node) {
  const parent = document.head || document.documentElement;
  if (parent) {
    parent.appendChild(node);
  }
}

function injectJamUI() {
  if (uiInjected || document.getElementById('jam-hub-btn')) {
    return;
  }

  uiInjected = true;
  log('Injecting Jam UI.');

  const style = document.createElement('style');
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
    #jam-hub-btn {
      position: fixed;
      bottom: 88px;
      right: 20px;
      width: 52px;
      height: 52px;
      background: linear-gradient(135deg, #5865f2, #7289da);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(88, 101, 242, 0.6);
      border: none;
      z-index: 2147483647;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    #jam-hub-btn:hover {
      transform: scale(1.12);
      box-shadow: 0 6px 28px rgba(88, 101, 242, 0.8);
    }
    #jam-panel {
      position: fixed;
      bottom: 152px;
      right: 20px;
      width: 300px;
      border-radius: 16px;
      background: rgba(15, 16, 20, 0.97);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.7);
      z-index: 2147483646;
      color: #fff;
      font-family: 'Inter', sans-serif;
      padding: 20px;
      flex-direction: column;
      gap: 12px;
      display: none;
    }
    .jam-title {
      font-size: 15px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }
    .jam-divider {
      text-align: center;
      color: #555;
      font-size: 12px;
      margin: 2px 0;
    }
    .jam-input {
      width: 100%;
      background: rgba(255, 255, 255, 0.07);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #fff;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 14px;
      outline: none;
      box-sizing: border-box;
      letter-spacing: 2px;
      text-transform: uppercase;
      transition: border-color 0.2s;
    }
    .jam-input:focus {
      border-color: #5865f2;
    }
    .jam-input::placeholder {
      letter-spacing: 0;
      text-transform: none;
      color: #555;
    }
    .jam-btn {
      background: #5865f2;
      color: #fff;
      border: none;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .jam-btn:hover {
      background: #4752c4;
    }
    .jam-btn.outline {
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #ccc;
    }
    .jam-btn.outline:hover {
      background: rgba(255, 255, 255, 0.07);
    }
    #jam-code-display {
      text-align: center;
      font-size: 28px;
      font-weight: 700;
      letter-spacing: 6px;
      color: #5865f2;
      background: rgba(88, 101, 242, 0.1);
      border-radius: 8px;
      padding: 10px;
      display: none;
    }
    #jam-status {
      font-size: 12px;
      color: #666;
      text-align: center;
      min-height: 16px;
    }
  `;
  appendToHeadOrRoot(style);

  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <button id="jam-hub-btn" title="Jam Session">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M12 3C7 3 3 7 3 12s4 9 9 9 9-4 9-9-4-9-9-9zm-1.5 13V8l7 4-7 4z" fill="#fff"/>
      </svg>
    </button>
    <div id="jam-panel">
      <div class="jam-title">Jam Session</div>
      <button class="jam-btn" id="start-jam-btn">Start a New Jam</button>
      <div id="jam-code-display"></div>
      <div class="jam-divider">or join one</div>
      <input class="jam-input" id="jam-code-input" placeholder="Enter 6-digit code" maxlength="6"/>
      <button class="jam-btn outline" id="join-jam-btn">Join Jam</button>
      <div id="jam-status">Connecting...</div>
    </div>
  `;
  (document.body || document.documentElement).appendChild(wrap);

  const hubBtn = document.getElementById('jam-hub-btn');
  const panel = document.getElementById('jam-panel');
  const status = document.getElementById('jam-status');
  const codeDisplay = document.getElementById('jam-code-display');

  hubBtn.addEventListener('click', () => {
    panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex';
  });

  if (socketScriptRequested) {
    return;
  }

  socketScriptRequested = true;

  const socketScript = document.createElement('script');
  socketScript.src = SOCKET_IO_CDN;
  socketScript.onload = () => {
    if (typeof window.io !== 'function') {
      status.textContent = 'Socket.IO failed to initialize';
      status.style.color = '#f04747';
      log('Socket.IO script loaded but window.io is unavailable.');
      return;
    }

    log('Socket.IO loaded. Connecting to Railway server.');

    const socket = window.io(SOCKET_SERVER_URL, {
      transports: ['websocket', 'polling'],
    });

    let roomCode = null;
    let isExternal = false;

    socket.on('connect', () => {
      status.textContent = 'Connected';
      status.style.color = '#43b581';
      log('Connected to jam server.');
    });

    socket.on('disconnect', (reason) => {
      status.textContent = 'Disconnected';
      status.style.color = '#f04747';
      log('Disconnected from jam server: ' + reason);
    });

    socket.on('connect_error', (error) => {
      status.textContent = 'Cannot reach jam server';
      status.style.color = '#f04747';
      log('Jam server connection error: ' + error.message);
    });

    document.getElementById('start-jam-btn').addEventListener('click', () => {
      roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      socket.emit('join_room', roomCode);
      codeDisplay.textContent = roomCode;
      codeDisplay.style.display = 'block';
      status.textContent = 'You are the DJ. Share the code.';
      status.style.color = '#ffffff';
      log('Started jam room: ' + roomCode);
    });

    document.getElementById('join-jam-btn').addEventListener('click', () => {
      const code = document.getElementById('jam-code-input').value.trim().toUpperCase();
      if (!code) {
        return;
      }

      roomCode = code;
      socket.emit('join_room', roomCode);
      codeDisplay.textContent = roomCode;
      codeDisplay.style.display = 'block';
      status.textContent = 'Joined room ' + roomCode;
      status.style.color = '#ffffff';
      log('Joined jam room: ' + roomCode);
    });

    socket.on('force_play', (time) => {
      const video = document.querySelector('video');
      if (!video) {
        return;
      }

      isExternal = true;
      if (Math.abs(video.currentTime - time) > 1.5) {
        video.currentTime = time;
      }
      video.play();
      setTimeout(() => {
        isExternal = false;
      }, 600);
    });

    socket.on('force_pause', (time) => {
      const video = document.querySelector('video');
      if (!video) {
        return;
      }

      isExternal = true;
      video.currentTime = time;
      video.pause();
      setTimeout(() => {
        isExternal = false;
      }, 600);
    });

    window.setInterval(() => {
      const video = document.querySelector('video');
      if (!video || video._jamHooked) {
        return;
      }

      video._jamHooked = true;
      video.addEventListener('play', () => {
        if (!isExternal && roomCode) {
          socket.emit('play_music', { roomCode, time: video.currentTime });
        }
      });
      video.addEventListener('pause', () => {
        if (!isExternal && roomCode) {
          socket.emit('pause_music', { roomCode, time: video.currentTime });
        }
      });
      log('Video player hooked for sync events.');
    }, 1500);
  };

  socketScript.onerror = () => {
    status.textContent = 'Socket.IO CDN blocked or offline';
    status.style.color = '#f04747';
    log('Failed to load Socket.IO from CDN.');
  };

  appendToHeadOrRoot(socketScript);
}

function waitAndInject() {
  let attempts = 0;

  const check = () => {
    attempts += 1;

    if (rootReady()) {
      log(`YTM root found after ${attempts} check(s).`);
      injectJamUI();
      return;
    }

    if (attempts <= 20) {
      setTimeout(check, 500);
    } else {
      log('YTM root was not found after 20 checks.');
    }
  };

  check();
}

log('preload.js started');

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', waitAndInject, { once: true });
} else {
  waitAndInject();
}

window.addEventListener('yt-navigate-finish', () => {
  if (!document.getElementById('jam-hub-btn')) {
    uiInjected = false;
    waitAndInject();
  }
});
