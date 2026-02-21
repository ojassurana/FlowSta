from fastapi import APIRouter, HTTPException, UploadFile, File

from backend.models import TranscribeResponse
from backend.services.whisper_client import transcribe_audio

router = APIRouter()


@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_endpoint(audio: UploadFile = File(...)):
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file")

    try:
        transcript = await transcribe_audio(audio_bytes, audio.filename or "audio.webm")
        return TranscribeResponse(transcript=transcript)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Transcription failed: {e}")
