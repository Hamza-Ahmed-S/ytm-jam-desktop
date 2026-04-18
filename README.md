# YouTube Music Jam

An Electron desktop app that wraps **YouTube Music** and adds a real-time **Jam Session** system so friends can listen together across different PCs.

![Electron](https://img.shields.io/badge/Built%20With-Electron-1f6feb?style=for-the-badge)
![Socket.io](https://img.shields.io/badge/Realtime-Socket.io-111111?style=for-the-badge)
![Platform](https://img.shields.io/badge/Platform-Windows-ea4c89?style=for-the-badge)

## 🎵 What This Project Is

YouTube Music Jam turns YouTube Music into a shared listening app with live room sync.

With a Jam room, users can:

- create or join a session with a 6-character room code
- sync play and pause events in real time
- sync seek position
- sync track changes
- see who is in the room
- choose whether the room is host-controlled or collaborative

The goal is simple: make YouTube Music feel like a real desktop watch-party style experience instead of just a browser tab.

## ✨ Main Features

- Real-time Jam rooms
- Host and listener roles
- Member list with `Host`, `Listener`, and `You` badges
- Locked and unlocked room modes
- Manual display name support
- `Sync With Host` button for listeners
- `Broadcast Host State` button for hosts
- Auto rejoin after YouTube Music SPA navigation
- Custom packaged desktop icon

## 🧠 Sync Model

The app uses a split client/server setup:

- `electron-jam/`
  - Electron desktop client
  - injects the Jam UI into the YouTube Music SPA
  - watches playback, navigation, and room state
  - applies remote sync with retry logic
- `server/`
  - Express + Socket.io backend
  - tracks room members, playback state, and room settings
  - rebroadcasts room updates in real time

### 🔒 Locked Rooms

- Host controls track changes
- Listeners can still seek, play, and pause inside the current song
- If a listener changes tracks, the app should pull them back to the host track

### 🔓 Unlocked Rooms

- Listeners can also change tracks
- Valid track changes should be able to move the whole room

## 🚀 Recent Sync Improvements

The latest work has focused on making desync recovery much stronger, especially around YouTube Music's SPA behavior.

Recent improvements include:

- host-authoritative room-state requests
- compatibility fallback for older backend request handling
- stronger rebroadcast bursts for authoritative room state
- retry-based remote track and playback application
- smarter handling after YouTube navigation events
- better recovery when host and listener drift onto different tracks

## 🛠 Manual Recovery

### `Sync With Host`

Listeners can press this to force recovery back to the host's:

- current track
- timestamp
- playback state

### `Broadcast Host State`

Hosts can press this to rebroadcast their current room state and pull the room back into sync.

## 🧱 Project Structure

```text
electron-jam/
|-- main.js
|-- preload.js
|-- package.json
`-- build/icon.ico

server/
`-- index.js
```

## 📁 Important Files

- `main.js`
  - creates the Electron window
  - removes YouTube Music CSP restrictions
  - loads the preload script
  - applies the packaged app icon
- `preload.js`
  - injects the Jam UI into YouTube Music
  - manages Socket.io communication
  - handles playback sync, track sync, and recovery logic
- `server/index.js`
  - manages room state
  - tracks members and settings
  - handles room-wide playback events

## 🏗 Build

From inside `electron-jam/`:

```powershell
npm install
npm run build
```

Current build command:

```powershell
electron-builder --win --x64 --config.win.signAndEditExecutable=false
```

Build artifact:

```text
YouTube Music Jam.exe
```

## 📦 Packaging Notes

- App icon path: `build/icon.ico`
- `package.json` includes the icon in packaged files
- `main.js` uses the same icon at runtime for the desktop window and taskbar

## 🌐 Backend Notes

- The backend is deployed on Railway
- If `server/index.js` changes, Railway must be redeployed
- Best results happen when both the client and backend are running matching sync logic

## 🔍 Current Focus

The app already supports full jam rooms and recovery tools. The main refinement work right now is around **hard resync reliability**.

Current focus areas:

- `Sync With Host` consistency
- `Broadcast Host State` consistency
- unlocked listener-to-host track following
- YouTube Music SPA navigation timing
- applying track, time, and play state only after navigation is truly ready

## 📌 Status

The app currently supports:

- room creation and joining
- track sync
- play/pause sync
- seek sync
- role-aware room UI
- lock mode
- manual recovery controls
- packaged desktop builds

This project is actively being refined to make jam sessions feel solid even when YouTube Music navigation gets messy.
