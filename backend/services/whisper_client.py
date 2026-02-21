import mimetypes

import httpx

from backend.config import get_settings


async def transcribe_audio(audio_bytes: bytes, filename: str) -> str:
    """Send audio to ElevenLabs Speech-to-Text API and return the transcript."""
    settings = get_settings()
    if not settings.elevenlabs_api_key:
        raise ValueError("Missing ELEVENLABS_API_KEY")

    content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"

    async with httpx.AsyncClient(timeout=httpx.Timeout(60.0)) as client:
        response = await client.post(
            "https://api.elevenlabs.io/v1/speech-to-text",
            headers={
                "xi-api-key": settings.elevenlabs_api_key,
                "Accept": "application/json",
            },
            data={"model_id": settings.elevenlabs_stt_model_id},
            files={"file": (filename, audio_bytes, content_type)},
        )

    if response.status_code >= 400:
        detail = response.text.strip()
        raise RuntimeError(f"ElevenLabs STT failed ({response.status_code}): {detail}")

    payload = response.json()
    transcript = (payload.get("text") or payload.get("transcript") or "").strip()
    if not transcript:
        raise RuntimeError("ElevenLabs STT returned an empty transcript")

    return transcript
