import json
import time
import httpx
from typing import AsyncIterator, List, Dict, Optional, Any

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

async def get_gemini_models(api_key: str) -> List[str]:
    """Retrieve list of available Google Gemini models."""
    fallback_models = ["gemini-2.5-pro", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"]
    if not api_key:
        return fallback_models
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.get(url)
            if res.status_code == 200:
                data = res.json()
                models = []
                for m in data.get("models", []):
                    methods = m.get("supportedGenerationMethods", [])
                    if "generateContent" in methods:
                        name = m.get("name", "")
                        if name.startswith("models/"):
                            name = name[7:]
                        models.append(name)
                if models:
                    return models
    except Exception:
        pass
    return fallback_models

async def get_openai_compatible_models(base_url: str = "https://api.openai.com/v1", api_key: str = "") -> List[str]:
    """Retrieve list of models from OpenAI or compatible endpoint (DeepSeek, Groq, OpenRouter, etc.)."""
    clean_url = (base_url or "https://api.openai.com/v1").rstrip("/")
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    is_deepseek = "deepseek" in clean_url.lower()

    urls_to_try = [f"{clean_url}/models"]
    if clean_url.endswith("/v1"):
        urls_to_try.append(f"{clean_url[:-3]}/models")
    else:
        urls_to_try.append(f"{clean_url}/v1/models")

    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            for u in urls_to_try:
                try:
                    res = await client.get(u, headers=headers)
                    if res.status_code == 200:
                        data = res.json()
                        models = [m["id"] for m in data.get("data", []) if "id" in m]
                        if is_deepseek:
                            for km in reversed(["deepseek-chat", "deepseek-reasoner"]):
                                if km in models:
                                    models.remove(km)
                                models.insert(0, km)
                        if models:
                            return models
                except Exception:
                    continue
    except Exception:
        pass

    if is_deepseek:
        return ["deepseek-chat", "deepseek-reasoner", "deepseek-flash", "deepseek-v4-pro"]
    elif "groq" in clean_url.lower():
        return ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"]
    return ["gpt-4o", "gpt-4o-mini", "o1", "o3-mini", "deepseek-chat"]

async def test_provider_connection(
    provider: str,
    ollama_host: str = DEFAULT_OLLAMA_HOST,
    gemini_api_key: str = "",
    openai_api_key: str = "",
    openai_base_url: str = "https://api.openai.com/v1"
) -> Dict[str, Any]:
    """Test connection to the specified AI model provider and return available models."""
    t0 = time.time()

    if provider == "ollama":
        host = (ollama_host or DEFAULT_OLLAMA_HOST).rstrip("/")
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(f"{host}/api/tags")
                latency = int((time.time() - t0) * 1000)
                if res.status_code == 200:
                    data = res.json()
                    models = [m["name"] for m in data.get("models", [])]
                    if models:
                        return {
                            "success": True,
                            "latency_ms": latency,
                            "models": models,
                            "message": f"Ollama 連線正常！共檢測到 {len(models)} 個已安裝模型。"
                        }
                    else:
                        return {
                            "success": True,
                            "latency_ms": latency,
                            "models": [],
                            "message": "Ollama 服務運作中，但尚未安裝任何模型 (可在終端機執行 `ollama pull llama3`)。"
                        }
                return {
                    "success": False,
                    "latency_ms": latency,
                    "models": [],
                    "message": f"Ollama 回應狀態碼異常 (HTTP {res.status_code})"
                }
        except httpx.ConnectError:
            return {
                "success": False,
                "latency_ms": 0,
                "models": [],
                "message": f"無法連線至本地 Ollama ({host})。請確認已啟動 Ollama 服務 (可執行 `ollama serve`)。"
            }
        except Exception as e:
            return {
                "success": False,
                "latency_ms": 0,
                "models": [],
                "message": f"連線異常: {str(e)}"
            }

    elif provider == "gemini":
        if not gemini_api_key:
            return {
                "success": False,
                "latency_ms": 0,
                "models": [],
                "message": "請先填寫 Google Gemini API Key！"
            }
        url = f"https://generativelanguage.googleapis.com/v1beta/models?key={gemini_api_key}"
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.get(url)
                latency = int((time.time() - t0) * 1000)
                if res.status_code == 200:
                    data = res.json()
                    models = []
                    for m in data.get("models", []):
                        if "generateContent" in m.get("supportedGenerationMethods", []):
                            name = m.get("name", "")
                            if name.startswith("models/"):
                                name = name[7:]
                            models.append(name)
                    return {
                        "success": True,
                        "latency_ms": latency,
                        "models": models,
                        "message": f"Google Gemini 連線成功！共取得 {len(models)} 個可用模型。"
                    }
                elif res.status_code in (400, 403):
                    return {
                        "success": False,
                        "latency_ms": latency,
                        "models": [],
                        "message": f"API Key 驗證失敗 (HTTP {res.status_code})，請確認金鑰是否有效或啟用權限。"
                    }
                return {
                    "success": False,
                    "latency_ms": latency,
                    "models": [],
                    "message": f"Gemini API 請求失敗 (HTTP {res.status_code})"
                }
        except Exception as e:
            return {
                "success": False,
                "latency_ms": 0,
                "models": [],
                "message": f"無法連線至 Google Gemini API: {str(e)}"
            }

    elif provider in ("openai", "custom"):
        clean_url = (openai_base_url or "https://api.openai.com/v1").rstrip("/")
        if not openai_api_key and "localhost" not in clean_url and "127.0.0.1" not in clean_url:
            return {
                "success": False,
                "latency_ms": 0,
                "models": [],
                "message": "請先填寫 API Key！"
            }

        headers = {"Content-Type": "application/json"}
        if openai_api_key:
            headers["Authorization"] = f"Bearer {openai_api_key}"

        is_deepseek = "deepseek" in clean_url.lower()

        urls_to_try = [f"{clean_url}/models"]
        if clean_url.endswith("/v1"):
            urls_to_try.append(f"{clean_url[:-3]}/models")
        else:
            urls_to_try.append(f"{clean_url}/v1/models")

        last_error = ""
        last_status = None
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                for u in urls_to_try:
                    try:
                        res = await client.get(u, headers=headers)
                        latency = int((time.time() - t0) * 1000)
                        last_status = res.status_code
                        if res.status_code == 200:
                            data = res.json()
                            models = [m["id"] for m in data.get("data", []) if "id" in m]
                            if is_deepseek:
                                for km in reversed(["deepseek-chat", "deepseek-reasoner"]):
                                    if km in models:
                                        models.remove(km)
                                    models.insert(0, km)
                            provider_name = "DeepSeek" if is_deepseek else "OpenAI 相容服務"
                            return {
                                "success": True,
                                "latency_ms": latency,
                                "models": models,
                                "message": f"{provider_name} 連線成功！共取得 {len(models)} 個可用模型。"
                            }
                        elif res.status_code == 401:
                            return {
                                "success": False,
                                "latency_ms": latency,
                                "models": [],
                                "message": "API 認證失敗 (HTTP 401)：無效的 API Key，請檢查金鑰是否有誤。"
                            }
                        elif res.status_code == 403:
                            return {
                                "success": False,
                                "latency_ms": latency,
                                "models": [],
                                "message": "API 存取被拒絕 (HTTP 403)，請確認帳號額度或權限。"
                            }
                    except Exception as e:
                        last_error = str(e)
                        continue
        except Exception as e:
            last_error = str(e)

        # Fallback chat test if /models endpoint is disabled
        try:
            test_model = "deepseek-chat" if is_deepseek else "gpt-4o-mini"
            chat_url = f"{clean_url}/chat/completions"
            async with httpx.AsyncClient(timeout=10.0) as client:
                test_payload = {
                    "model": test_model,
                    "messages": [{"role": "user", "content": "hi"}],
                    "max_tokens": 1
                }
                res = await client.post(chat_url, headers=headers, json=test_payload)
                latency = int((time.time() - t0) * 1000)
                if res.status_code == 200:
                    models = ["deepseek-chat", "deepseek-reasoner"] if is_deepseek else ["gpt-4o", "gpt-4o-mini"]
                    return {
                        "success": True,
                        "latency_ms": latency,
                        "models": models,
                        "message": "連線測試成功 (對話測試通過)！已載入常用模型列表。"
                    }
        except Exception:
            pass

        return {
            "success": False,
            "latency_ms": 0,
            "models": [],
            "message": "連線失敗" + (f" (HTTP {last_status})" if last_status else "") + (f": {last_error}" if last_error else "，請檢查 Base URL 與 API Key 是否正確。")
        }

    return {
        "success": False,
        "latency_ms": 0,
        "models": [],
        "message": f"未知的模型提供者: {provider}"
    }

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
                reasoning_active = False
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data_str = line[6:].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            data = json.loads(data_str)
                            delta = data.get("choices", [{}])[0].get("delta", {})
                            reasoning = delta.get("reasoning_content")
                            content = delta.get("content")

                            if reasoning:
                                if not reasoning_active:
                                    reasoning_active = True
                                    yield "> 💭 **深度思考過程：**\n> "
                                yield reasoning.replace("\n", "\n> ")

                            if content:
                                if reasoning_active:
                                    reasoning_active = False
                                    yield "\n\n---\n\n"
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

