import edge_tts
import io
from typing import List, Dict

AVAILABLE_VOICES: List[Dict[str, str]] = [
    {"id": "zh-TW-HsiaoChenNeural", "name": "繁體中文（曉臻 - 親切女聲）", "lang": "zh-TW"},
    {"id": "zh-TW-YunJheNeural", "name": "繁體中文（雲哲 - 穩重男聲）", "lang": "zh-TW"},
    {"id": "zh-TW-HsiaoYuNeural", "name": "繁體中文（曉雨 - 活潑女聲）", "lang": "zh-TW"},
    {"id": "en-US-JennyNeural", "name": "English (Jenny - Natural Female)", "lang": "en-US"},
    {"id": "en-US-GuyNeural", "name": "English (Guy - Casual Male)", "lang": "en-US"},
    {"id": "ja-JP-NanamiNeural", "name": "日本語（Nanami - 溫柔女聲）", "lang": "ja-JP"},
]

DEFAULT_VOICE = "zh-TW-HsiaoChenNeural"

async def synthesize_speech(text: str, voice: str = DEFAULT_VOICE) -> bytes:
    """Generate MP3 audio bytes using edge-tts."""
    # Filter text to avoid excessive length for TTS
    trimmed_text = text.strip()
    if len(trimmed_text) > 1000:
        trimmed_text = trimmed_text[:1000] + "..."

    communicate = edge_tts.Communicate(trimmed_text, voice)
    audio_buffer = io.BytesIO()
    
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_buffer.write(chunk["data"])
            
    audio_buffer.seek(0)
    return audio_buffer.read()

