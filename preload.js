const { ipcRenderer } = require('electron');

const SOCKET_IO_CDN = 'https://cdn.socket.io/4.7.4/socket.io.min.js';
const SOCKET_SERVER_URL = 'https://ytm-jam-server-production.up.railway.app';
const JAM_STORAGE_KEY = 'ytm-jam-session';

let uiInjected = false;
let socketScriptRequested = false;
let lastTrackFingerprint = '';
let isApplyingRemoteState = false;

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

function loadJamSession() {
  try {
    const raw = window.sessionStorage.getItem(JAM_STORAGE_KEY);
    return raw ? JSON.parse(raw) : { roomCode: null, username: null };
  } catch (_) {
    return { roomCode: null, username: null };
  }
}

function saveJamSession(session) {
  try {
    window.sessionStorage.setItem(JAM_STORAGE_KEY, JSON.stringify({
      roomCode: session.roomCode || null,
      username: session.username || null,
      isHost: Boolean(session.isHost),
    }));
  } catch (_) {
    // Ignore storage failures.
  }
}

function getCurrentTrackInfo() {
  const url = new URL(window.location.href);
  const trackId = url.searchParams.get('v') || url.pathname || null;
  return {
    url: url.toString(),
    trackId,
  };
}

function fingerprintTrack() {
  const track = getCurrentTrackInfo();
  return `${track.trackId || 'no-track'}|${track.url}`;
}

function waitForVideo(timeoutMs = 15000) {
  return new Promise((resolve) => {
    const started = Date.now();

    const check = () => {
      const video = document.querySelector('video');
      if (video) {
        resolve(video);
        return;
      }

      if (Date.now() - started >= timeoutMs) {
        resolve(null);
        return;
      }

      setTimeout(check, 250);
    };

    check();
  });
}

