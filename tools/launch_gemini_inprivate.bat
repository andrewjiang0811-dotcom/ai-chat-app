@echo off
chcp 65001 >nul
echo ========================================================
echo  啟動 InPrivate 無痕瀏覽器 (啟用 CDP 記憶體除錯埠 Port 9222)
echo ========================================================
echo.
echo 說明：
echo 1. 此模式下開啟的無痕視窗，產圖腳本可直接穿透讀取記憶體中的 Cookie。
echo 2. 完全零硬碟檔案鎖定問題。
echo.
echo 正在開啟 Microsoft Edge InPrivate...
start msedge.exe --inprivate --remote-debugging-port=9222 "https://gemini.google.com"
