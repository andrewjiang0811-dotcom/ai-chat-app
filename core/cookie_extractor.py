import os
import re
import json
import base64
import sqlite3
import shutil
import tempfile
from typing import Dict, Any, Optional, Tuple

try:
    from Cryptodome.Cipher import AES
    import win32crypt
    HAS_CRYPTO = True
except ImportError:
    HAS_CRYPTO = False


def parse_cookie_string(raw: str) -> Dict[str, str]:
    """
    從任意文字（包括 Request Header、cURL、F12 複製的字串或換行文字）中
    自動擷取 __Secure-1PSID, __Secure-1PSIDTS, __Secure-1PSIDCC
    """
    result = {}
    if not raw or not isinstance(raw, str):
        return result

    # 1. 嘗試直接正則提取
    patterns = {
        "__Secure-1PSID": r"__Secure-1PSID=([^;,\s\"\']+)",
        "__Secure-1PSIDTS": r"__Secure-1PSIDTS=([^;,\s\"\']+)",
        "__Secure-1PSIDCC": r"__Secure-1PSIDCC=([^;,\s\"\']+)"
    }

    for key, pattern in patterns.items():
        match = re.search(pattern, raw)
        if match:
            result[key] = match.group(1).strip()

    # 2. 如果沒有 match 到完整 key=val，但包含純換行（例如使用者貼上三行）
    if len(result) < 3:
        lines = [line.strip() for line in raw.strip().splitlines() if line.strip()]
        for line in lines:
            if "=" in line:
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip().rstrip(";")
                if k in patterns and k not in result:
                    result[k] = v
            else:
                # 判斷特徵值
                if line.startswith("g.a000") and "__Secure-1PSID" not in result:
                    result["__Secure-1PSID"] = line
                elif line.startswith("sidts-") and "__Secure-1PSIDTS" not in result:
                    result["__Secure-1PSIDTS"] = line
                elif (line.startswith("AKE") or len(line) < 120) and "__Secure-1PSIDCC" not in result and not line.startswith("g.a000") and not line.startswith("sidts-"):
                    result["__Secure-1PSIDCC"] = line

    return result


def _get_chromium_master_key(local_state_path: str) -> Optional[bytes]:
    if not HAS_CRYPTO or not os.path.exists(local_state_path):
        return None
    try:
        with open(local_state_path, "r", encoding="utf-8") as f:
            local_state = json.load(f)
        encrypted_key = base64.b64decode(local_state["os_crypt"]["encrypted_key"])
        # Remove 'DPAPI' prefix (first 5 bytes)
        encrypted_key = encrypted_key[5:]
        decrypted_key = win32crypt.CryptUnprotectData(encrypted_key, None, None, None, 0)[1]
        return decrypted_key
    except Exception:
        return None


def _decrypt_chromium_cookie_value(enc_val: bytes, master_key: bytes) -> str:
    if not enc_val:
        return ""
    try:
        if enc_val.startswith(b"v10") or enc_val.startswith(b"v11"):
            nonce = enc_val[3:15]
            ciphertext = enc_val[15:-16]
            tag = enc_val[-16:]
            cipher = AES.new(master_key, AES.MODE_GCM, nonce=nonce)
            val = cipher.decrypt_and_verify(ciphertext, tag)
            return val.decode("utf-8", errors="ignore")
        elif HAS_CRYPTO:
            val = win32crypt.CryptUnprotectData(enc_val, None, None, None, 0)[1]
            return val.decode("utf-8", errors="ignore")
    except Exception:
        pass
    return ""


def extract_from_cdp(port: int = 9222) -> Tuple[bool, Dict[str, str], str]:
    """
    透過 Chrome DevTools Protocol (CDP) 遠端偵錯埠
    直接從正在運行的無痕視窗（Incognito / InPrivate）記憶體中讀取 Cookie！
    零硬碟存取、不受檔案鎖定限制！
    """
    import asyncio
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import nest_asyncio
            nest_asyncio.apply()
            return loop.run_until_complete(_extract_from_cdp_async(port))
        else:
            return asyncio.run(_extract_from_cdp_async(port))
    except RuntimeError:
        return asyncio.run(_extract_from_cdp_async(port))
    except Exception as e:
        return False, {}, f"CDP 檢測失敗: {e}"


