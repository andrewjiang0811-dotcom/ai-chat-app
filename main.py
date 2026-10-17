import socket
import sys
import time
import argparse
import threading
import uvicorn
import httpx
from server import app

# Ensure Windows console uses UTF-8 encoding
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

def get_local_ip() -> str:
    """獲取本機在區域網路 (LAN) 中的 IPv4 位址"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def run_uvicorn(host: str, port: int, reload: bool = False):
    if reload:
        uvicorn.run("server:app", host=host, port=port, reload=True, log_level="warning")
    else:
        uvicorn.run(app, host=host, port=port, log_level="warning")

def wait_for_server(url: str, timeout: float = 6.0):
    start = time.time()
    while time.time() - start < timeout:
        try:
            res = httpx.get(url, timeout=1.0)
            if res.status_code == 200:
                return True
        except Exception:
            time.sleep(0.2)
    return False

def main():
    parser = argparse.ArgumentParser(description="AI 智能對話助手 (AI Chat App)")
    parser.add_argument("--web-only", action="store_true", help="僅以網頁模式運行（不開啟桌面視窗）")
    parser.add_argument("--lan", "--share", action="store_true", help="開放同數據機/區域網路設備連線 (自動監聽 0.0.0.0)")
    parser.add_argument("--host", default="127.0.0.1", help="綁定主機位址 (預設: 127.0.0.1，若需開放區網可填 0.0.0.0)")
    parser.add_argument("--port", type=int, default=8000, help="服務連接埠 (預設: 8000)")
    args = parser.parse_args()

    bind_host = "0.0.0.0" if args.lan else args.host
    is_lan_mode = (bind_host == "0.0.0.0")

    # 本機桌面視窗與就緒測試使用 127.0.0.1 (避免 Windows 對 0.0.0.0 發送請求時拋出 WinError 10049)
    local_access_host = "127.0.0.1" if bind_host in ("0.0.0.0", "") else bind_host
    server_url = f"http://{local_access_host}:{args.port}"
    lan_ip = get_local_ip()
    lan_url = f"http://{lan_ip}:{args.port}"

    print("=" * 60)
    print("🚀 AI 智能對話助手啟動中...")
    print(f"🏠 本機視窗/網址: {server_url}")
    if is_lan_mode:
        print(f"📱 家人/區網連線: {lan_url}  (同數據機/Wi-Fi 手機或電腦皆可使用)")
    else:
        print(f"💡 目前僅限本機存取。若要讓同數據機家人使用，可加上 --lan 參數")
        print(f"   (本機區網 IP: {lan_ip}，連線網址為 {lan_url})")
    print("=" * 60)

    if args.web_only:
        print("💡 目前以【純網頁模式 (自動熱重載)】運行，請在瀏覽器打開上述網址。")
        print("👉 按 Ctrl + C 可結束程式。")
        run_uvicorn(bind_host, args.port, reload=True)
        return

    # Desktop Window Mode via pywebview
    try:
        import webview
    except ImportError:
        print("⚠️ 未檢測到 pywebview 套件，自動切換至純網頁模式。")
        print("提示：若需開啟桌面視窗，請執行: pip install pywebview")
        run_uvicorn(bind_host, args.port)
        return

    # Start FastAPI server in a background thread
    server_thread = threading.Thread(
        target=run_uvicorn,
        args=(bind_host, args.port),
        daemon=True
    )
    server_thread.start()

    # Wait for the server to be ready
    print("⏳ 等候伺服器就緒...")
    if not wait_for_server(server_url):
        print("⚠️ 伺服器啟動等候超時，嘗試直接載入視窗...")

    print("🖥️ 正在開啟桌面原生獨立視窗...")
    print("💡 同時間您也可以在任何瀏覽器中輸入該網址同步測試！")

    # Create native window
    window = webview.create_window(
        title="AI 智能對話助手",
        url=server_url,
        width=1180,
        height=820,
        min_size=(720, 520)
    )

    # Start PyWebView loop (blocks until window is closed)
    webview.start()
    print("👋 桌面視窗已關閉，程式結束。")

if __name__ == "__main__":
    main()

