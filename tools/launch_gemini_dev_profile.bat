@echo off
chcp 65001 >nul
echo ========================================================
echo  啟動獨立開發隔離 Profile 瀏覽器 (dev_profile)
echo ========================================================
echo.
echo 說明：
echo 1. 獨立 Profile 與您的日常 Google Chrome 帳號完全隔離（具備無痕的乾淨性）。
echo 2. 但會將 Cookie 持久化於專屬目錄，日常 Chrome 怎麼開都不會占用鎖定它！
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

echo 正在開啟專用 Google Chrome...
start "" "%CHROME_EXE%" --user-data-dir="%~dp0..\data\dev_profile" "https://gemini.google.com"