async def _extract_from_cdp_async(port: int = 9222) -> Tuple[bool, Dict[str, str], str]:
    try:
        import aiohttp
    except ImportError:
        return False, {}, "缺少 aiohttp 模組"

    url = f"http://127.0.0.1:{port}/json"
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=1.5)) as resp:
                if resp.status != 200:
                    return False, {}, "CDP 埠未回應"
                tabs = await resp.json()
                if not tabs:
                    return False, {}, "未找到開啟中的分頁"
                
                # 優先挑選 gemini 分頁，若無則挑第一個具備 websocket 的頁面
                ws_url = None
                for t in tabs:
                    if "webSocketDebuggerUrl" in t:
                        ws_url = t["webSocketDebuggerUrl"]
                        if "gemini.google.com" in t.get("url", ""):
                            break
                
                if not ws_url:
                    return False, {}, "無可用 WebSocket 除錯端點"

                async with session.ws_connect(ws_url, timeout=aiohttp.ClientTimeout(total=2)) as ws:
                    req_id = 888
                    await ws.send_json({"id": req_id, "method": "Network.getAllCookies"})
                    async for msg in ws:
                        if msg.type == aiohttp.WSMsgType.TEXT:
                            data = json.loads(msg.data)
                            if data.get("id") == req_id:
                                cookies_list = data.get("result", {}).get("cookies", [])
                                found = {}
                                for c in cookies_list:
                                    if "google.com" in c.get("domain", "") and c.get("name") in (
                                        "__Secure-1PSID", "__Secure-1PSIDTS", "__Secure-1PSIDCC"
                                    ):
                                        found[c["name"]] = c["value"]
                                if "__Secure-1PSID" in found:
                                    return True, found, f"成功從正在執行的無痕瀏覽器 (CDP Port {port}) 即時抓取最新 Cookie！"
                                break
    except Exception:
        pass
    return False, {}, f"未在 Port {port} 偵測到無痕除錯瀏覽器"


def extract_from_local_browsers(custom_paths: Optional[list] = None) -> Tuple[bool, Dict[str, str], str]:
    """
    掃描本機常見瀏覽器 (Edge, Chrome, Brave) 及自訂 Profile 的 Google Cookie。
    回傳 (成功與否, cookies字典, 訊息)
    """
    appdata = os.path.expanduser("~")
    browser_targets = []
    
    # 優先加入自訂 Profile（例如專用開發目錄）
    if custom_paths:
        for p in custom_paths:
            if os.path.exists(p):
                browser_targets.append({"name": "CustomDevProfile", "user_data": p, "type": "chromium"})

    browser_targets.extend([
        {
            "name": "Edge",
            "user_data": os.path.join(appdata, "AppData", "Local", "Microsoft", "Edge", "User Data"),
            "type": "chromium"
        },
        {
            "name": "Chrome",
            "user_data": os.path.join(appdata, "AppData", "Local", "Google", "Chrome", "User Data"),
            "type": "chromium"
        },
        {
            "name": "Brave",
            "user_data": os.path.join(appdata, "AppData", "Local", "BraveSoftware", "Brave-Browser", "User Data"),
            "type": "chromium"
        }
    ])

    last_locked_browser = None

    for b in browser_targets:
        user_data = b["user_data"]
        if not os.path.exists(user_data):
            continue

        local_state_path = os.path.join(user_data, "Local State")
        master_key = _get_chromium_master_key(local_state_path)
        if not master_key:
            continue

        # 搜尋所有 Profiles (Default, Profile 1, Profile 2...)
        profiles = ["Default"]
        try:
            for entry in os.listdir(user_data):
                if entry.startswith("Profile ") and os.path.isdir(os.path.join(user_data, entry)):
                    profiles.append(entry)
        except Exception:
            pass

        for prof in profiles:
            cookie_path = os.path.join(user_data, prof, "Network", "Cookies")
            if not os.path.exists(cookie_path):
                continue

            temp_dir = tempfile.mkdtemp()
            temp_cookie = os.path.join(temp_dir, "Cookies")
            try:
                shutil.copy2(cookie_path, temp_cookie)
                conn = sqlite3.connect(temp_cookie)
                cursor = conn.cursor()
                query = """
                    SELECT name, encrypted_value, host_key 
                    FROM cookies 
                    WHERE host_key LIKE '%google.com' 
                    AND name IN ('__Secure-1PSID', '__Secure-1PSIDTS', '__Secure-1PSIDCC')
                """
                cursor.execute(query)
                rows = cursor.fetchall()
                found = {}
                for name, enc_val, _ in rows:
                    val = _decrypt_chromium_cookie_value(enc_val, master_key)
                    if val and name not in found:
                        found[name] = val
                conn.close()
                shutil.rmtree(temp_dir, ignore_errors=True)

                if "__Secure-1PSID" in found:
                    return True, found, f"成功從本機 {b['name']} ({prof}) 讀取最新 Gemini Cookie！"
            except PermissionError:
                shutil.rmtree(temp_dir, ignore_errors=True)
                last_locked_browser = b["name"]
            except Exception as e:
                shutil.rmtree(temp_dir, ignore_errors=True)

    if last_locked_browser:
        return False, {}, (
            f"偵測到 {last_locked_browser} 瀏覽器目前正在執行中，其 Cookie 檔案被系統獨佔鎖定。"
        )

    return False, {}, "未在常見瀏覽器路徑中找到登入中的 Google Gemini Cookie。"


