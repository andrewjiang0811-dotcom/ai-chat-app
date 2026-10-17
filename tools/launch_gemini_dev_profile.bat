@echo off
set "CHROME_EXE=C:\Program Files\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME_EXE%" set "CHROME_EXE=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME_EXE%" set "CHROME_EXE=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
echo Starting isolated Chrome profile on port 9225...
start "" "%CHROME_EXE%" --user-data-dir="%~dp0..\data\dev_profile" --remote-debugging-port=9225 "https://gemini.google.com"
