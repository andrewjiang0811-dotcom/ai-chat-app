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


def extract_from_local_browsers() -> Tuple[bool, Dict[str, str], str]:
    """
    掃描本機常見瀏覽器 (Edge, Chrome, Brave, Firefox) 的 Google Cookie。
    回傳 (成功與否, cookies字典, 訊息)
    """
    appdata = os.path.expanduser("~")
    browser_targets = [
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
    ]

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
            f"建議使用專屬的「Gemini Cookie 同步擴充功能」實現隨時全自動同步，或將 {last_locked_browser} 暫時關閉後再次點擊自動讀取。"
        )

    return False, {}, "未在常見瀏覽器路徑中找到登入中的 Google Gemini Cookie。"
