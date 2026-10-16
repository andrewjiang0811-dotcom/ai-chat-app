@echo off
chcp 65001 >nul
echo ========================================================
echo  啟動 Google Chrome 無痕瀏覽器 (啟用 CDP 記憶體除錯埠 Port 9225)
echo ========================================================
echo.
echo 說明：
echo 1. 此模式下開啟的 Chrome 無痕視窗，產圖腳本可直接穿透讀取記憶體中的 Cookie。
echo 2. 採用獨立暫存進程，日常 Chrome 怎麼開都不會衝突或鎖定。
echo.

set "CHROME_EXE="
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    set "CHROME_EXE=C:\Program Files\Google\Chrome\Application\chrome.exe"
) else if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    set "CHROME_EXE=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
) else if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" (
    set "CHROME_EXE=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
) else (
    set "CHROME_EXE=chrome.exe"
)

echo 正在開啟 Google Chrome 無痕模式...
start "" "%CHROME_EXE%" --incognito --user-data-dir="%TEMP%\chrome_incognito_gemini" --remote-debugging-port=9225 "https://gemini.google.com"