function getYouTubeUsername() {
  const candidates = [
    'ytmusic-settings-button tp-yt-paper-tooltip #tooltip',
    '#right-content ytmusic-settings-button #label',
    '#right-content ytmusic-settings-button tp-yt-paper-icon-button[aria-label]',
    'ytmusic-settings-button tp-yt-paper-icon-button[aria-label]',
    'ytmusic-settings-button button[aria-label]',
    'tp-yt-paper-icon-button[aria-label*="Account"]',
    'button[aria-label*="Google Account"]',
    'button[aria-label*="account"]',
    'img[alt][src*="yt3.ggpht.com"]',
    'img[alt][src*="googleusercontent"]',
  ];

  for (const selector of candidates) {
    const el = document.querySelector(selector);
    if (!el) {
      continue;
    }

    const raw = el.getAttribute('aria-label') || el.getAttribute('alt') || el.textContent || '';
    const cleaned = raw
      .replace(/^Google Account:\s*/i, '')
      .replace(/^Account:\s*/i, '')
      .replace(/^Switch account\s*/i, '')
      .replace(/^Open account menu for\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleaned && !/^sign in$/i.test(cleaned)) {
      return cleaned;
    }
  }

  return 'Guest Listener';
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
    .jam-input.compact {
      letter-spacing: 0;
      text-transform: none;
      margin-bottom: 0;
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
    #jam-members {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      padding: 10px 12px;
      display: none;
    }
    .jam-members-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      color: #8f95b2;
      margin-bottom: 8px;
    }
    #jam-members-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .jam-member {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-size: 13px;
      color: #f3f4ff;
    }
    .jam-member-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .jam-member-badge {
      flex-shrink: 0;
      font-size: 10px;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #aeb5ff;
      border: 1px solid rgba(174, 181, 255, 0.25);
      border-radius: 999px;
      padding: 2px 6px;
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
      <input class="jam-input compact" id="jam-name-input" placeholder="Your display name" maxlength="32"/>
      <button class="jam-btn" id="start-jam-btn">Start a New Jam</button>
      <div id="jam-code-display"></div>
      <div class="jam-divider">or join one</div>
      <input class="jam-input" id="jam-code-input" placeholder="Enter 6-digit code" maxlength="6"/>
      <button class="jam-btn outline" id="join-jam-btn">Join Jam</button>
      <div id="jam-members">
        <div class="jam-members-title">Listeners In This Jam</div>
        <div id="jam-members-list"></div>
      </div>
      <div id="jam-status">Connecting...</div>
    </div>
  `;
  (document.body || document.documentElement).appendChild(wrap);

  const hubBtn = document.getElementById('jam-hub-btn');
  const panel = document.getElementById('jam-panel');
  const status = document.getElementById('jam-status');
  const codeDisplay = document.getElementById('jam-code-display');
  const nameInput = document.getElementById('jam-name-input');
  const membersBox = document.getElementById('jam-members');
  const membersList = document.getElementById('jam-members-list');

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

    const storedSession = loadJamSession();
    let roomCode = storedSession.roomCode || null;
    let isExternal = false;
    let seekDebounceTimer = null;
    let autoJoinAttempted = false;
    let localMemberSocketId = null;

    const getLocalUsername = () => {
      const manual = nameInput.value.trim();
      if (manual) {
        return manual;
      }
      const detected = getYouTubeUsername();
      const stored = loadJamSession().username;
      return detected !== 'Guest Listener' ? detected : (stored || 'Guest Listener');
    };

    nameInput.value = storedSession.username || '';

    const renderMembers = (members = []) => {
      if (!roomCode || members.length === 0) {
        membersBox.style.display = 'none';
        membersList.innerHTML = '';
        return;
      }

      membersBox.style.display = 'block';
      membersList.innerHTML = members.map((member) => {
        const safeName = String(member.username || 'Guest Listener')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
        const isYou = member.socketId && member.socketId === localMemberSocketId;
        const badges = [
          member.isHost ? '<span class="jam-member-badge">Host</span>' : '',
          isYou ? '<span class="jam-member-badge">You</span>' : '',
        ].join('');
        return `<div class="jam-member"><span class="jam-member-name">${safeName}</span>${badges}</div>`;
      }).join('');
    };

    const joinRoom = (nextRoomCode, isHost = false) => {
      const username = getLocalUsername();
      roomCode = nextRoomCode;
      saveJamSession({ roomCode, username, isHost });
      socket.emit('join_room', { roomCode, username, isHost });
      codeDisplay.textContent = roomCode;
      codeDisplay.style.display = 'block';
      log(`Joined jam room: ${roomCode} as ${username}`);
    };

    const emitRoomState = (pausedOverride = null) => {
      if (!roomCode) {
        return;
      }

      const video = document.querySelector('video');
      const track = getCurrentTrackInfo();
      socket.emit('sync_state', {
        roomCode,
        url: track.url,
        trackId: track.trackId,
        time: video ? video.currentTime : 0,
        paused: pausedOverride !== null ? pausedOverride : (video ? video.paused : true),
      });
      log(`Shared room state for ${track.trackId || 'unknown track'}`);
    };

    const emitSeekState = () => {
      if (!roomCode) {
        return;
      }

      const video = document.querySelector('video');
      if (!video) {
        return;
      }

      const track = getCurrentTrackInfo();
      socket.emit('seek_music', {
        roomCode,
        time: video.currentTime,
        url: track.url,
        trackId: track.trackId,
        paused: video.paused,
      });
      log(`Shared seek position ${video.currentTime.toFixed(2)}s for ${track.trackId || 'unknown track'}`);
    };

    const applyRemoteState = async (state, forcePlay) => {
      if (!state || !state.url) {
        return;
      }

      isExternal = true;
      isApplyingRemoteState = true;

      try {
        const currentTrack = getCurrentTrackInfo();
        const needsNavigation = state.trackId
          ? currentTrack.trackId !== state.trackId
          : currentTrack.url !== state.url;

        if (needsNavigation) {
          log(`Navigating to synced track ${state.trackId || state.url}`);
          saveJamSession({ roomCode, username: getLocalUsername() });
          window.location.href = state.url;
          return;
        }

        const video = await waitForVideo();
        if (!video) {
          log('Timed out waiting for video element while applying remote state.');
          return;
        }

        if (Math.abs(video.currentTime - state.time) > 1.5) {
          video.currentTime = state.time;
        }

        if (forcePlay || !state.paused) {
          await video.play().catch(() => {});
        } else {
          video.pause();
        }
      } finally {
        setTimeout(() => {
          isExternal = false;
          isApplyingRemoteState = false;
        }, 800);
      }
    };

    socket.on('connect', () => {
      localMemberSocketId = socket.id;
      status.textContent = 'Connected';
      status.style.color = '#43b581';
      log('Connected to jam server.');

      if (roomCode && !autoJoinAttempted) {
        autoJoinAttempted = true;
        joinRoom(roomCode, Boolean(storedSession.isHost));
        status.textContent = 'Rejoined room ' + roomCode;
        status.style.color = '#ffffff';
      }
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
      autoJoinAttempted = true;
      joinRoom(roomCode, true);
      status.textContent = 'You are the DJ. Share the code.';
      status.style.color = '#ffffff';
      log(`Started jam room: ${roomCode}`);
      emitRoomState();
    });

    document.getElementById('join-jam-btn').addEventListener('click', () => {
      const code = document.getElementById('jam-code-input').value.trim().toUpperCase();
      if (!code) {
        return;
      }

      autoJoinAttempted = true;
      joinRoom(code, false);
      status.textContent = 'Joined room ' + roomCode;
      status.style.color = '#ffffff';
    });

    socket.on('room_members', (payload) => {
      if (!payload || payload.roomCode !== roomCode) {
        return;
      }

      const detectedNames = (payload.members || [])
        .map((member) => member.username)
        .filter((name) => name && name !== 'Guest Listener');
      if (detectedNames.length > 0) {
        const exactLocal = payload.members.find((member) => member.socketId === localMemberSocketId);
        if (exactLocal && exactLocal.username && exactLocal.username !== 'Guest Listener') {
          saveJamSession({ roomCode, username: exactLocal.username, isHost: Boolean(exactLocal.isHost) });
          nameInput.value = exactLocal.username;
        }
      }

      renderMembers(payload.members || []);
      log(`Room members updated: ${(payload.members || []).map((member) => member.username).join(', ')}`);
    });

    socket.on('room_state', (state) => {
      if (!roomCode || state.roomCode !== roomCode) {
        return;
      }

      log(`Received room state for ${state.trackId || 'unknown track'}`);
      applyRemoteState(state, !state.paused);
    });

    socket.on('force_play', (state) => {
      if (!roomCode || state.roomCode !== roomCode) {
        return;
      }

      log(`Received force_play for ${state.trackId || 'unknown track'}`);
      applyRemoteState(state, true);
    });

    socket.on('force_pause', (state) => {
      if (!roomCode || state.roomCode !== roomCode) {
        return;
      }

      log(`Received force_pause for ${state.trackId || 'unknown track'}`);
      applyRemoteState(state, false);
    });

    window.setInterval(() => {
      const video = document.querySelector('video');
      if (!video || video._jamHooked) {
        return;
      }

      video._jamHooked = true;
      video.addEventListener('play', () => {
        if (!isExternal && roomCode) {
          const track = getCurrentTrackInfo();
          socket.emit('play_music', {
            roomCode,
            time: video.currentTime,
            url: track.url,
            trackId: track.trackId,
          });
        }
      });
      video.addEventListener('pause', () => {
        if (!isExternal && roomCode) {
          const track = getCurrentTrackInfo();
          socket.emit('pause_music', {
            roomCode,
            time: video.currentTime,
            url: track.url,
            trackId: track.trackId,
          });
        }
      });
      video.addEventListener('seeked', () => {
        if (!isExternal && roomCode && !isApplyingRemoteState) {
          clearTimeout(seekDebounceTimer);
          seekDebounceTimer = setTimeout(() => {
            emitSeekState();
          }, 150);
        }
      });
      log('Video player hooked for sync events.');
    }, 1500);

    window.setInterval(() => {
      if (!roomCode || isExternal) {
        return;
      }

      const nextFingerprint = fingerprintTrack();
      if (nextFingerprint !== lastTrackFingerprint) {
        lastTrackFingerprint = nextFingerprint;
        emitRoomState();
      }
    }, 1200);

    if (roomCode) {
      codeDisplay.textContent = roomCode;
      codeDisplay.style.display = 'block';
      status.textContent = 'Saved room ' + roomCode;
      status.style.color = '#ffffff';
    }
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
