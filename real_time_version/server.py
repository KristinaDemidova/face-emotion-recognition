import asyncio
import zmq
import zmq.asyncio
from fastapi import FastAPI, WebSocket, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from starlette.websockets import WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
import uvicorn

ZMQ_SENDER_ADDRESS = "tcp://localhost:5555"  # Куда шлюз отправляет кадры
ZMQ_RECEIVER_ADDRESS = "tcp://localhost:5556"  # Откуда шлюз получает результаты

app = FastAPI()
templates = Jinja2Templates(directory="templates")


ctx = zmq.asyncio.Context()
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    """Отдаёт главную HTML-страницу."""
    return templates.TemplateResponse("index.html", {"request": request})

async def forward_to_zmq(websocket: WebSocket, zmq_sender: zmq.Socket):
    """Читает кадры из WebSocket и пересылает в ZMQ."""
    try:
        while True:
            jpeg_bytes = await websocket.receive_bytes()
            await zmq_sender.send(jpeg_bytes)
    except WebSocketDisconnect:
        print("Клиент (браузер) отключился.")


async def forward_to_browser(websocket: WebSocket, zmq_receiver: zmq.Socket):
    """Читает результаты из ZMQ и пересылает в WebSocket."""
    try:
        while True:
            json_bytes = await zmq_receiver.recv()
            await websocket.send_text(json_bytes.decode('utf-8'))
    except asyncio.CancelledError:
        print("Задача получения из ZMQ отменена.")


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Обрабатывает одно WebSocket-соединение."""
    await websocket.accept()
    print("Клиент подключен к шлюзу.")

    zmq_sender = ctx.socket(zmq.PUSH)
    zmq_sender.connect(ZMQ_SENDER_ADDRESS)

    zmq_receiver = ctx.socket(zmq.PULL)
    zmq_receiver.bind(ZMQ_RECEIVER_ADDRESS)

    task_ws_to_zmq = asyncio.create_task(forward_to_zmq(websocket, zmq_sender))
    task_zmq_to_ws = asyncio.create_task(forward_to_browser(websocket, zmq_receiver))

    done, pending = await asyncio.wait(
        [task_ws_to_zmq, task_zmq_to_ws],
        return_when=asyncio.FIRST_COMPLETED,
    )

    for task in pending:
        task.cancel()

    zmq_sender.close()
    zmq_receiver.close()

    print("Соединение с клиентом завершено, ресурсы очищены.")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
