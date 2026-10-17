@echo off
chcp 65001 >nul
title Google Gemini 專用產圖瀏覽器
echo ========================================================
echo   啟動 Google Gemini 專用登入視窗 (除錯埠 Port 9225)
echo ========================================================
echo.
echo 說明：
echo 1. 系統即將為您打開一個獨立的瀏覽器視窗。
echo 2. 請在開啟的視窗中登入您的 Google 帳號 (gemini.google.com)。
echo 3. 登入完成後【請保持此視窗與瀏覽器開啟】，回到 Antigravity IDE 告知我即可！
echo.
set "DATA_DIR=%TEMP%\gemini_chrome_dev"
if not exist "%DATA_DIR%" mkdir "%DATA_DIR%"

set "EXE=C:\Program Files\Google\Chrome\Application\chrome.exe"
if not exist "%EXE%" set "EXE=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if not exist "%EXE%" set "EXE=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
if not exist "%EXE%" set "EXE=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

echo 正在啟動瀏覽器：%EXE%
echo 使用獨立暫存目錄：%DATA_DIR%
echo.
start "" "%EXE%" --user-data-dir="%DATA_DIR%" --remote-debugging-port=9225 --no-first-run --no-default-browser-check "https://gemini.google.com"

echo.
echo [提示] 瀏覽器已啟動！
echo 若您已在瀏覽器中成功登入 Gemini，請回到 IDE 輸入「已登入」。
echo.
echo 若瀏覽器未正常彈出，請按任意鍵查看詳細資訊...
pause
