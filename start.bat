@echo off
chcp 65001 >nul
echo 正在啟動 AI 智能對話助手...
python main.py
if errorlevel 1 (
    echo.
    echo 啟動失敗，請檢查 Python 環境與套件安裝。
    pause
)

