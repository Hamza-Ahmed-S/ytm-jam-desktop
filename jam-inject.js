function injectJamUI() {
    if (document.getElementById("jam-hub-btn")) return;

    const style = document.createElement("style");
    style.innerHTML = `
        #jam-hub-btn { position: fixed; bottom: 100px; right: 30px; width: 60px; height: 60px; background: rgba(30, 31, 34, 0.95); backdrop-filter: blur(10px); border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 8px 24px rgba(0,0,0,0.8); border: 1px solid rgba(255,255,255,0.2); z-index: 2147483647; transition: all 0.2s ease; }
        #jam-hub-btn:hover { transform: scale(1.1); background: rgba(88, 101, 242, 1); }
        #jam-panel { position: fixed; bottom: 180px; right: 30px; width: 320px; border-radius: 16px; background: rgba(17, 18, 20, 0.98); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 12px 40px rgba(0,0,0,0.8); z-index: 2147483647; color: white; font-family: 'Inter', 'Roboto', sans-serif; padding: 24px; display: none; flex-direction: column; transform: translateY(20px); transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1); }
        .jam-header { font-size: 18px; font-weight: bold; margin-bottom: 20px; display: flex; align-items: center; gap: 10px; }
        .jam-input { width: 100%; background: rgba(43, 45, 49, 0.8); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 12px 16px; border-radius: 8px; margin-bottom: 15px; font-size: 16px; outline: none; transition: all 0.2s; box-sizing: border-box; }
        .jam-input:focus { border-color: #5865F2; }
        .jam-btn { background: #5865F2; color: white; border: none; padding: 12px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.2s; margin-bottom: 10px; }
        .jam-btn:hover { background: #4752C4; }
        .jam-btn.secondary { background: rgba(255,255,255,0.1); }
        .jam-btn.secondary:hover { background: rgba(255,255,255,0.15); }
        .jam-status { font-size: 14px; color: #949BA4; text-align: center; margin-top: 10px; }
    `;
    document.head.appendChild(style);

    const container = document.createElement("div");
    container.innerHTML = `
        <div id="jam-hub-btn">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM10 16.5V7.5L16 12L10 16.5Z" fill="#FFFFFF"/></svg>
        </div>
        <div id="jam-panel">
            <div class="jam-header">🚀 Jam Session Hub</div>
            <button class="jam-btn" id="start-jam-btn">Start a New Jam</button>
            <div style="margin: 15px 0; text-align: center; color: #949BA4; font-size: 14px;">OR</div>
            <input type="text" class="jam-input" id="jam-code-input" placeholder="Enter 6-Digit Code" />
            <button class="jam-btn secondary" id="join-jam-btn">Join Jam</button>
            <div class="jam-status" id="jam-status">Disconnected</div>
        </div>
    `;
    
    // Append right into the root element so YouTube Polymer doesn't wipe it
    document.documentElement.appendChild(container);

    const btn = document.getElementById("jam-hub-btn");
    const panel = document.getElementById("jam-panel");
    const statusText = document.getElementById("jam-status");
    
    btn.onclick = () => {
        if (panel.style.display === "flex") {
            panel.style.display = "none";
        } else {
            panel.style.display = "flex";
        }
    };

    const script = document.createElement('script');
    script.src = "https://cdn.socket.io/4.7.4/socket.io.min.js";
    document.head.appendChild(script);

    let socket;
    let roomCode = null;
    let isExternalCommand = false;

    script.onload = () => {
        socket = io("http://localhost:3000");

        document.getElementById("start-jam-btn").onclick = () => {
            roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            socket.emit("join_room", roomCode);
            statusText.innerHTML = "Hosting Room: <strong style='color:#5865F2'>" + roomCode + "</strong>";
            statusText.style.color = "white";
            document.getElementById("jam-code-input").value = roomCode;
        };
        
        document.getElementById("join-jam-btn").onclick = () => {
            const input = document.getElementById("jam-code-input").value.trim();
            if(input.length > 0) {
                roomCode = input;
                socket.emit("join_room", roomCode);
                statusText.innerHTML = "Connected to room " + input + "!";
                statusText.style.color = "#43B581"; 
            }
        };

        socket.on('force_play', (time) => {
            const video = document.querySelector('video');
            if(video) {
                isExternalCommand = true; 
                if(Math.abs(video.currentTime - time) > 1.0) {
                    video.currentTime = time; 
                }
                video.play();
                setTimeout(() => { isExternalCommand = false; }, 500);
            }
        });

        socket.on('force_pause', (time) => {
            const video = document.querySelector('video');
            if(video) {
                isExternalCommand = true;
                video.currentTime = time;
                video.pause();
                setTimeout(() => { isExternalCommand = false; }, 500);
            }
        });
    };

    setInterval(() => {
        const video = document.querySelector('video');
        if(video && !video.jamIntercepted) {
            video.jamIntercepted = true;
            video.addEventListener('play', () => {
                if(!isExternalCommand && roomCode && socket) {
                    socket.emit('play_music', { roomCode: roomCode, time: video.currentTime });
                }
            });
            video.addEventListener('pause', () => {
                if(!isExternalCommand && roomCode && socket) {
                    socket.emit('pause_music', { roomCode: roomCode, time: video.currentTime });
                }
            });
        }
    }, 2000);
}

// This makes sure it injects even if the Single Page App rips the DOM apart
setInterval(injectJamUI, 1000);
