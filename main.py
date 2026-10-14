import sys
import time
import argparse
import threading
import uvicorn
import httpx
from server import app

def run_uvicorn(host: str, port: int):
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
    parser.add_argument("--host", default="127.0.0.1", help="綁定主機位址 (預設: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8000, help="服務連接埠 (預設: 8000)")
    args = parser.parse_args()

    server_url = f"http://{args.host}:{args.port}"

    print("=" * 60)
    print("🚀 AI 智能對話助手啟動中...")
    print(f"🌐 網頁測試網址: {server_url}")
    print("=" * 60)

    if args.web_only:
        print("💡 目前以【純網頁模式】運行，請在瀏覽器打開上述網址。")
        print("👉 按 Ctrl + C 可結束程式。")
        run_uvicorn(args.host, args.port)
        return

    # Desktop Window Mode via pywebview
    try:
        import webview
    except ImportError:
        print("⚠️ 未檢測到 pywebview 套件，自動切換至純網頁模式。")
        print("提示：若需開啟桌面視窗，請執行: pip install pywebview")
        run_uvicorn(args.host, args.port)
        return

    # Start FastAPI server in a background thread
    server_thread = threading.Thread(
        target=run_uvicorn,
        args=(args.host, args.port),
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
