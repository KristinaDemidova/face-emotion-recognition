import base64

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from PIL import Image
import io
# from model import get_model

app = FastAPI(title="ML Image Captioning Service")


@app.get("/health")
async def health_check():
    """Проверка здоровья сервиса."""
    return {"status": "healthy", "service": "ml-service"}


@app.post("/analyze")
async def analyze_image(file: UploadFile = File(...)):
    """
    Принимает изображение и возвращает текстовое описание.
    """
    try:
        # Читаем загруженное изображение
        image_bytes = await file.read()
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

        im_rotate = image.rotate(90)
        rotated_image_bytes = io.BytesIO()
        im_rotate.save(rotated_image_bytes,
                       format='PNG')
        rotated_image_bytes = rotated_image_bytes.getvalue()
        image_base64 = base64.b64encode(rotated_image_bytes).decode('utf-8')

        caption = "Тут обязательно будет текст !!!"

        return JSONResponse(content={
            "success": True,
            "caption": caption,
            "image": image_base64,
            "filename": file.filename
        })

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8001)
