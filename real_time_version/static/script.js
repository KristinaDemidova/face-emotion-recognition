/* static/script.js */
const video = document.getElementById('video-feed');
const processedCanvas = document.getElementById('processed-canvas');
const processedCtx = processedCanvas.getContext('2d');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');

const FRAME_SKIP = 5;

let stream, websocket, isStreaming = false, frameCounter = 0;

async function startStreaming() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        video.srcObject = stream;
        isStreaming = true;

        video.onloadedmetadata = () => {
            const videoWidth = video.videoWidth;
            const videoHeight = video.videoHeight;
            video.width = videoWidth;
            video.height = videoHeight;
            processedCanvas.width = videoWidth;
            processedCanvas.height = videoHeight;

            processedCtx.fillStyle = 'black';
            processedCtx.fillRect(0, 0, videoWidth, videoHeight);
            processedCtx.fillStyle = 'white';
            processedCtx.textAlign = 'center';
            processedCtx.font = '18px sans-serif';
            processedCtx.fillText('Ожидание данных...', videoWidth / 2, videoHeight / 2);

            startBtn.disabled = true;
            stopBtn.disabled = false;

            const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            websocket = new WebSocket(`${wsProtocol}//${window.location.host}/ws`);

            websocket.onopen = () => {
                console.log("WebSocket соединение установлено.");
                requestAnimationFrame(videoLoop);
            };

            websocket.onmessage = (event) => {
                const boxes = JSON.parse(event.data);
                drawProcessedFrame(boxes);
            };

            websocket.onclose = () => { console.log("WebSocket соединение закрыто."); stopStreaming(); };
            websocket.onerror = (error) => { console.error("WebSocket ошибка:", error); stopStreaming(); };
        };

    } catch (err) {
        console.error("Ошибка доступа к камере: ", err);
        alert("Не удалось получить доступ к камере.");
    }
}

function stopStreaming() {
    isStreaming = false;
    if (websocket) websocket.close();
    if (stream) stream.getTracks().forEach(track => track.stop());
    video.srcObject = null;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    websocket = null; stream = null; frameCounter = 0;
}

function videoLoop() {
    if (!isStreaming) return;
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        frameCounter++;
        if (frameCounter % FRAME_SKIP === 0) {
            sendFrame();
        }
    }
    requestAnimationFrame(videoLoop);
}

function sendFrame() {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);

    tempCanvas.toBlob((blob) => {
        if (blob && websocket && websocket.readyState === WebSocket.OPEN) {
            websocket.send(blob);
        }
    }, 'image/jpeg', 0.7);
}

function drawProcessedFrame(boxes) {
    processedCtx.drawImage(video, 0, 0, processedCanvas.width, processedCanvas.height);

    processedCtx.strokeStyle = '#32CD32';
    processedCtx.lineWidth = 3;
    processedCtx.font = '18px sans-serif';
    processedCtx.textAlign = 'left';

    boxes.forEach(box => {
        const x1 = Math.round(box.x1);
        const y1 = Math.round(box.y1);
        const width = Math.round(box.x2 - x1);
        const height = Math.round(box.y2 - y1);

        processedCtx.strokeRect(x1, y1, width, height);

        if (box.label && box.conf) {
            const confidencePercent = (box.conf * 100).toFixed(0);
            const label = `${box.label}: ${confidencePercent}%`;

            const textMetrics = processedCtx.measureText(label);
            const textHeight = 24;
            const textY = y1 > textHeight ? y1 - textHeight : y1;
            processedCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            processedCtx.fillRect(x1, textY, textMetrics.width + 8, textHeight);

            processedCtx.fillStyle = '#32CD32';
            processedCtx.fillText(label, x1 + 4, textY + 18);
        }
    });
}

startBtn.addEventListener('click', startStreaming);
stopBtn.addEventListener('click', stopStreaming);