def _save_synced_cookies(config_file: str, cookie_file: str, cookies: Dict[str, str]):
    if not cookies:
        return
    if os.path.exists(config_file):
        try:
            with open(config_file, "r", encoding="utf-8") as f:
                cfg = json.load(f)
            cfg["gemini_web_secure_1psid"] = cookies.get("__Secure-1PSID", "")
            if "__Secure-1PSIDTS" in cookies:
                cfg["gemini_web_secure_1psidts"] = cookies["__Secure-1PSIDTS"]
            if "__Secure-1PSIDCC" in cookies:
                cfg["gemini_web_secure_1psidcc"] = cookies["__Secure-1PSIDCC"]
            with open(config_file, "w", encoding="utf-8") as f:
                json.dump(cfg, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

    os.makedirs(os.path.dirname(cookie_file), exist_ok=True)
    try:
        with open(cookie_file, "w", encoding="utf-8") as f:
            json.dump(cookies, f, ensure_ascii=False, indent=2)
    except Exception:
        pass


def get_or_sync_gemini_cookies(base_dir: Optional[str] = None) -> Dict[str, str]:
    """
    專供開發與產圖時使用：
    自動掃描並同步 Cookie 到本地設定檔 (data/config.json 與 data/gemini_cookies.json)
    """
    if not base_dir:
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    config_file = os.path.join(base_dir, "data", "config.json")
    cookie_file = os.path.join(base_dir, "data", "gemini_cookies.json")
    dev_profile_dir = os.path.join(base_dir, "data", "dev_profile")

    # 1. 優先嘗試透過 CDP (Chrome DevTools Protocol) 直接讀取無痕視窗的記憶體 Cookie！
    cdp_ok, cdp_cookies, cdp_msg = extract_from_cdp(9222)
    if cdp_ok and cdp_cookies.get("__Secure-1PSID"):
        print(f"[CookieSync] {cdp_msg}")
        _save_synced_cookies(config_file, cookie_file, cdp_cookies)
        return cdp_cookies

    # 2. 次選嘗試掃描自訂獨立開發 Profile 與本機 Edge / Chrome
    custom_paths = [dev_profile_dir] if os.path.exists(dev_profile_dir) else []
    success, browser_cookies, msg = extract_from_local_browsers(custom_paths=custom_paths)
    if success and browser_cookies.get("__Secure-1PSID"):
        print(f"[CookieSync] {msg}")
        _save_synced_cookies(config_file, cookie_file, browser_cookies)
        return browser_cookies

    # 3. 如果瀏覽器鎖定或讀不到，讀取既有設定檔
    cookies = {}
    if os.path.exists(cookie_file):
        try:
            with open(cookie_file, "r", encoding="utf-8") as f:
                cookies = json.load(f)
        except Exception:
            pass

    if not cookies.get("__Secure-1PSID") and os.path.exists(config_file):
        try:
            with open(config_file, "r", encoding="utf-8") as f:
                cfg = json.load(f)
            if cfg.get("gemini_web_secure_1psid"):
                cookies["__Secure-1PSID"] = cfg["gemini_web_secure_1psid"]
                cookies["__Secure-1PSIDTS"] = cfg.get("gemini_web_secure_1psidts", "")
                cookies["__Secure-1PSIDCC"] = cfg.get("gemini_web_secure_1psidcc", "")
        except Exception:
            pass

    return cookies
