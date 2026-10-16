@echo off
chcp 65001 >nul
echo ========================================================
echo  啟動 InPrivate 無痕瀏覽器 (啟用 CDP 記憶體除錯埠 Port 9225)
echo ========================================================
echo.
echo 說明：
echo 1. 此模式下開啟的無痕視窗，產圖腳本可直接穿透讀取記憶體中的 Cookie。
echo 2. 採用獨立暫存進程，日常 Edge 怎麼開都不會衝突或鎖定。
echo.
echo 正在開啟 Microsoft Edge InPrivate...
start msedge.exe --inprivate --user-data-dir="%TEMP%\edge_inprivate_gemini" --remote-debugging-port=9225 "https://gemini.google.com"
