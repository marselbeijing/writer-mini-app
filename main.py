from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import shutil
import whisper # Импортируем whisper
import ollama # Импортируем ollama

app = FastAPI()

# Настройка CORS
origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Загружаем модель Whisper при старте сервера
# Используем модель "base" - она достаточно качественная и не слишком требовательная к ресурсам
print("Загрузка модели Whisper 'base'...")
model = whisper.load_model("base")
print("Модель Whisper загружена.")


# Создаем папку для временного хранения аудио
if not os.path.exists("temp_audio"):
    os.makedirs("temp_audio")

# Pydantic-модель для входящих данных на улучшение текста
class TextImproveRequest(BaseModel):
    text: str
    action: str # Например, 'cleanup' или 'grammar'

@app.post("/upload_audio/")
async def upload_audio(audio: UploadFile = File(...)):
    """
    Принимает аудиофайл, транскрибирует его с помощью Whisper
    и возвращает распознанный текст.
    """
    temp_file_path = os.path.join("temp_audio", audio.filename)
    
    try:
        # Сохраняем загруженный файл на диск
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(audio.file, buffer)
        
        # Транскрибируем аудиофайл
        result = model.transcribe(temp_file_path, fp16=False) # fp16=False для лучшей совместимости с CPU
        transcribed_text = result["text"]
        
        return {"transcription": transcribed_text}
    
    except Exception as e:
        return {"error": str(e)}
    finally:
        # Убедимся, что файл-объект закрыт
        await audio.close()
        # Удаляем временный файл после обработки
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

@app.post("/improve_text/")
async def improve_text(request: TextImproveRequest):
    """
    Принимает текст и задачу, отправляет в Ollama для обработки
    и возвращает улучшенный текст.
    """
    system_prompt = ""
    if request.action == "cleanup":
        system_prompt = "Ты — редактор, который убирает из текста слова-паразиты, эканья, запинки и повторы. Сделай текст чистым и лаконичным, но сохрани оригинальный смысл и стиль автора. Не добавляй ничего от себя. Просто верни исправленный текст."
    elif request.action == "grammar":
        system_prompt = "Ты — строгий корректор. Исправь в этом тексте все грамматические, пунктуационные и орфографические ошибки. Не меняй стиль и смысл. Просто верни исправленный текст."

    if not system_prompt:
        return {"error": "Unknown action"}

    try:
        response = ollama.chat(
            model='llama3', # Убедитесь, что эта модель скачана через 'ollama pull llama3'
            messages=[
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': request.text},
            ],
        )
        improved_text = response['message']['content']
        return {"improved_text": improved_text}
    except Exception as e:
        return {"error": f"Ошибка при обращении к Ollama: {str(e)}"}


@app.get("/")
def read_root():
    return {"message": "Сервер для транскрибации голоса работает"}
