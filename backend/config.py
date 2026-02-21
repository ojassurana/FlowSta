from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    openai_api_key: str = ""
    openai_chat_model: str = "gpt-5.2-2025-12-11"
    elevenlabs_api_key: str = ""
    elevenlabs_stt_model_id: str = "scribe_v1"
    page_fetch_timeout: int = 15
    max_content_length: int = 5_000_000

    # EEG settings
    eeg_window_seconds: float = 2.0
    eeg_step_seconds: float = 0.5
    eeg_focus_threshold: float = 1.2
    eeg_sustained_seconds: float = 8.0
    eeg_lsl_timeout: float = 5.0

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
