"""
即時 Cookie 提取與驗證工具 (Cookie Extractor & Verifier)
自動偵測 CDP 埠 (9225) 與本機 Edge/Chrome 瀏覽器，成功後自動快取至 data/gemini_cookies.json。
"""

import os
import sys
import json
import time

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from core.cookie_extractor import get_or_sync_gemini_cookies, extract_from_cdp, extract_from_local_browsers

sys.stdout.reconfigure(encoding="utf-8")


def check_and_extract():
    print("==================================================")
    print("🔍 正在檢測 Google Gemini Cookie...")
    print("==================================================")

    # 1. 檢測 CDP Port 9225
    ok, cdp_ck, msg = extract_from_cdp([9225, 9222])
    if ok and cdp_ck.get("__Secure-1PSID"):
        print(f"✅ {msg}")
        save_cookies(cdp_ck)
        return True

    # 2. 檢測本機 Edge / Chrome
    success, browser_ck, msg = extract_from_local_browsers()
    if success and browser_ck.get("__Secure-1PSID"):
        print(f"✅ {msg}")
        save_cookies(browser_ck)
        return True

    # 3. 檢查現存已保存的 cookies
    cookie_file = os.path.join(BASE_DIR, "data", "gemini_cookies.json")
    if os.path.exists(cookie_file):
        try:
            with open(cookie_file, "r", encoding="utf-8") as f:
                saved = json.load(f)
            if saved.get("__Secure-1PSID"):
                print("ℹ️ 找到本機已儲存之 Gemini Cookie 快取。")
                return True
        except Exception:
            pass

    print(f"⚠️ {msg}")
    print("\n【解決方式】二選一：")
    print("1. 請雙擊執行 tools/launch_gemini_inprivate.bat 並登入 Gemini。")
    print("2. 或將您平時使用的 Chrome / Edge 完全關閉 3 秒鐘，再重新執行本腳本。")
    return False


def save_cookies(cookies):
    cookie_file = os.path.join(BASE_DIR, "data", "gemini_cookies.json")
    config_file = os.path.join(BASE_DIR, "data", "config.json")
    os.makedirs(os.path.dirname(cookie_file), exist_ok=True)
    with open(cookie_file, "w", encoding="utf-8") as f:
        json.dump(cookies, f, indent=2, ensure_ascii=False)
    print(f"💾 Cookie 已成功儲存至：{cookie_file}")


if __name__ == "__main__":
    check_and_extract()
