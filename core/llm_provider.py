import json
import httpx
from typing import AsyncIterator, List, Dict, Optional

DEFAULT_OLLAMA_HOST = "http://localhost:11434"

async def get_ollama_models(host: str = DEFAULT_OLLAMA_HOST) -> List[str]:
    """Retrieve list of locally installed Ollama models."""
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            res = await client.get(f"{host.rstrip('/')}/api/tags")
            if res.status_code == 200:
                data = res.json()
                return [m["name"] for m in data.get("models", [])]
    except Exception:
        pass
    return []

async def stream_ollama(
    model: str,
    messages: List[Dict[str, str]],
    host: str = DEFAULT_OLLAMA_HOST
) -> AsyncIterator[str]:
    """Stream chat completions from local Ollama instance."""
    url = f"{host.rstrip('/')}/api/chat"
    payload = {
        "model": model,
        "messages": messages,
        "stream": True
    }
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("POST", url, json=payload) as response:
                if response.status_code != 200:
                    err_text = await response.aread()
                    yield f"❌ Ollama 錯誤 (HTTP {response.status_code}): {err_text.decode('utf-8', errors='ignore')}"
                    return
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    try:
                        chunk = json.loads(line)
                        if "message" in chunk and "content" in chunk["message"]:
                            yield chunk["message"]["content"]
                        if chunk.get("done", False):
                            break
                    except json.JSONDecodeError:
                        continue
    except httpx.ConnectError:
        yield f"❌ 無法連線至本地 Ollama 服務 ({host})。\n請確認您已在電腦中啟動 Ollama！(可在終端機執行 `ollama serve`)"
    except Exception as e:
        yield f"❌ Ollama 發生異常：{str(e)}"

async def stream_gemini(
    model: str,
    messages: List[Dict[str, str]],
    api_key: str
) -> AsyncIterator[str]:
    """Stream chat completions from Google Gemini API."""
    if not api_key:
        yield "❌ 請先在右上角「設定」中填入您的 Google Gemini API Key！"
        return

    # Extract system prompt if present
    system_text = ""
    contents = []
    for msg in messages:
        role = msg.get("role")
        content = msg.get("content", "")
        if role == "system":
            system_text += content + "\n"
        elif role == "user":
            contents.append({"role": "user", "parts": [{"text": content}]})
        elif role == "assistant":
            contents.append({"role": "model", "parts": [{"text": content}]})

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse&key={api_key}"
    payload: Dict = {"contents": contents}
    if system_text.strip():
        payload["systemInstruction"] = {"parts": [{"text": system_text.strip()}]}

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("POST", url, json=payload) as response:
                if response.status_code != 200:
                    err_text = await response.aread()
                    yield f"❌ Gemini API 錯誤 ({response.status_code}): {err_text.decode('utf-8', errors='ignore')}"
                    return
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data_str = line[6:].strip()
                        if not data_str:
                            continue
                        try:
                            data = json.loads(data_str)
                            candidates = data.get("candidates", [])
                            if candidates:
                                parts = candidates[0].get("content", {}).get("parts", [])
                                for part in parts:
                                    if "text" in part:
                                        yield part["text"]
                        except json.JSONDecodeError:
                            continue
    except Exception as e:
        yield f"❌ Gemini API 請求失敗：{str(e)}"

async def stream_openai_compatible(
    model: str,
    messages: List[Dict[str, str]],
    api_key: str,
    base_url: str = "https://api.openai.com/v1"
) -> AsyncIterator[str]:
    """Stream chat completions from OpenAI or OpenAI-compatible endpoint (Groq, DeepSeek, OpenRouter, etc.)."""
    if not api_key and "localhost" not in base_url and "127.0.0.1" not in base_url:
        yield "❌ 請先在右上角「設定」中填入 API Key！"
        return

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}" if api_key else ""
    }
    url = f"{base_url.rstrip('/')}/chat/completions"
    payload = {
        "model": model,
        "messages": messages,
        "stream": True
    }

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("POST", url, headers=headers, json=payload) as response:
                if response.status_code != 200:
                    err_text = await response.aread()
                    yield f"❌ API 請求失敗 (HTTP {response.status_code}): {err_text.decode('utf-8', errors='ignore')}"
                    return
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data_str = line[6:].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            data = json.loads(data_str)
                            delta = data.get("choices", [{}])[0].get("delta", {})
                            content = delta.get("content")
                            if content:
                                yield content
                        except json.JSONDecodeError:
                            continue
    except Exception as e:
        yield f"❌ API 連線錯誤：{str(e)}"

async def stream_chat_response(
    provider: str,
    model: str,
    messages: List[Dict[str, str]],
    config: Dict
) -> AsyncIterator[str]:
    """Unified entrypoint for streaming chat responses."""
    if provider == "ollama":
        host = config.get("ollama_host", DEFAULT_OLLAMA_HOST)
        async for chunk in stream_ollama(model=model, messages=messages, host=host):
            yield chunk
    elif provider == "gemini":
        api_key = config.get("gemini_api_key", "")
        async for chunk in stream_gemini(model=model, messages=messages, api_key=api_key):
            yield chunk
    elif provider in ("openai", "custom"):
        api_key = config.get("openai_api_key", "")
        base_url = config.get("openai_base_url", "https://api.openai.com/v1")
        async for chunk in stream_openai_compatible(model=model, messages=messages, api_key=api_key, base_url=base_url):
            yield chunk
    else:
        yield f"❌ 未知的模型提供者：{provider}"
