# 開發產圖 Gemini Cookie 自動同步功能說明文件

本文件詳細說明在**開發與角色立繪產圖（Image Generation）**時，系統如何實現 **Gemini Web API Cookie 自動讀取與靜默同步**，徹底免除開發者每次手動複製貼上 Cookie 的繁瑣流程。

---

## 1. 架構定位與需求背景

### 1.1 需求定位說明
- **對話助手前台介面**：維持純淨對話介面，不放置多餘的開發用 Cookie 同步按鈕。
- **後台開發與產圖工具**：當開發者在對話中要求「**請幫我產圖**」或執行角色立繪生成腳本時，系統會在**產圖前自動觸發 Cookie 檢查與同步機制**。

```mermaid
graph TD
    User[開發者: 請幫我產圖 / 產生立繪] --> AI[AI 助理 / 產圖工具]
    AI --> Hook[產圖前自動檢查: get_or_sync_gemini_cookies()]
    Hook -->|步驟 1: 掃描本機 Edge/Chrome| Extractor[本機 Cookie 解密模組]
    Extractor -->|解密最新 DPAPI + AES-GCM| Conf[(自動寫入 data/gemini_cookies.json 與 config.json)]
    Hook -->|步驟 2: 若被鎖定讀取既有快取| Cache[本地快取]
    Conf --> Client[GeminiClient 初始化]
    Client --> Gen[呼叫 Gemini Web API 生成圖片]
    Gen --> Chroma[自適應綠幕去背 Chroma Key]
    Chroma --> Save[輸出透明 PNG 至 data/avatars/角色/情緒.png]
```

---

## 2. 核心運作機制

### 2.1 產圖前自動同步（Auto-Sync Pre-hook）
在產圖核心腳本（`tools/generate_character_sprite.py` 與 `batch_generate_sprites.py`）中，皆在初始化 `GeminiClient` 前調用：
```python
from core.cookie_extractor import get_or_sync_gemini_cookies

cookies = get_or_sync_gemini_cookies(BASE_DIR)
```

該函式執行以下兩階段策略：
1. **本機瀏覽器主動解密掃描**：
   - 掃描本機常見瀏覽器（Edge、Google Chrome、Brave）的 `User Data` 目錄。
   - 讀取 `Local State` 並使用 Windows DPAPI 解密出 AES-256 主金鑰。
   - 遍歷所有 Profiles（`Default`, `Profile 1`, `Profile 2` ...），提取 `.google.com` 網域下的 `__Secure-1PSID`、`__Secure-1PSIDTS` 與 `__Secure-1PSIDCC`。
   - 解密成功後，自動寫入 `data/gemini_cookies.json` 與 `data/config.json`。
2. **檔案鎖定平滑回退**：
   - 若瀏覽器正開啟且鎖定了 SQLite 檔案，自動回退讀取已儲存的 Cookie 快取。
   - 若快取失效，可隨時透過開發擴充功能 `extensions/gemini-cookie-sync/` 傳送更新。

---

---

## 3. 如何指定「無痕視窗」或「隔離瀏覽器」的 Cookie？

### 3.1 為什麼無法直接從硬碟檔案讀取無痕視窗的 Cookie？
Chromium（Edge / Chrome）的無痕模式（Incognito / InPrivate）設計宗旨是**不留痕跡於硬碟**，因此無痕視窗的 Session 與 Cookie **完全只存放在電腦記憶體 (RAM) 中**，**從不寫入**磁碟的 SQLite 資料庫檔案。因此硬碟上的檔案永遠只有常規視窗的 Cookie。

### 3.2 三種指定並讀取無痕／專用環境的解決方案：

