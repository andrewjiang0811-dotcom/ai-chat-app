# 🤖 AI 智能對話助手 (AI Chat App)

一個輕量、美觀、全功能跨平台的 AI 智能對話應用程式。  
採用 **FastAPI 後端 + 現代 Web 介面 + PyWebView 原生視窗封裝**，同時滿足**桌面獨立原生視窗**與**瀏覽器網頁測試**的需求！

---

## ✨ 核心特色

1. **雙模雙軌運行**：
   - **桌面模式**：雙擊 `start.bat` 或執行 `python main.py`，立即彈出原生獨立桌面視窗（無網址列、極致輕量）。
   - **網頁模式**：執行時自動開放 `http://127.0.0.1:8000`，任何電腦瀏覽器甚至同 Wi-Fi 下的手機平板皆可同步測試。
2. **混合模型支援 (Hybrid Model Support)**：
   - **本地離線模型 (Ollama)**：無痛連接本地 Ollama（如 `llama3`, `mistral`, `qwen2.5` 等），完全免費、隱私離線運行。
   - **雲端高速模型 (Google Gemini API)**：支援 `gemini-2.0-flash`、`gemini-1.5-flash`、`gemini-1.5-pro`。
   - **OpenAI / 相容 API 格式**：支援 OpenAI (GPT-4o)、DeepSeek、Groq、OpenRouter 等自訂 Base URL 與 API Key。
3. **串流打字機效果 (Streaming SSE)**：
   - 採用 Server-Sent Events (SSE)，AI 邊思考邊逐字吐出回覆，極致絲滑流暢。
4. **多輪對話記憶與歷史存檔**：
   - 本地 SQLite 資料庫（`data/chat_history.db`）自動儲存，支援多主題對話切換、歷史回顧與刪除。
5. **角色人格切換 (Persona & System Prompt)**：
   - 內建角色：**萬能助理**、**代碼工程師**、**遊戲設計顧問**、**傲嬌貓娘**、**英文口說導師**。
   - 支援在設定頁面中自訂新增角色與專屬 System Prompt。
6. **語音輸入 (STT) 與語音朗讀 (TTS)**：
   - **STT**：支援 Web Speech API，點擊麥克風即可進行中文語音輸入。
   - **TTS**：整合微軟超自然神經網絡語音 **`edge-tts`**（免費、免 API Key，支援臺灣曉臻、雲哲、曉雨等極度生動自然的語音），點擊 🔊 即可朗讀！

---

## 🚀 快速開始

### 1. 安裝必要套件

```bash
pip install -r requirements.txt
```

### 2. 啟動應用程式

- **桌面視窗模式**（推薦）：
  ```bash
  python main.py
  # 或直接雙擊 start.bat
  ```

- **純網頁模式**（方便除錯或無桌面環境時使用）：
  ```bash
  python main.py --web-only
  ```
  啟動後打開瀏覽器訪問：`http://127.0.0.1:8000`

---

## 📁 專案目錄結構

```text
ai_chat_app/
├── core/
│   ├── database.py       # SQLite 對話歷史與 Session 管理
│   ├── llm_provider.py   # Ollama / Gemini / OpenAI 多模型串流適配器
│   ├── personas.py       # 角色人格定義與管理
│   └── tts_engine.py     # Microsoft Edge-TTS 高品質語音引擎
├── data/                 # 資料庫與設定儲存 (自動產生)
├── static/
│   ├── css/style.css     # 現代深色玻璃擬態樣式
│   ├── js/app.js         # 前端串流、語音、狀態邏輯
│   └── index.html        # 聊天室主頁面
├── main.py               # 應用程式啟動入口 (PyWebView + FastAPI)
├── server.py             # FastAPI 後端伺服器與 API 端點
├── requirements.txt      # Python 依賴清單
├── start.bat             # Windows 一鍵啟動腳本
└── README.md             # 專案說明文件
```

---

## 🔗 GitHub 版控推送指引

專案目錄已初始化為 Git 倉庫。若要推送到您的 GitHub：

1. 前往 [GitHub.com](https://github.com/new) 建立一個新的空白 Repository（例如命名為 `ai-chat-app`）。
2. 在終端機執行下列指令關聯並推送到遠端：
   ```bash
   git remote add origin https://github.com/<您的使用者名稱>/ai-chat-app.git
   git branch -M main
   git push -u origin main
   ```

