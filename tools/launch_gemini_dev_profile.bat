@echo off
chcp 65001 >nul
echo ========================================================
echo  啟動獨立開發隔離 Profile 瀏覽器 (dev_profile)
echo ========================================================
echo.
echo 說明：
echo 1. 獨立 Profile 與您的日常 Edge 帳號完全隔離（具備無痕的乾淨性）。
echo 2. 但會將 Cookie 持久化於專屬目錄，日常 Edge 怎麼開都不會占用鎖定它！
echo.
echo 正在開啟專用 Edge...
start msedge.exe --user-data-dir="%~dp0..\data\dev_profile" "https://gemini.google.com"
