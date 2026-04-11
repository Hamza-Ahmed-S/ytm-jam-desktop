# 🎵 YouTube Music Jam — Desktop App V3

A powerful, custom desktop client for YouTube Music that brings **real-time synchronized listening** (Jam Sessions) to your desktop. Built with Electron and Socket.io, this app bypasses YouTube's strict security policies to inject a beautiful, Discord-style UI directly into the player.

![Jam UI](https://img.shields.io/badge/UI-Glassmorphism-5865F2?style=flat-square)
![Electron](https://img.shields.io/badge/Framework-Electron-47848F?style=flat-square)
![Socket.io](https://img.shields.io/badge/Networking-Socket.io-010101?style=flat-square)

---

## ✨ Features
* **Real-time Syncing:** Start a Jam room and share the 6-digit code with your friends. When the host plays, pauses, or seeks, everyone else in the room synchronizes instantly.
* **Discord-Style UI:** Features a sleek, draggable, glassmorphic floating Hub button that integrates seamlessly on top of YouTube Music.
* **No Ads / Headless Overhead:** Dedicated desktop framing without the clunkiness of a standard browser.
* **Global Cloud Server:** Connected to a live 24/7 WebSocket server hosted on Railway for instant, lag-free event broadcasting.

## 🚀 How to Download & Play
1. Go to the [Releases](../../releases) section on the right side of this page.
2. Download the latest `YouTube-Music-Jam.zip` file.
3. Extract the folder to your desktop.
4. Double-click `electron-jam.exe` to launch the app!
5. Click the glowing blue **Jam Button** in the bottom right, start a session, and share the code with friends!

## 🛠️ For Developers (Build it yourself)

If you want to clone this repo and run it locally to make your own changes:

```bash
# 1. Clone the repository
git clone https://github.com/[Your-Username]/ytm-jam-desktop.git
cd ytm-jam-desktop

# 2. Install dependencies
npm install

# 3. Run the development build
npm start
```

### Architecture
- **`main.js`**: Instantiates the Electron BrowserWindow, strips YouTube's Content-Security-Policy headers via `session.defaultSession.webRequest`, and points to the preload script.
- **`preload.js`**: Runs in an elevated, isolated context before the Single Page Application loads. It injects the custom CSS, builds the DOM elements for the Jam Hub, and establishes the Socket.io WebSocket connection to the cloud server.

### The Backend Server
The WebSockets are handled by an Express/Socket.io Node server. The source code for the server is hosted separately to keep this repository strictly focused on the desktop client.

## 🤝 Contributing
Found a bug or want to add a feature? Feel free to open an Issue or submit a Pull Request! Note that if YouTube updates their DOM layout (`#layout` or `ytmusic-app`), the injection logic in `preload.js` may need to be updated.

---
*Disclaimer: This is a third-party project and is not affiliated with, authorized, maintained, sponsored or endorsed by YouTube or Google.*
