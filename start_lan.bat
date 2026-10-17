@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================================
echo   正在啟動 AI 智能對話助手 [區網 / 家人共享模式]...
echo   請確保家人手機或電腦已連線至同一個 Wi-Fi 或數據機
echo ============================================================
echo.
python main.py --lan
if errorlevel 1 (
    echo.
    echo 啟動失敗，請檢查 Python 環境與套件安裝。
)
echo.
pause