#### 方案 A：使用 CDP 遠端除錯埠（直讀無痕視窗的 RAM 記憶體，最推薦）
我們為您準備了一鍵啟動批次檔 [tools/launch_gemini_inprivate.bat](file:///c:/WorkFolder/MyProject/ai-chat-app/tools/launch_gemini_inprivate.bat)：
```bash
# 啟動時加入 CDP 除錯參數：
msedge.exe --inprivate --remote-debugging-port=9222 "https://gemini.google.com"
```
- **運作原理**：產圖腳本 `core/cookie_extractor.py` 會自動連線 `http://127.0.0.1:9222`，透過 Chrome DevTools Protocol 穿透直接取得**記憶體中最新鮮的 Cookie**。
- **優勢**：完全不需要關閉瀏覽器，**永遠不會遇到檔案鎖定占用問題**！

#### 方案 B：使用獨立開發 Profile（dev_profile，兼具無痕與持久化）
點擊執行 [tools/launch_gemini_dev_profile.bat](file:///c:/WorkFolder/MyProject/ai-chat-app/tools/launch_gemini_dev_profile.bat)：
```bash
msedge.exe --user-data-dir="data/dev_profile" "https://gemini.google.com"
```
- **運作原理**：這是一個獨立於日常個人帳號的乾淨瀏覽環境（就像無痕一樣不受日常帳號干擾），但它的 Cookie 會存放在 `data/dev_profile/Default/Network/Cookies`。
- **優勢**：日常使用的 Edge / Chrome 怎麼開、怎麼多開，都**絕不會占用或鎖定這個專用目錄**！

#### 方案 C：擴充功能允許在無痕模式中執行
1. 前往 `edge://extensions` 或 `chrome://extensions`。
2. 找到「Gemini Cookie 自動同步小助手」，點擊「詳細資訊」。
3. 開啟 **「在 InPrivate / 無痕模式中允許」**。
4. 在無痕視窗登入 Gemini 後點擊擴充功能圖示，即可將記憶體中的 Cookie 寫入 `data/gemini_cookies.json`。

---

## 4. 產圖工具使用指令

### 4.1 單張角色情緒立繪生成（自動同步 Cookie + 自動去背）
```bash
# 語法：
python tools/generate_character_sprite.py --persona <角色ID> --emotion <情緒名稱> --prompt "<生圖Prompt>" --bg <green|magenta>

# 範例：為傲嬌貓娘產生 happy 情緒立繪（綠色背景）
python tools/generate_character_sprite.py \
  --persona tsundere_cat \
  --emotion happy \
  --prompt "Full length full-body anime character sprite: cute tsundere catgirl... Solid pure bright green screen background #00FF00" \
  --bg green
```

### 4.2 批次生成全套表情
```bash
python batch_generate_sprites.py
```

---

## 5. 角色立繪與去背標準遵循
在調用產圖時，本工具自動遵循先前建立之版控規範（參見 [CHARACTER_SPRITE_GUIDELINES.md](file:///c:/WorkFolder/MyProject/ai-chat-app/docs/CHARACTER_SPRITE_GUIDELINES.md)）：
1. **背景配色避讓**：嚴禁使用角色身上已有之配色。角色有白色服飾時一律採用純亮綠幕 `#00FF00` 或純洋紅 `#FF00FF`。
2. **資產獨立資料夾歸類**：立繪圖片統一儲存至 `data/avatars/{persona_id}/{emotion}.png`，不使用 `assistant_` 雜湊前綴。
3. **特徵與基準線保護**：眼睛與皮膚自動保護，避免五官與衣服被色鍵算法誤刪。

---

## 6. 相關程式碼清單

| 檔案 | 職責 |
| :--- | :--- |
| `core/cookie_extractor.py` | 本機 Edge/Chrome DPAPI 解密、CDP 無痕記憶體穿透與自動同步模組 |
| `tools/launch_gemini_inprivate.bat` | 一鍵啟動支援 CDP 記憶體除錯的 InPrivate 無痕視窗 |
| `tools/launch_gemini_dev_profile.bat` | 一鍵啟動獨立開發隔離 Profile 瀏覽器 |
| `tools/generate_character_sprite.py` | 整合自動同步 Cookie、Gemini 產圖與 Chroma Key 去背之通用工具 |
| `batch_generate_sprites.py` | 批次立繪生成腳本（已整合 Cookie 自動同步與動態專案路徑） |
| `docs/CHARACTER_SPRITE_GUIDELINES.md` | 角色立繪產圖與去背標準作業規範 |
| `docs/GEMINI_COOKIE_AUTO_SYNC.md` | 本說明文件 |

