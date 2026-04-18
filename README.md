# YouTube Music Jam

An Electron desktop wrapper for YouTube Music with a real-time **Jam Session** mode, so multiple people can listen together across different PCs.

## What It Does

YouTube Music Jam combines a desktop YouTube Music shell with a Socket.io-powered sync layer that keeps a room aligned on:

- track changes
- play / pause
- seek position
- room membership
- locked vs unlocked room control

The app is designed around real-world recovery, not just happy-path playback. Recent work focused on making **track changes behave like hard resync events** and making **manual recovery** more reliable when YouTube Music's SPA routing gets weird.

## Highlights

- Electron desktop client for YouTube Music
- Real-time jam rooms with 6-character room codes
- Host and listener roles
- Member list with `Host`, `Listener`, and `You` badges
- Locked and unlocked room modes
- Manual display name support
- Manual sync controls:
  - `Sync With Host`
  - `Broadcast Host State`
- Auto rejoin after YouTube Music SPA navigation
- Custom packaged app icon

## How Sync Works

The project uses a split architecture:

- `electron-jam/`
  - Electron client
  - injects the Jam UI into the YouTube Music SPA
  - detects local playback and navigation changes
  - applies remote room state with retry logic
- `server/`
  - Express + Socket.io backend
  - stores room state, room members, and room settings
  - coordinates room-level playback events

### Current Sync Model

- The host is the preferred authority for room recovery.
- In locked mode, only the host should be able to change tracks.
- In unlocked mode, either side should be able to move the room to a new track.
- Track navigation is treated as a stronger sync event than simple play/pause.
- Manual sync requests try to recover:
  - current song
  - timestamp
  - play/pause state

### Recent Reliability Improvements

The latest jam-sync changes focus on desync recovery and SPA timing:

- host-authoritative `request_room_state` flow
- compatibility fallback for older backend request format
- multi-send state bursts for stronger authoritative rebroadcasts
- retry-based remote state application until navigation and media are ready
- smarter recovery around YouTube Music SPA navigation timing
- local track fingerprint refresh after forced sync

## Room Modes

### Locked

- Host controls song changes
- Listeners can still play, pause, and seek inside the current track
- If a listener changes songs, the app should pull them back to the host track

### Unlocked

- Listeners can also change songs
- The room should follow valid track changes from either side

## Manual Recovery Controls

### `Sync With Host`

Shown to listeners. This should force recovery back to the host's current:

- track
- timestamp
- playback state

### `Broadcast Host State`

Shown to hosts. This rebroadcasts the host's current room state to help pull the room back into sync.

## Project Structure

```text
.
|-- electron-jam/
|   |-- main.js
|   |-- preload.js
|   |-- package.json
|   `-- build/icon.ico
|-- server/
|   `-- index.js
|-- dev_log.md
`-- prompt_history.md
```

## Key Files

- `main.js`
  - creates the Electron window
  - removes YouTube Music CSP
  - loads `preload.js`
  - uses the packaged icon
- `preload.js`
  - injects the Jam UI
  - handles Socket.io communication
  - detects and applies playback / track sync
  - contains most of the jam recovery logic
- `../server/index.js`
  - backend room coordination
  - state storage and event rebroadcasting

## Build

From `electron-jam/`:

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

## Packaging Notes

- Runtime icon path: `build/icon.ico`
- `package.json` includes the icon in packaged files
- `main.js` also references the same icon for the app window / taskbar

## Backend Notes

- The backend is deployed on Railway
- If `server/index.js` changes, Railway needs to be redeployed
- Client and backend should stay on matching room-state request behavior for the best sync reliability

## Local-Only Files

These files are for local workflow and should not be pushed to GitHub:

- `../dev_log.md`
- `../prompt_history.md`

## Current Debugging Focus

The app is already beyond basic sync support. The main remaining refinement area is **hard resync reliability** when users drift onto different tracks.

Current focus areas:

- `Sync With Host` reliability
- `Broadcast Host State` reliability
- unlocked listener-to-host track following
- YouTube Music SPA navigation timing
- detecting when navigation is truly complete before time/play state is re-applied

## Dev Workflow Rule

Every code change must be followed by a matching append-only entry in `dev_log.md` that includes:

- timestamp
- what changed
- why it changed
- files affected

## Status

The app currently supports:

- room creation and joining
- track sync
- play/pause sync
- seek sync
- role-aware room UI
- lock mode
- manual recovery controls
- packaged desktop builds

The current work is focused on making jam recovery feel dependable even when YouTube Music's SPA behavior is not.
