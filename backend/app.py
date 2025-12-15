from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import httpx
from PIL import Image
import io

app = FastAPI(title="Photo Analysis API Gateway")

# Настройка CORS для фронтенда
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # В продакшене замените на конкретный домен
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ML_SERVICE_URL = "http://ml-service:8001"  # Имя сервиса в Docker Compose


@app.get("/")
async def root():
    return {"message": "Photo Analysis API Gateway", "status": "running"}


@app.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    """
    Принимает изображение от фронтенда, отправляет в ML-сервис,
    возвращает результат.
    """
    # Валидация типа файла
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    try:
        image_bytes = await file.read()
        image = Image.open(io.BytesIO(image_bytes))

        if len(image_bytes) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Image too large (max 10MB)")

        # Отправляем запрос в ML-сервис
        async with httpx.AsyncClient(timeout=60.0) as client:
            files = {"file": (file.filename, image_bytes, file.content_type)}
            response = await client.post(f"{ML_SERVICE_URL}/analyze", files=files)
            response.raise_for_status()

        result = response.json()

        image_bytes_out = 'data:image/jpeg;base64,' + result['image']

        return JSONResponse(content={
            "success": True,
            "caption": result["caption"],
            "image": image_bytes_out,
            "original_filename": file.filename
        })

    except httpx.HTTPError as e:
        raise HTTPException(status_code=503, detail=f"ML service unavailable: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
