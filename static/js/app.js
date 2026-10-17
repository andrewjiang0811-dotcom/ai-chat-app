// AI Chat App Frontend Logic (SillyTavern Style Support)

// --- Multi-Device & Privacy Support ---
const DEVICE_ID_KEY = "ai_chat_device_id";
const DEVICE_NAME_KEY = "ai_chat_device_nickname";

function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    const isLocal = window.location.hostname === "127.0.0.1" || 
                    window.location.hostname === "localhost" || 
                    window.location.hostname === "";
    // If accessing from localhost/127.0.0.1, default to "default" so host preserves existing legacy sessions
    id = isLocal ? "default" : "dev_" + Math.random().toString(36).substring(2, 10);
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function setDeviceId(newId) {
  if (newId && newId.trim()) {
    localStorage.setItem(DEVICE_ID_KEY, newId.trim());
    return true;
  }
  return false;
}

// Global fetch wrapper: Automatically attaches X-Device-Id to all API calls
const _originalFetch = window.fetch;
window.fetch = function(url, options = {}) {
  options = options || {};
  if (typeof url === "string" && (url.startsWith("/api/") || url.includes("/api/"))) {
    const devId = getDeviceId();
    if (!options.headers) {
      options.headers = { "X-Device-Id": devId };
    } else if (options.headers instanceof Headers) {
      if (!options.headers.has("X-Device-Id")) {
        options.headers.set("X-Device-Id", devId);
      }
    } else if (Array.isArray(options.headers)) {
      options.headers.push(["X-Device-Id", devId]);
    } else {
      options.headers["X-Device-Id"] = devId;
    }
  }
  return _originalFetch(url, options);
};

let state = {
  currentSessionId: null,
  currentPersonaId: "assistant",
  isStreaming: false,
  abortController: null,
  config: {},
  personas: [],
  isRecording: false,
  recognition: null,
  isTTSPlaying: false,
  layout: null,      // 版面設定（並排方向、各區塊尺寸），見 loadLayoutPrefs()
  spriteView: { scale: 1, x: 0, y: 0 },  // 立繪縮放/平移（x/y 為立繪區尺寸的百分比）
  stageMode: "view",       // 立繪模式: view (視角平移/縮放) | interact (觸碰互動) | edit (熱區編輯)
  currentEmotion: "default", // 當前表情
  emotionTimeout: null,    // 暫時表情計時器
  reactionTimeout: null,   // 互動浮動氣泡計時器
  currentEditingEmotion: "default",
  bubbleStyle: "comic", // 對話框邊框風格 (comic | vn | cyber | clean)
  chatTheme: "default", // 聊天室背景與情境主題 (line | parchment | book | default | custom)
  deviceFrame: "phone", // 擬物化裝置外框 (phone | parchment | book | none)
  parchmentFont: "cursive", // 羊皮紙字型 (cursive 草書 | kaiti 楷體 | serif 古宋)
  customBg: { url: "", overlay: 20, blur: 0 } // 自訂背景圖片設定
};

const EMOTION_META = {
  default: { name: "預設 / 平常", icon: "✨", pose: "平常優雅站姿", desc: "角色平常的自然全身站姿與親切微笑，已完成純綠幕去背，零破圖瑕疵。" },
  happy: { name: "開心 / 歡喜", icon: "😊", pose: "雙手比YA活潑彈跳站姿", desc: "元氣滿滿雙手比YA、活潑開朗的喜悅全身站姿，綠幕精準去背。" },
  shy: { name: "害羞 / 傲嬌", icon: "😳", pose: "內八靦腆抓裙擺站姿", desc: "臉紅微偏頭、內八小碎步與雙手抓裙擺的害羞站姿，髮絲細膩自然。" },
  angry: { name: "生氣 / 氣惱", icon: "😠", pose: "鼓腮氣呼呼站姿", desc: "氣呼呼鼓起腮幫子、鼓臉傲嬌生氣神態，零破圖透明立繪。" },
  sad: { name: "難過 / 沮喪", icon: "😢", pose: "微蜷縮低頭垂憐站姿", desc: "低頭泛淚、微縮身姿楚楚可憐的難過神態，全身無瑕疵去背。" },
  surprised: { name: "驚訝 / 震撼", icon: "😲", pose: "圓睜杏眼慌張站姿", desc: "小嘴圓張、睜大雙眼的驚訝呆萌神態，全身站姿立繪。" },
  thinking: { name: "思考 / 專注", icon: "🤔", pose: "凝思端詳站姿", desc: "眼神凝望思考、認真分析時的端正神態，全身站姿立繪。" }
};

// DOM Elements - Navigation & Sidebar
const sidebar = document.getElementById("sidebar");
const btnToggleSidebar = document.getElementById("btn-toggle-sidebar");
const btnCollapseSidebar = document.getElementById("btn-collapse-sidebar");
const btnToggleStage = document.getElementById("btn-toggle-stage");
const sessionListEl = document.getElementById("session-list");
const flyoutSessionList = document.getElementById("flyout-session-list");
const miniPersonaBtn = document.getElementById("mini-persona-btn");
const miniPersonaAvatar = document.getElementById("mini-persona-avatar");
const btnNewChat = document.getElementById("btn-new-chat");
const personaSelect = document.getElementById("persona-select");
const navPersonaAvatar = document.getElementById("nav-persona-avatar");
const navPersonaName = document.getElementById("nav-persona-name");
const navModelName = document.getElementById("nav-model-name");
const modelIndicator = document.getElementById("model-indicator");
const btnClearChat = document.getElementById("btn-clear-chat");
const ttsAudio = document.getElementById("tts-audio");

// DOM Elements - Character Stage (SillyTavern Style)
const characterStage = document.getElementById("character-stage");
const spriteContainer = document.getElementById("sprite-container");
const characterSprite = document.getElementById("character-sprite");
const spriteEmptyState = document.getElementById("sprite-empty-state");
const emptyAvatarCircle = document.getElementById("empty-avatar-circle");
const emptySpriteTitle = document.getElementById("empty-sprite-title");
const btnEmptyUpload = document.getElementById("btn-empty-upload");
const btnChangeSprite = document.getElementById("btn-change-sprite");
const spriteFileInput = document.getElementById("sprite-file-input");
const stagePersonaAvatar = document.getElementById("stage-persona-avatar");
const stagePersonaName = document.getElementById("stage-persona-name");
const spriteTransform = document.getElementById("sprite-transform");
const spriteZoomControls = document.getElementById("sprite-zoom-controls");
const btnSpriteZoomIn = document.getElementById("btn-sprite-zoom-in");
const btnSpriteZoomOut = document.getElementById("btn-sprite-zoom-out");
const btnSpriteZoomReset = document.getElementById("btn-sprite-zoom-reset");
const spriteZoomLabel = document.getElementById("sprite-zoom-label");

// Stage Modes & Interactive Emotions Elements
const btnModeView = document.getElementById("btn-mode-view");
const btnModeInteract = document.getElementById("btn-mode-interact");
const btnModeEdit = document.getElementById("btn-mode-edit");
const btnOpenSpriteManager = document.getElementById("btn-open-sprite-manager");
const stageEmotionBadge = document.getElementById("stage-emotion-badge");
const spriteTouchOverlay = document.getElementById("sprite-touch-overlay");
const spriteReactionBubble = document.getElementById("sprite-reaction-bubble");
const reactionBubbleIcon = document.getElementById("reaction-bubble-icon");
const reactionBubbleText = document.getElementById("reaction-bubble-text");
const emotionSpriteFileInput = document.getElementById("emotion-sprite-file-input");
const btnHideStage = document.getElementById("btn-hide-stage");
const btnAutoRemoveBg = document.getElementById("btn-auto-remove-bg");

// Sprite Manager Modal Elements
const spriteMgrPersonaSelect = document.getElementById("sprite-mgr-persona-select");
const cfgAutoEmotion = document.getElementById("cfg-auto-emotion");
const cfgEmotionMethod = document.getElementById("cfg-emotion-method");
const emotionCardsGrid = document.getElementById("emotion-cards-grid");
const touchZonesList = document.getElementById("touch-zones-list");
const btnAddTouchZone = document.getElementById("btn-add-touch-zone");
const btnSaveTouchZones = document.getElementById("btn-save-touch-zones");

// DOM Elements - Layout (可調整大小的分隔條、並排方向切換)
const chatWorkspace = document.getElementById("chat-workspace");
const sidebarResizer = document.getElementById("sidebar-resizer");
const stageResizer = document.getElementById("stage-resizer");
const btnToggleLayout = document.getElementById("btn-toggle-layout");
const layoutIcon = document.getElementById("layout-icon");
const layoutLabel = document.getElementById("layout-label");

// DOM Elements - Bubble Style (漫畫對話框風格切換)
const chatDialoguePanel = document.getElementById("chat-dialogue-panel");
const btnToggleBubbleStyle = document.getElementById("btn-toggle-bubble-style");
const bubbleStyleIcon = document.getElementById("bubble-style-icon");
const bubbleStyleLabel = document.getElementById("bubble-style-label");
const cfgBubbleStyle = document.getElementById("cfg-bubble-style");
const previewBubbleCard = document.getElementById("preview-bubble-card");
const previewSpeakerName = document.getElementById("preview-speaker-name");

// DOM Elements - Theme & Background (聊天室主題與背景自訂)
const btnToggleTheme = document.getElementById("btn-toggle-theme");
const navThemeIcon = document.getElementById("nav-theme-icon");
const navThemeLabel = document.getElementById("nav-theme-label");
const btnUploadChatBg = document.getElementById("btn-upload-chat-bg");
const chatBgFileInput = document.getElementById("chat-bg-file-input");
const cfgChatBgUrl = document.getElementById("cfg-chat-bg-url");
const btnClearChatBg = document.getElementById("btn-clear-chat-bg");
const cfgBgOverlay = document.getElementById("cfg-bg-overlay");
const labelBgOverlay = document.getElementById("label-bg-overlay");
const cfgBgBlur = document.getElementById("cfg-bg-blur");
const labelBgBlur = document.getElementById("label-bg-blur");
const themePreviewBox = document.getElementById("theme-preview-box");
const themePreviewAvatar = document.getElementById("theme-preview-avatar");
const previewMiniAssistantBubble = document.getElementById("preview-mini-assistant-bubble");
const previewMiniUserBubble = document.getElementById("preview-mini-user-bubble");
const previewReadStatus = document.getElementById("preview-read-status");

// DOM Elements - Chat Window
const messagesContainer = document.getElementById("messages-container");
const messageListEl = document.getElementById("message-list");
const welcomeScreen = document.getElementById("welcome-screen");
const chatInput = document.getElementById("chat-input");
const btnSend = document.getElementById("btn-send");
const btnStop = document.getElementById("btn-stop");
const btnMic = document.getElementById("btn-mic");
const sttStatus = document.getElementById("stt-status");

// DOM Elements - Device Frame (iPhone 擬物化與裝置外框)
const deviceFrameContainer = document.getElementById("device-frame-container");
const statusBarTime = document.getElementById("status-bar-time");
const phoneChatTargetName = document.getElementById("phone-chat-target-name");
const btnPhoneBack = document.getElementById("btn-phone-back");
const btnPhoneSearch = document.getElementById("btn-phone-search");
const btnPhoneCall = document.getElementById("btn-phone-call");
const btnPhoneMenu = document.getElementById("btn-phone-menu");
const btnPhonePlus = document.getElementById("btn-phone-plus");
const btnPhoneCamera = document.getElementById("btn-phone-camera");
const btnPhoneGallery = document.getElementById("btn-phone-gallery");
const cfgDeviceFrame = document.getElementById("cfg-device-frame");

// DOM Elements - Parchment Manuscript (典藏羊皮紙手稿)
const parchmentHeader = document.getElementById("parchment-header");
const parchmentMainTitle = document.getElementById("parchment-main-title");
const btnParchmentFont = document.getElementById("btn-parchment-font");
const parchmentFontLabel = document.getElementById("parchment-font-label");

// DOM Elements - Antique Book (古典典藏書籍)
const bookHeader = document.getElementById("book-header");
const bookChapterTitle = document.getElementById("book-chapter-title");
const btnBookFont = document.getElementById("btn-book-font");
const bookFontIcon = document.getElementById("book-font-icon");
const bookFontLabel = document.getElementById("book-font-label");

// Settings Modal DOM Elements
const settingsModal = document.getElementById("settings-modal");
const btnOpenSettings = document.getElementById("btn-open-settings");
const btnCloseSettings = document.getElementById("btn-close-settings");
const btnSaveSettings = document.getElementById("btn-save-settings");
const cfgProvider = document.getElementById("cfg-provider");
const cfgOllamaHost = document.getElementById("cfg-ollama-host");
const cfgGeminiKey = document.getElementById("cfg-gemini-key");
const cfgGeminiWeb1psid = document.getElementById("cfg-gemini-web-1psid");
const cfgGeminiWeb1psidts = document.getElementById("cfg-gemini-web-1psidts");
const cfgGeminiWeb1psidcc = document.getElementById("cfg-gemini-web-1psidcc");
const cfgGeminiWebProxy = document.getElementById("cfg-gemini-web-proxy");
const cfgOpenaiKey = document.getElementById("cfg-openai-key");
const cfgOpenaiUrl = document.getElementById("cfg-openai-url");
const cfgModel = document.getElementById("cfg-model");
const modelQuickSelect = document.getElementById("model-quick-select");
const cfgTtsVoice = document.getElementById("cfg-tts-voice");
const cfgTtsAutoplay = document.getElementById("cfg-tts-autoplay");
const groupOllama = document.getElementById("group-ollama");
const groupGemini = document.getElementById("group-gemini");
const groupGeminiWeb = document.getElementById("group-gemini-web");
const groupOpenai = document.getElementById("group-openai");

// Connection Test & Model Tags Elements
const btnTestConnection = document.getElementById("btn-test-connection");
const testSpinner = document.getElementById("test-spinner");
const testIcon = document.getElementById("test-icon");
const testText = document.getElementById("test-text");
const connectionTestResult = document.getElementById("connection-test-result");
const modelTagsWrapper = document.getElementById("model-tags-wrapper");
const modelTagsList = document.getElementById("model-tags-list");
const modelTagsCount = document.getElementById("model-tags-count");

// Persona Form Elements
const personaFormName = document.getElementById("persona-form-name");
const personaFormAvatar = document.getElementById("persona-form-avatar");
const personaFormDesc = document.getElementById("persona-form-desc");
const personaFormPrompt = document.getElementById("persona-form-prompt");
const btnSaveNewPersona = document.getElementById("btn-save-new-persona");

// Markdown config
marked.setOptions({
  breaks: true,
  gfm: true,
  highlight: function(code, lang) {
    const language = hljs.getLanguage(lang) ? lang : "plaintext";
    return hljs.highlight(code, { language }).value;
  }
});

// Initialize App
document.addEventListener("DOMContentLoaded", async () => {
  setupLayoutControls();
  setupSpriteZoom();
  setupEventListeners();
  applyBubbleStyle(loadBubbleStylePrefs());
  const themePrefs = loadThemePrefs();
  applyChatTheme(themePrefs.theme, themePrefs.customBg);
  setupSpeechRecognition();
  setupDragAndDrop();
  
  // 檢查是否偏好不顯示立繪
  const stageHidden = localStorage.getItem("ai-chat:stage-hidden") === "true";
  if (stageHidden) {
    toggleStageVisibility(true);
  }

  await loadAppConfig();
  await loadVoices();
  await loadPersonas();
  await loadSessions();
  await loadModelList();
});

// Device Privacy Controls Setup
async function loadDeviceProfilesList() {
  const selectEl = document.getElementById("select-device-profile");
  if (!selectEl) return;
  try {
    const res = await fetch("/api/devices");
    const devices = await res.json();
    const curDevId = getDeviceId();
    selectEl.innerHTML = "";
    devices.forEach(d => {
      const opt = document.createElement("option");
      opt.value = d.id;
      const nick = (d.id === curDevId ? (localStorage.getItem(DEVICE_NAME_KEY) || d.nickname) : d.nickname) || d.id;
      const isCur = d.id === curDevId ? " (當前使用中)" : "";
      const geminiTag = d.has_gemini_web ? " [已串接Gemini]" : "";
      opt.textContent = `👤 ${nick}${geminiTag}${isCur}`;
      if (d.id === curDevId) opt.selected = true;
      selectEl.appendChild(opt);
    });
  } catch (e) {
    console.error("Failed to load device profiles:", e);
  }
}

function updateGeminiAccountBadge() {
  const badge = document.getElementById("gemini-account-badge");
  const text = document.getElementById("gemini-account-status-text");
  const tag = document.getElementById("gemini-account-tag");
  const tabBadge = document.getElementById("tab-device-account-badge");
  const hasCookie = !!(state.config?.gemini_web_secure_1psid || (cfgGeminiWeb1psid && cfgGeminiWeb1psid.value.trim()));

  if (text && tag) {
    if (hasCookie) {
      text.innerHTML = "✅ <strong>此身分已綁定 Google Gemini 帳號</strong> (可正常使用網頁版高速對話)";
      text.style.color = "#34d399";
      tag.textContent = "已綁定";
      tag.style.background = "rgba(16, 185, 129, 0.2)";
      tag.style.color = "#34d399";
      if (badge) {
        badge.style.background = "rgba(16, 185, 129, 0.08)";
        badge.style.borderColor = "rgba(16, 185, 129, 0.3)";
      }
    } else {
      text.innerHTML = "⚪ <strong>當前身分尚未綁定個人 Google 帳號</strong>（不使用主機帳號，保障個人隱私）";
      text.style.color = "#93c5fd";
      tag.textContent = "尚未綁定";
      tag.style.background = "rgba(255, 255, 255, 0.08)";
      tag.style.color = "var(--text-muted)";
      if (badge) {
        badge.style.background = "rgba(59, 130, 246, 0.08)";
        badge.style.borderColor = "rgba(59, 130, 246, 0.25)";
      }
    }
  }

  if (tabBadge) {
    if (hasCookie) {
      tabBadge.textContent = "已綁定 Google 帳號";
      tabBadge.style.color = "#34d399";
      tabBadge.style.background = "rgba(16, 185, 129, 0.15)";
    } else {
      tabBadge.textContent = "未綁定 Google 帳號 (獨立空白)";
      tabBadge.style.color = "#93c5fd";
      tabBadge.style.background = "rgba(59, 130, 246, 0.15)";
    }
  }
}

function initDevicePrivacyControls() {
  const btnCopy = document.getElementById("btn-copy-device-id");
  if (btnCopy) {
    btnCopy.addEventListener("click", () => {
      const devId = getDeviceId();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(devId).then(() => {
          const orig = btnCopy.textContent;
          btnCopy.textContent = "✅ 已複製！";
          setTimeout(() => { btnCopy.textContent = orig; }, 1800);
        }).catch(() => {
          prompt("請手動複製裝置識別碼：", devId);
        });
      } else {
        prompt("請手動複製裝置識別碼：", devId);
      }
    });
  }

  const btnImport = document.getElementById("btn-import-device-id");
  const inputImport = document.getElementById("input-import-device-id");
  if (btnImport && inputImport) {
    btnImport.addEventListener("click", () => {
      const val = inputImport.value.trim();
      if (!val) {
        alert("請輸入有效的裝置 ID！");
        return;
      }
      setDeviceId(val);
      alert(`已成功切換至裝置 ID: ${val}\n頁面即將重新載入以同步該裝置的歷史對話與自訂設定！`);
      window.location.reload();
    });
  }

  const btnNewDev = document.getElementById("btn-generate-new-device");
  if (btnNewDev) {
    btnNewDev.addEventListener("click", () => {
      if (confirm("確定要生成全新身分嗎？\n這將開立一個全新且獨立的空白對話與設定空間。")) {
        const newId = "dev_" + Math.random().toString(36).substring(2, 10);
        setDeviceId(newId);
        localStorage.removeItem(DEVICE_NAME_KEY);
        alert(`已生成新身分：${newId}\n即將重新載入！`);
        window.location.reload();
      }
    });
  }

  // Profile Switcher
  const btnSwitchProfile = document.getElementById("btn-switch-profile");
  const selectProfile = document.getElementById("select-device-profile");
  if (btnSwitchProfile && selectProfile) {
    btnSwitchProfile.addEventListener("click", () => {
      const targetId = selectProfile.value;
      if (!targetId) return;
      if (targetId === getDeviceId()) {
        alert("您目前已經在此身分中！");
        return;
      }
      setDeviceId(targetId);
      const opt = selectProfile.options[selectProfile.selectedIndex];
      if (opt) {
        const cleanName = opt.textContent.replace(/^[👤\s]+/, "").split("[")[0].split("(")[0].trim();
        if (cleanName && cleanName !== targetId) {
          localStorage.setItem(DEVICE_NAME_KEY, cleanName);
        }
      }
      alert(`已切換至身分：${targetId}\n即將重新載入專屬空間！`);
      window.location.reload();
    });
  }

  // Create Family Profile
  const btnCreateProfile = document.getElementById("btn-create-family-profile");
  const inputProfileName = document.getElementById("input-new-profile-name");
  if (btnCreateProfile && inputProfileName) {
    btnCreateProfile.addEventListener("click", async () => {
      const name = inputProfileName.value.trim() || "家人身分";
      const newDevId = "dev_" + Math.random().toString(36).substring(2, 10);
      try {
        await fetch("/api/config", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Device-Id": newDevId
          },
          body: JSON.stringify({
            _nickname: name,
            provider: "ollama",
            model: "llama3:latest"
          })
        });
      } catch (e) {
        console.warn("Failed to pre-register profile config:", e);
      }
      setDeviceId(newDevId);
      localStorage.setItem(DEVICE_NAME_KEY, name);
      alert(`已成功為「${name}」開立獨立身分空間！\n即將載入專屬頁面～`);
      window.location.reload();
    });
  }

  // Top nav device indicator
  const navDevIndicator = document.getElementById("nav-device-indicator");
  if (navDevIndicator) {
    navDevIndicator.addEventListener("click", () => {
      openSettings();
      // Activate tab-device
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      const devTabBtn = document.querySelector('.tab-btn[data-tab="tab-device"]');
      const devTab = document.getElementById("tab-device");
      if (devTabBtn && devTab) {
        devTabBtn.classList.add("active");
        devTab.classList.add("active");
      }
    });
  }

  const btnResetCfg = document.getElementById("btn-reset-device-config");
  if (btnResetCfg) {
    btnResetCfg.addEventListener("click", async () => {
      if (confirm("確定要將此裝置的自訂設定還原為主機的預設設定嗎？")) {
        try {
          const res = await fetch("/api/config/reset", { method: "POST" });
          const data = await res.json();
          state.config = data.config;
          updateUIWithConfig();
          alert("已成功還原為主機預設設定！");
        } catch (err) {
          alert("還原失敗: " + err.message);
        }
      }
    });
  }

  loadDeviceProfilesList();
}

// Gemini Web Auto-Login & Cookie Extraction Controls
let _geminiPollTimer = null;

function initGeminiAutoLoginControls() {
  const btnLaunch = document.getElementById("btn-launch-gemini-browser");
  const btnExtract = document.getElementById("btn-extract-gemini-cookies");
  const btnParse = document.getElementById("btn-parse-quick-cookie");
  const inputParse = document.getElementById("input-quick-cookie-paste");
  const statusBox = document.getElementById("gemini-auto-cookie-status");
  const downloadHelperLink = document.getElementById("btn-download-gemini-helper");

  if (downloadHelperLink) {
    downloadHelperLink.href = `/api/gemini/download_helper?device_id=${getDeviceId()}`;
  }

  function showStatus(text, type = "info") {
    if (!statusBox) return;
    statusBox.classList.remove("hidden");
    if (type === "success") {
      statusBox.style.background = "rgba(16, 185, 129, 0.12)";
      statusBox.style.border = "1px solid rgba(16, 185, 129, 0.4)";
      statusBox.style.color = "#34d399";
    } else if (type === "error") {
      statusBox.style.background = "rgba(239, 68, 68, 0.12)";
      statusBox.style.border = "1px solid rgba(239, 68, 68, 0.4)";
      statusBox.style.color = "#f87171";
    } else {
      statusBox.style.background = "rgba(59, 130, 246, 0.12)";
      statusBox.style.border = "1px solid rgba(59, 130, 246, 0.4)";
      statusBox.style.color = "#93c5fd";
    }
    statusBox.innerHTML = text;
  }

  // Quick Smart Parse Cookie / cURL Handler
  if (btnParse && inputParse) {
    btnParse.addEventListener("click", async () => {
      const text = inputParse.value.trim();
      if (!text) {
        showStatus("⚠️ 請先貼上 Cookie 字串或 cURL 命令！", "error");
        return;
      }
      btnParse.disabled = true;
      btnParse.textContent = "⏳ 解析中...";
      showStatus("⏳ 正在分析 Cookie 與標頭內容...", "info");

      try {
        const res = await fetch("/api/gemini/parse_cookies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ raw_text: text })
        });
        const data = await res.json();
        if (data.success && data.cookies && data.cookies["__Secure-1PSID"]) {
          if (cfgGeminiWeb1psid) cfgGeminiWeb1psid.value = data.cookies["__Secure-1PSID"];
          if (cfgGeminiWeb1psidts) cfgGeminiWeb1psidts.value = data.cookies["__Secure-1PSIDTS"] || "";
          if (cfgGeminiWeb1psidcc) cfgGeminiWeb1psidcc.value = data.cookies["__Secure-1PSIDCC"] || "";

          state.config.gemini_web_secure_1psid = data.cookies["__Secure-1PSID"];
          state.config.gemini_web_secure_1psidts = data.cookies["__Secure-1PSIDTS"] || "";
          state.config.gemini_web_secure_1psidcc = data.cookies["__Secure-1PSIDCC"] || "";
          state.config.provider = "gemini_web";
          cfgProvider.value = "gemini_web";
          updateGeminiAccountBadge();

          [cfgGeminiWeb1psid, cfgGeminiWeb1psidts, cfgGeminiWeb1psidcc].forEach(el => {
            if (el) {
              el.style.transition = "all 0.4s ease";
              el.style.borderColor = "#10b981";
              el.style.boxShadow = "0 0 10px rgba(16, 185, 129, 0.4)";
            }
          });

          showStatus("✅ 成功解析並已自動綁定至此身分專屬設定！點擊下方「儲存設定」或「測試連線」即可開始暢聊。", "success");
          inputParse.value = "";
        } else {
          showStatus(`⚠️ ${data.message || "未能從文字中解析出有效的 Google Cookie！"}`, "error");
        }
      } catch (err) {
        showStatus(`❌ 解析發生錯誤: ${err.message}`, "error");
      } finally {
        btnParse.disabled = false;
        btnParse.textContent = "✨ 一鍵解析填入";
      }
    });
  }

  async function tryExtractCookies(silent = false) {
    try {
      const res = await fetch("/api/gemini/extract_cookies", { method: "POST" });
      const data = await res.json();
      if (data.success && data.cookies && data.cookies["__Secure-1PSID"]) {
        // Fill into inputs
        if (cfgGeminiWeb1psid) cfgGeminiWeb1psid.value = data.cookies["__Secure-1PSID"];
        if (cfgGeminiWeb1psidts) cfgGeminiWeb1psidts.value = data.cookies["__Secure-1PSIDTS"] || "";
        if (cfgGeminiWeb1psidcc) cfgGeminiWeb1psidcc.value = data.cookies["__Secure-1PSIDCC"] || "";

        state.config.gemini_web_secure_1psid = data.cookies["__Secure-1PSID"];
        state.config.gemini_web_secure_1psidts = data.cookies["__Secure-1PSIDTS"] || "";
        state.config.gemini_web_secure_1psidcc = data.cookies["__Secure-1PSIDCC"] || "";
        state.config.provider = "gemini_web";
        cfgProvider.value = "gemini_web";
        updateGeminiAccountBadge();

        // Highlight inputs with a pulse
        [cfgGeminiWeb1psid, cfgGeminiWeb1psidts, cfgGeminiWeb1psidcc].forEach(el => {
          if (el) {
            el.style.transition = "all 0.4s ease";
            el.style.borderColor = "#10b981";
            el.style.boxShadow = "0 0 10px rgba(16, 185, 129, 0.4)";
          }
        });

        showStatus("✅ 成功自動抓取並綁定至此身分專屬設定！點擊下方「儲存設定」或「測試連線」即可開始使用。", "success");
        if (_geminiPollTimer) {
          clearInterval(_geminiPollTimer);
          _geminiPollTimer = null;
        }
        return true;
      } else {
        if (!silent) {
          showStatus(`⚠️ ${data.message || "尚未偵測到登入成功的 Cookie，請確認已在瀏覽器中完成登入！"}`, "error");
        }
        return false;
      }
    } catch (err) {
      if (!silent) {
        showStatus(`❌ 擷取失敗: ${err.message}`, "error");
      }
      return false;
    }
  }

  if (btnLaunch) {
    btnLaunch.addEventListener("click", async () => {
      btnLaunch.disabled = true;
      btnLaunch.textContent = "⏳ 正在啟動...";
      showStatus("⏳ 正在啟動獨立專屬 Chrome 登入視窗...", "info");

      try {
        const res = await fetch("/api/gemini/launch_login", { method: "POST" });
        const data = await res.json();
        if (data.success) {
          showStatus("🌐 <strong>專屬瀏覽器視窗已開啟！</strong><br>請在開啟的視窗中登入 Google 帳號 (gemini.google.com)。<br>登入完成後，系統會自動偵測填入，或您也可直接點擊「<strong>⚡ 2. 登入完成抓取</strong>」。", "info");

          // Start polling every 3 seconds up to 25 times (~75 seconds)
          if (_geminiPollTimer) clearInterval(_geminiPollTimer);
          let pollCount = 0;
          _geminiPollTimer = setInterval(async () => {
            pollCount++;
            if (pollCount > 25) {
              clearInterval(_geminiPollTimer);
              _geminiPollTimer = null;
              return;
            }
            const found = await tryExtractCookies(true);
            if (found) {
              clearInterval(_geminiPollTimer);
              _geminiPollTimer = null;
            }
          }, 3000);
        } else {
          showStatus(`⚠️ 啟動失敗: ${data.message}`, "error");
        }
      } catch (err) {
        showStatus(`❌ 請求失敗: ${err.message}`, "error");
      } finally {
        btnLaunch.disabled = false;
        btnLaunch.textContent = "🚀 1. 開啟獨立視窗";
      }
    });
  }

  if (btnExtract) {
    btnExtract.addEventListener("click", async () => {
      btnExtract.disabled = true;
      btnExtract.textContent = "⏳ 讀取中...";
      await tryExtractCookies(false);
      btnExtract.disabled = false;
      btnExtract.textContent = "⚡ 2. 登入完成抓取";
    });
  }
}

// Event Listeners Setup
function setupEventListeners() {
  initDevicePrivacyControls();
  initGeminiAutoLoginControls();

  // 對話框邊框風格切換（點擊循環切換）
  if (btnToggleBubbleStyle) {
    btnToggleBubbleStyle.addEventListener("click", cycleBubbleStyle);
  }
  if (cfgBubbleStyle) {
    cfgBubbleStyle.addEventListener("change", (e) => {
      applyBubbleStyle(e.target.value);
    });
  }

  // 聊天室主題與背景切換（點擊循環切換）
  if (btnToggleTheme) {
    btnToggleTheme.addEventListener("click", cycleChatTheme);
  }

  // 主題預設卡片點擊切換
  document.querySelectorAll(".theme-preset-card").forEach(card => {
    card.addEventListener("click", () => {
      const t = card.getAttribute("data-theme");
      applyChatTheme(t);
    });
  });

  // 擬物化外框下拉選單監聽
  if (cfgDeviceFrame) {
    cfgDeviceFrame.addEventListener("change", (e) => {
      applyDeviceFrame(e.target.value);
    });
  }

  // 自訂背景圖片上傳
  if (btnUploadChatBg && chatBgFileInput) {
    btnUploadChatBg.addEventListener("click", () => chatBgFileInput.click());
    chatBgFileInput.addEventListener("change", handleChatBgUpload);
  }

  // 自訂背景圖片網址輸入
  if (cfgChatBgUrl) {
    cfgChatBgUrl.addEventListener("input", (e) => {
      const url = e.target.value.trim();
      if (url) {
        applyChatTheme("custom", { url: url });
      } else {
        applyChatTheme("default", { url: "" });
      }
    });
  }

  // 羊皮紙與古典書籍字體切換按鈕
  if (btnParchmentFont) {
    btnParchmentFont.addEventListener("click", cycleParchmentFont);
  }
  if (btnBookFont) {
    btnBookFont.addEventListener("click", cycleParchmentFont);
  }

  // 清除背景
  if (btnClearChatBg) {
    btnClearChatBg.addEventListener("click", () => {
      applyChatTheme("default", { url: "" });
    });
  }

  // 遮罩暗度滑桿
  if (cfgBgOverlay) {
    cfgBgOverlay.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10);
      state.customBg.overlay = val;
      if (labelBgOverlay) labelBgOverlay.textContent = `${val}%`;
      if (state.chatTheme === "custom") {
        chatDialoguePanel.style.setProperty("--chat-overlay-bg", `rgba(0, 0, 0, ${val / 100})`);
      }
      saveThemePrefs();
    });
  }

  // 模糊度滑桿
  if (cfgBgBlur) {
    cfgBgBlur.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10);
      state.customBg.blur = val;
      if (labelBgBlur) labelBgBlur.textContent = `${val}px`;
      if (state.chatTheme === "custom") {
        chatDialoguePanel.style.setProperty("--chat-backdrop-blur", val > 0 ? `blur(${val}px)` : "none");
      }
      saveThemePrefs();
    });
  }

  // 切換側邊欄模式：循環 (展開 ↔ 迷你模式 ↔ 完全隱藏)
  btnToggleSidebar.addEventListener("click", () => {
    const curMode = state.layout.sidebarMode || "full";
    if (curMode === "full") {
      state.layout.sidebarMode = "mini";
    } else if (curMode === "mini") {
      state.layout.sidebarMode = "hidden";
    } else {
      state.layout.sidebarMode = "full";
      if (!state.layout.sidebarWidth || state.layout.sidebarWidth < SIDEBAR_MIN_PX) {
        state.layout.sidebarWidth = LAYOUT_DEFAULTS.sidebarWidth;
      }
    }
    applyLayout();
    saveLayoutPrefs();
  });

  if (btnCollapseSidebar) {
    btnCollapseSidebar.addEventListener("click", () => {
      state.layout.sidebarMode = "mini";
      applyLayout();
      saveLayoutPrefs();
    });
  }

  if (miniPersonaBtn) {
    miniPersonaBtn.addEventListener("click", () => {
      if (!state.personas || state.personas.length === 0) return;
      const idx = state.personas.findIndex(p => p.id === state.currentPersonaId);
      const nextIdx = (idx + 1) % state.personas.length;
      setPersona(state.personas[nextIdx].id);
    });
  }

  const activePersonaBadge = document.getElementById("active-persona-badge");
  if (activePersonaBadge) {
    activePersonaBadge.style.cursor = "pointer";
    activePersonaBadge.title = "點擊切換下一個對話角色 (Persona)";
    activePersonaBadge.addEventListener("click", () => {
      if (!state.personas || state.personas.length === 0) return;
      const idx = state.personas.findIndex(p => p.id === state.currentPersonaId);
      const nextIdx = (idx + 1) % state.personas.length;
      setPersona(state.personas[nextIdx].id);
    });
  }

  // Toggle Character Stage (SillyTavern VN layout)
  btnToggleStage.addEventListener("click", () => {
    toggleStageVisibility();
  });

  if (btnHideStage) {
    btnHideStage.addEventListener("click", () => {
      toggleStageVisibility(true);
    });
  }

  if (btnAutoRemoveBg) {
    btnAutoRemoveBg.addEventListener("click", handleAutoRemoveBg);
  }

  btnNewChat.addEventListener("click", () => {
    startNewChat();
  });

  personaSelect.addEventListener("change", (e) => {
    setPersona(e.target.value);
  });

  btnClearChat.addEventListener("click", () => {
    if (confirm("確定要清空當前視窗的訊息嗎？")) {
      startNewChat();
    }
  });

  // Stage Controls & Mode Switch
  btnChangeSprite.addEventListener("click", () => spriteFileInput.click());
  btnEmptyUpload.addEventListener("click", () => spriteFileInput.click());
  spriteFileInput.addEventListener("change", handleSpriteUpload);

  if (btnModeView) btnModeView.addEventListener("click", () => setStageMode("view"));
  if (btnModeInteract) btnModeInteract.addEventListener("click", () => setStageMode("interact"));
  if (btnModeEdit) btnModeEdit.addEventListener("click", () => setStageMode("edit"));
  if (btnOpenSpriteManager) btnOpenSpriteManager.addEventListener("click", () => openSpriteManagerModal("subtab-emotions"));
  if (stageEmotionBadge) stageEmotionBadge.addEventListener("click", () => openSpriteManagerModal("subtab-emotions"));

  if (emotionSpriteFileInput) emotionSpriteFileInput.addEventListener("change", handleEmotionSpriteUpload);

  if (spriteMgrPersonaSelect) {
    spriteMgrPersonaSelect.addEventListener("change", (e) => {
      const p = state.personas.find(item => item.id === e.target.value);
      if (p) {
        setPersona(p.id);
        renderEmotionCards(p);
        renderTouchZonesEditor(p);
      }
    });
  }

  // Sprite Manager Subtabs
  document.querySelectorAll(".subtab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".subtab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".subtab-content").forEach(c => c.classList.remove("active"));
      btn.classList.add("active");
      const subtabId = btn.getAttribute("data-subtab");
      const content = document.getElementById(subtabId);
      if (content) content.classList.add("active");
    });
  });

  if (btnAddTouchZone) btnAddTouchZone.addEventListener("click", handleAddTouchZone);
  if (btnSaveTouchZones) btnSaveTouchZones.addEventListener("click", handleSaveTouchZones);
  if (cfgAutoEmotion) cfgAutoEmotion.addEventListener("change", saveEmotionSettings);
  if (cfgEmotionMethod) cfgEmotionMethod.addEventListener("change", saveEmotionSettings);

  // Textarea auto-resize & keyboard send
  chatInput.addEventListener("input", autoResizeTextarea);
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  btnSend.addEventListener("click", handleSend);
  btnStop.addEventListener("click", stopStreaming);
  btnMic.addEventListener("click", toggleSpeechRecognition);

  // Settings Modal triggers
  btnOpenSettings.addEventListener("click", openSettings);
  modelIndicator.addEventListener("click", openSettings);
  btnCloseSettings.addEventListener("click", closeSettings);
  btnSaveSettings.addEventListener("click", saveSettings);
  if (btnSaveNewPersona) btnSaveNewPersona.addEventListener("click", saveNewPersona);

  // Suggestion card clicks
  document.querySelectorAll(".suggestion-card").forEach(card => {
    card.addEventListener("click", () => {
      const prompt = card.getAttribute("data-prompt");
      chatInput.value = prompt;
      autoResizeTextarea();
      handleSend();
    });
  });

  // Settings Tabs
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      btn.classList.add("active");
      const tabId = btn.getAttribute("data-tab");
      const targetContent = document.getElementById(tabId);
      if (targetContent) targetContent.classList.add("active");

      // Auto side-dock when in sprite tab, or widen for persona editor
      if (settingsModal) {
        settingsModal.classList.toggle("sprite-mode", tabId === "tab-sprite");
        settingsModal.classList.toggle("persona-mode", tabId === "tab-persona");
      }
      if (tabId === "tab-sprite") {
        const p = state.personas.find(item => item.id === state.currentPersonaId);
        if (p) updateLivePreviewPanel(p, state.currentEmotion || "default");
      }
      if (tabId === "tab-persona") {
        initLoveyPersonaEditor();
      }
    });
  });

  setupPeekStageButtons();

  cfgProvider.addEventListener("change", updateProviderFields);
  modelQuickSelect.addEventListener("change", (e) => {
    if (e.target.value) {
      cfgModel.value = e.target.value;
      if (typeof updateModelPillActive === "function") {
        updateModelPillActive(e.target.value);
      }
    }
  });

  if (cfgModel) {
    cfgModel.addEventListener("input", (e) => {
      const val = e.target.value.trim();
      if (typeof updateModelPillActive === "function") {
        updateModelPillActive(val);
      }
    });
  }

  // Preset chips click
  document.querySelectorAll(".preset-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".preset-chip").forEach(c => c.classList.remove("active-preset"));
      chip.classList.add("active-preset");
      const url = chip.getAttribute("data-url");
      const model = chip.getAttribute("data-model");
      if (url && cfgOpenaiUrl) cfgOpenaiUrl.value = url;
      if (model && cfgModel) {
        cfgModel.value = model;
        if (typeof updateModelPillActive === "function") {
          updateModelPillActive(model);
        }
      }
    });
  });

  // Test Connection Button click
  if (btnTestConnection) {
    btnTestConnection.addEventListener("click", runConnectionTest);
  }

  // 手機狀態列即時時鐘
  function updateStatusBarClock() {
    if (!statusBarTime) return;
    const now = new Date();
    const h = String(now.getHours()).padStart(2, "0");
    const m = String(now.getMinutes()).padStart(2, "0");
    statusBarTime.textContent = `${h}:${m}`;
  }
  updateStatusBarClock();
  setInterval(updateStatusBarClock, 1000);

  // 手機頂部與底部按鈕互動
  if (btnPhoneBack) {
    btnPhoneBack.addEventListener("click", () => {
      scrollToBottom();
    });
  }
  if (btnPhoneSearch) {
    btnPhoneSearch.addEventListener("click", () => {
      chatInput.focus();
    });
  }
  if (btnPhoneMenu) {
    btnPhoneMenu.addEventListener("click", openSettings);
  }
  if (btnPhoneCamera) {
    btnPhoneCamera.addEventListener("click", () => {
      spriteFileInput.click();
    });
  }
  if (btnPhoneGallery) {
    btnPhoneGallery.addEventListener("click", () => {
      openSettings();
      const themeTabBtn = document.querySelector('.tab-btn[data-tab="tab-theme"]');
      if (themeTabBtn) themeTabBtn.click();
    });
  }
  if (btnPhonePlus) {
    btnPhonePlus.addEventListener("click", () => {
      const emojis = ["✨", "😊", "👍", "❤️", "🎉", "🔥", "🐱", "☕"];
      const randEmoji = emojis[Math.floor(Math.random() * emojis.length)];
      chatInput.value += randEmoji;
      autoResizeTextarea();
      chatInput.focus();
    });
  }
  if (btnPhoneCall) {
    btnPhoneCall.addEventListener("click", () => {
      const p = state.personas.find(item => item.id === state.currentPersonaId);
      const name = p ? p.name : "角色";
      triggerSpeakingAura(4000);
      const callMsg = `📞 【語音通話已接通】喂～我是 ${name}！很高興收到你的電話，今天過得怎麼樣呢？`;
      appendMessage("assistant", callMsg);
      if (state.config.tts_auto_play) {
        speakText(`喂，我是 ${name}，很高興收到你的電話，今天過得怎麼樣呢？`);
      }
    });
  }
}

function autoResizeTextarea() {
  chatInput.style.height = "auto";
  chatInput.style.height = Math.min(chatInput.scrollHeight, 180) + "px";
}

// Config Management
async function loadAppConfig() {
  try {
    const res = await fetch("/api/config");
    state.config = await res.json();
    updateUIWithConfig();
  } catch (err) {
    console.error("Failed to load config:", err);
  }
}

function updateUIWithConfig() {
  const p = state.config.provider || "ollama";
  const m = state.config.model || "llama3";
  const pLabel = p === "gemini_web" ? "GEMINI WEB" : p.toUpperCase();
  navModelName.textContent = `${pLabel}: ${m}`;
  
  cfgProvider.value = p;
  cfgModel.value = m;
  cfgOllamaHost.value = state.config.ollama_host || "http://localhost:11434";
  cfgGeminiKey.value = state.config.gemini_api_key || "";
  if (cfgGeminiWeb1psid) cfgGeminiWeb1psid.value = state.config.gemini_web_secure_1psid || "";
  if (cfgGeminiWeb1psidts) cfgGeminiWeb1psidts.value = state.config.gemini_web_secure_1psidts || "";
  if (cfgGeminiWeb1psidcc) cfgGeminiWeb1psidcc.value = state.config.gemini_web_secure_1psidcc || "";
  if (cfgGeminiWebProxy) cfgGeminiWebProxy.value = state.config.gemini_web_proxy || "";
  cfgOpenaiKey.value = state.config.openai_api_key || "";
  cfgOpenaiUrl.value = state.config.openai_base_url || "https://api.openai.com/v1";
  cfgTtsVoice.value = state.config.tts_voice || "zh-TW-HsiaoChenNeural";
  cfgTtsAutoplay.checked = !!state.config.tts_auto_play;

  // Device & Privacy info
  const curDevId = getDeviceId();
  const devIdEl = document.getElementById("cfg-device-id");
  if (devIdEl) {
    devIdEl.value = curDevId === "default" ? "主機端 (default)" : curDevId;
  }
  const devNickEl = document.getElementById("cfg-device-nickname");
  const localNick = localStorage.getItem(DEVICE_NAME_KEY) || state.config._nickname || "";
  if (devNickEl) {
    devNickEl.value = localNick;
  }

  // Top Nav User Badge
  const navDevName = document.getElementById("nav-device-name");
  if (navDevName) {
    if (localNick) {
      navDevName.textContent = localNick;
    } else if (curDevId === "default") {
      navDevName.textContent = "主電腦 (預設)";
    } else {
      navDevName.textContent = `家人身分 (${curDevId.substring(0, 8)})`;
    }
  }

  // Update Gemini Web account status badge
  if (typeof updateGeminiAccountBadge === "function") {
    updateGeminiAccountBadge();
  }

  // Update Download Helper Link device_id
  const downloadHelperLink = document.getElementById("btn-download-gemini-helper");
  if (downloadHelperLink) {
    downloadHelperLink.href = `/api/gemini/download_helper?device_id=${curDevId}`;
  }

  // Reload profile switcher options if open
  if (typeof loadDeviceProfilesList === "function") {
    loadDeviceProfilesList();
  }

  updateProviderFields();
}

function updateProviderFields() {
  const val = cfgProvider.value;
  groupOllama.classList.add("hidden");
  groupGemini.classList.add("hidden");
  if (groupGeminiWeb) groupGeminiWeb.classList.add("hidden");
  groupOpenai.classList.add("hidden");

  if (val === "ollama") groupOllama.classList.remove("hidden");
  else if (val === "gemini") groupGemini.classList.remove("hidden");
  else if (val === "gemini_web") {
    if (groupGeminiWeb) groupGeminiWeb.classList.remove("hidden");
  }
  else groupOpenai.classList.remove("hidden");

  loadModelList();
}

async function loadModelList() {
  try {
    const res = await fetch("/api/models");
    const data = await res.json();
    const prov = cfgProvider.value;
    modelQuickSelect.innerHTML = '<option value="">快速選擇模型...</option>';
    
    let list = [];
    if (prov === "ollama") list = data.ollama || [];
    else if (prov === "gemini") list = data.gemini || [];
    else if (prov === "gemini_web") list = data.gemini_web || ["gemini-flash", "gemini-pro", "gemini-flash-lite"];
    else list = data.openai || [];

    const currModel = (cfgModel.value || "").trim();

    list.forEach(m => {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m;
      if (m === currModel) opt.selected = true;
      modelQuickSelect.appendChild(opt);
    });

    renderModelPills(list);
  } catch (e) {
    console.error("Failed to fetch models:", e);
  }
}

function updateModelPillActive(modelName) {
  if (!modelTagsList) return;
  document.querySelectorAll(".model-tag-pill").forEach(p => {
    const pillModel = p.getAttribute("data-model");
    if (pillModel === modelName) {
      p.classList.add("active");
    } else {
      p.classList.remove("active");
    }
  });
}

function renderModelPills(models) {
  if (!modelTagsWrapper || !modelTagsList) return;
  modelTagsList.innerHTML = "";
  if (!models || models.length === 0) {
    modelTagsWrapper.classList.add("hidden");
    return;
  }

  if (modelTagsCount) {
    modelTagsCount.textContent = `共 ${models.length} 個可用模型`;
  }
  modelTagsWrapper.classList.remove("hidden");

  const currentModel = (cfgModel.value || "").trim();

  models.forEach(m => {
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = "model-tag-pill";
    pill.setAttribute("data-model", m);
    if (m === currentModel) pill.classList.add("active");

    const lower = m.toLowerCase();
    let icon = "⚡";
    let desc = "";
    if (lower.includes("reasoner") || lower.includes("r1")) {
      pill.classList.add("badge-reasoner");
      icon = "🧠";
      desc = " (深度思考)";
    } else if (lower.includes("chat")) {
      icon = "💬";
      desc = " (通用對話)";
    } else if (lower.includes("pro")) {
      icon = "👑";
    }

    pill.innerHTML = `<span>${icon}</span> <span>${escapeHtml(m)}${desc}</span>`;
    pill.title = `點擊立即選用模型：${m}`;

    pill.addEventListener("click", () => {
      cfgModel.value = m;
      updateModelPillActive(m);
      if (modelQuickSelect) modelQuickSelect.value = m;
    });

    modelTagsList.appendChild(pill);
  });
}

async function runConnectionTest() {
  if (!btnTestConnection) return;
  const provider = cfgProvider.value;
  
  // Set loading state
  btnTestConnection.disabled = true;
  if (testSpinner) testSpinner.classList.remove("hidden");
  if (testIcon) testIcon.classList.add("hidden");
  if (testText) testText.textContent = "連線檢測中，正在查詢可用模型...";

  if (connectionTestResult) {
    connectionTestResult.className = "conn-result-card hidden";
  }

  const payload = {
    provider: provider,
    ollama_host: cfgOllamaHost ? cfgOllamaHost.value.trim() : "",
    gemini_api_key: cfgGeminiKey ? cfgGeminiKey.value.trim() : "",
    secure_1psid: cfgGeminiWeb1psid ? cfgGeminiWeb1psid.value.trim() : "",
    secure_1psidts: cfgGeminiWeb1psidts ? cfgGeminiWeb1psidts.value.trim() : "",
    secure_1psidcc: cfgGeminiWeb1psidcc ? cfgGeminiWeb1psidcc.value.trim() : "",
    gemini_web_proxy: cfgGeminiWebProxy ? cfgGeminiWebProxy.value.trim() : "",
    openai_api_key: cfgOpenaiKey ? cfgOpenaiKey.value.trim() : "",
    openai_base_url: cfgOpenaiUrl ? cfgOpenaiUrl.value.trim() : ""
  };

  try {
    const res = await fetch("/api/models/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    if (result.success) {
      connectionTestResult.className = "conn-result-card conn-result-success";
      connectionTestResult.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:16px;">✅</span>
          <div>
            <strong>連線成功！</strong> ${escapeHtml(result.message)}
          </div>
        </div>
        <span class="badge-latency">${result.latency_ms || 0} ms</span>
      `;
      connectionTestResult.classList.remove("hidden");

      // Update Quick Select Dropdown
      if (result.models && result.models.length > 0) {
        modelQuickSelect.innerHTML = '<option value="">快速選擇模型...</option>';
        result.models.forEach(m => {
          const opt = document.createElement("option");
          opt.value = m;
          opt.textContent = m;
          if (m === cfgModel.value) opt.selected = true;
          modelQuickSelect.appendChild(opt);
        });

        // If current model is empty, default to the first one
        if (!cfgModel.value.trim()) {
          cfgModel.value = result.models[0];
        }

        // Render interactive model pills
        renderModelPills(result.models);
      }
    } else {
      connectionTestResult.className = "conn-result-card conn-result-error";
      connectionTestResult.innerHTML = `
        <div style="display:flex; align-items:flex-start; gap:8px;">
          <span style="font-size:16px;">❌</span>
          <div>
            <strong>連線失敗：</strong> ${escapeHtml(result.message || "未知連線異常")}
          </div>
        </div>
      `;
      connectionTestResult.classList.remove("hidden");
    }
  } catch (err) {
    if (connectionTestResult) {
      connectionTestResult.className = "conn-result-card conn-result-error";
      connectionTestResult.innerHTML = `
        <div style="display:flex; align-items:flex-start; gap:8px;">
          <span style="font-size:16px;">❌</span>
          <div>
            <strong>連線請求異常：</strong> ${escapeHtml(err.message)}
          </div>
        </div>
      `;
      connectionTestResult.classList.remove("hidden");
    }
  } finally {
    btnTestConnection.disabled = false;
    if (testSpinner) testSpinner.classList.add("hidden");
    if (testIcon) testIcon.classList.remove("hidden");
    if (testText) testText.textContent = "測試連線並取得模型列表";
  }
}

async function loadVoices() {
  try {
    const res = await fetch("/api/voices");
    const voices = await res.json();
    cfgTtsVoice.innerHTML = "";
    voices.forEach(v => {
      const opt = document.createElement("option");
      opt.value = v.id;
      opt.textContent = v.name;
      cfgTtsVoice.appendChild(opt);
    });
  } catch (e) {
    console.error("Failed to fetch voices:", e);
  }
}

// Personas & Sprite Management
async function loadPersonas() {
  try {
    const res = await fetch("/api/personas");
    state.personas = await res.json();
    
    // 背景預先載入所有角色的立繪與表情圖片，存入記憶體快取以徹底消除換圖延遲與閃爍
    if (typeof preloadAllPersonaSprites === "function") {
      preloadAllPersonaSprites();
    }

    personaSelect.innerHTML = "";
    state.personas.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = `${p.avatar} ${p.name}`;
      personaSelect.appendChild(opt);
    });

    // 優先從 localStorage 還原使用者先前使用中的角色，若不存在則使用 state.currentPersonaId 或第一個角色
    const savedPersonaId = localStorage.getItem("ai-chat:active-persona-id");
    const activePersona = state.personas.find(p => p.id === savedPersonaId)
      || state.personas.find(p => p.id === state.currentPersonaId)
      || state.personas[0];

    const activeId = activePersona ? activePersona.id : "assistant";
    setPersona(activeId, false);

    if (typeof renderLoveyPersonaDropdown === "function") {
      renderLoveyPersonaDropdown(activeId);
    }
  } catch (err) {
    console.error("Failed to load personas:", err);
  }
}

function setPersona(personaId, syncSession = true) {
  // 1. 立即清除正在倒數的表情定時器，避免前一個角色的表情定時還原衝擊當前角色
  if (state.emotionTimeout) {
    clearTimeout(state.emotionTimeout);
    state.emotionTimeout = null;
  }
  state.currentEmotion = "default";

  state.currentPersonaId = personaId;
  try {
    localStorage.setItem("ai-chat:active-persona-id", personaId);
  } catch (e) {}

  personaSelect.value = personaId;
  const p = state.personas.find(item => item.id === personaId);
  if (!p) return;

  // Update Navbar badges
  navPersonaAvatar.textContent = p.avatar;
  navPersonaName.textContent = p.name;

  // Update Stage Nameplate & Empty Avatar
  stagePersonaAvatar.textContent = p.avatar;
  stagePersonaName.textContent = p.name;
  emptyAvatarCircle.textContent = p.avatar;
  emptySpriteTitle.textContent = `${p.name} 尚未配置立繪`;

  // Update Mini Mode Avatar & Tooltip
  if (miniPersonaAvatar) miniPersonaAvatar.textContent = p.avatar;
  if (miniPersonaBtn) miniPersonaBtn.setAttribute("data-tooltip", `${p.avatar} ${p.name} (點擊切換)`);

  if (previewSpeakerName) {
    previewSpeakerName.textContent = p.name;
  }
  if (themePreviewAvatar) {
    themePreviewAvatar.textContent = p.avatar;
  }
  if (phoneChatTargetName) {
    phoneChatTargetName.textContent = p.name;
  }
  if (parchmentMainTitle) {
    parchmentMainTitle.textContent = `與 ${p.name} 的手稿對話錄`;
  }

  // 即時同步更新聊天面板中所有 AI 助理訊息的大頭像與角色名稱
  updateChatAssistantAvatars(p);

  // 同步更新當前 Session 的 character_id 到伺服器資料庫
  if (syncSession && state.currentSessionId) {
    fetch(`/api/sessions/${state.currentSessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ character_id: personaId })
    }).catch(err => console.warn("Failed to sync session persona:", err));
  }

  renderCharacterSprite(p);

  // 若當前處於空白新對話，同步切換為此角色的初次見面開場白
  if (!state.currentSessionId && typeof startNewChat === "function") {
    startNewChat();
  }
}

// 動態更新聊天視窗中所有助理訊息的頭像與名稱
function updateChatAssistantAvatars(persona) {
  if (!persona) return;
  const avatarHtml = getPersonaAvatarHtml(persona, "assistant");
  const assistantRows = document.querySelectorAll(".message-row.assistant");
  assistantRows.forEach(row => {
    const avatarEl = row.querySelector(".msg-avatar");
    const nameEl = row.querySelector(".speaker-name");
    if (avatarEl) {
      avatarEl.innerHTML = avatarHtml;
    }
    if (nameEl) {
      nameEl.textContent = persona.name;
    }
  });
}

function getPersonaAvatarHtml(persona, role = "assistant") {
  if (role === "user") return "👤";
  if (!persona) return "🤖";
  if (persona.avatar && (persona.avatar.startsWith("/") || persona.avatar.startsWith("http"))) {
    return `<img src="${persona.avatar}" alt="${escapeHtml(persona.name)}" class="avatar-img">`;
  }
  return persona.avatar || "🤖";
}

// 全域立繪預載與切換保護（徹底杜絕切換立繪時閃爍前一個角色/表情的殘影問題）
function preloadAllPersonaSprites() {
  if (!state.personas || !Array.isArray(state.personas)) return;
  const loadedUrls = new Set();
  state.personas.forEach(p => {
    if (p.image_url && !loadedUrls.has(p.image_url)) {
      loadedUrls.add(p.image_url);
      const img = new Image();
      img.src = p.image_url;
    }
    if (p.emotions && typeof p.emotions === "object") {
      Object.values(p.emotions).forEach(url => {
        if (url && !loadedUrls.has(url)) {
          loadedUrls.add(url);
          const img = new Image();
          img.src = url;
        }
      });
    }
  });
}

function safelySwitchSpriteImage(targetUrl, personaId, emotionKey, callback) {
  state.spriteRequestId = (state.spriteRequestId || 0) + 1;
  const currentReqId = state.spriteRequestId;

  if (!characterSprite) return;

  if (!targetUrl) {
    characterSprite.style.opacity = "0";
    characterSprite.src = "";
    characterSprite.classList.add("hidden");
    if (spriteEmptyState) spriteEmptyState.classList.remove("hidden");
    return;
  }

  // 1. 若當前已經是這張圖片且正在正常顯示，不重複觸發載入
  const currentSrc = characterSprite.getAttribute("src") || characterSprite.src || "";
  if (currentSrc && (currentSrc === targetUrl || currentSrc.endsWith(targetUrl)) && !characterSprite.classList.contains("hidden")) {
    characterSprite.style.opacity = "1";
    if (callback) callback();
    return;
  }

  // 2. 避免前一個角色的畫面在等待新圖期間停留閃動：先柔和淡出
  characterSprite.style.transition = "opacity 0.12s ease";
  characterSprite.style.opacity = "0.15";

  // 3. 在背景使用 Image 物件先行非同步解碼新圖片
  const imgLoader = new Image();
  imgLoader.src = targetUrl;

  const onReady = () => {
    // 檢查此請求是否仍是最新請求（若使用者在載入期間又點了其他角色或表情，直接丟棄過期請求）
    if (currentReqId !== state.spriteRequestId) return;
    if (personaId && personaId !== state.currentPersonaId) return;

    characterSprite.src = targetUrl;
    characterSprite.classList.remove("hidden");
    if (spriteEmptyState) spriteEmptyState.classList.add("hidden");

    // 觸發微淡入重繪
    void characterSprite.offsetWidth;
    characterSprite.style.opacity = "1";

    if (callback) callback();
  };

  if (imgLoader.decode) {
    imgLoader.decode().then(onReady).catch(() => {
      if (imgLoader.complete) {
        onReady();
      } else {
        imgLoader.onload = onReady;
        imgLoader.onerror = onReady;
      }
    });
  } else {
    imgLoader.onload = onReady;
    imgLoader.onerror = onReady;
  }
}

function renderCharacterSprite(persona) {
  // 若該角色設定為不顯示立繪
  if (persona.display_mode === "none") {
    toggleStageVisibility(true);
    return;
  } else {
    // 檢查使用者是否全域手動偏好隱藏；若否且目前收合，則自動展開
    const userHidden = localStorage.getItem("ai-chat:stage-hidden") === "true";
    if (!userHidden && characterStage && characterStage.classList.contains("collapsed")) {
      toggleStageVisibility(false);
    }
  }

  state.currentEmotion = "default";
  if (stageEmotionBadge) {
    stageEmotionBadge.textContent = "✨ 預設";
  }

  const emotions = persona.emotions || {};
  const currentImg = emotions["default"] || persona.image_url;

  // 使用安全無縫換圖，背景非同步解碼新圖片後再顯現，徹底杜絕舊角色殘影閃爍
  safelySwitchSpriteImage(currentImg, persona.id, "default", () => {
    syncTouchOverlayBounds();
    renderTouchOverlay();
  });

  // 立繪縮放/平移：有圖才顯示控制鈕，並載入此角色上次的檢視範圍
  const hasSprite = !!currentImg;
  spriteContainer.classList.toggle("has-sprite", hasSprite);
  spriteZoomControls.classList.toggle("hidden", !hasSprite);
  state.spriteView = loadSpriteView(persona.id);
  applySpriteView();

  // 渲染觸碰熱區
  renderTouchOverlay();
}

// Upload Sprite Image
async function handleSpriteUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  await uploadSpriteFile(file);
  spriteFileInput.value = "";
}

async function uploadSpriteFile(file) {
  const p = state.personas.find(item => item.id === state.currentPersonaId);
  if (!p) return;

  const formData = new FormData();
  formData.append("file", file);

  try {
    btnChangeSprite.textContent = "⏳ 上傳中...";
    const res = await fetch(`/api/personas/${p.id}/avatar`, {
      method: "POST",
      body: formData
    });

    if (!res.ok) throw new Error("Upload failed");

    const updatedPersona = await res.json();
    p.image_url = updatedPersona.image_url;
    clearSpriteView(p.id); // 換了新圖，舊的縮放/位置不再適用
    renderCharacterSprite(p);
  } catch (err) {
    alert("上傳立繪失敗: " + err.message);
  } finally {
    btnChangeSprite.textContent = "🖼️ 換立繪";
  }
}

// ===== Stage Visibility & Multi-Emotion Sprites =====

// 切換立繪展示區顯示/隱藏
function toggleStageVisibility(forceCollapse) {
  if (!characterStage) return;
  const isCurrentlyCollapsed = characterStage.classList.contains("collapsed");
  const shouldCollapse = forceCollapse !== undefined ? forceCollapse : !isCurrentlyCollapsed;

  characterStage.classList.toggle("collapsed", shouldCollapse);
  if (btnToggleStage) {
    btnToggleStage.classList.toggle("active", !shouldCollapse);
    btnToggleStage.title = shouldCollapse ? "開啟角色立繪展示區" : "隱藏角色立繪展示區";
  }

  if (stageResizer) {
    stageResizer.style.display = shouldCollapse ? "none" : "";
  }

  try {
    localStorage.setItem("ai-chat:stage-hidden", shouldCollapse ? "true" : "false");
  } catch (e) {}

  // 若從收合切換為展開，重新套用立繪縮放/位置並校準熱區邊界
  if (!shouldCollapse) {
    requestAnimationFrame(() => {
      applySpriteView();
      syncTouchOverlayBounds();
    });
  }
}

// 一鍵立繪去背 (將此角色的所有立繪轉為透明 PNG)
async function handleAutoRemoveBg() {
  const p = state.personas.find(item => item.id === state.currentPersonaId);
  if (!p) return;

  if (!confirm(`確定要為角色「${p.name}」的所有立繪一鍵去除白色背景嗎？\n處理後會自動轉換為透明 PNG 格式。`)) return;

  try {
    if (btnAutoRemoveBg) {
      btnAutoRemoveBg.textContent = "⏳ 去背處理中...";
      btnAutoRemoveBg.disabled = true;
    }

    const res = await fetch(`/api/personas/${p.id}/remove_background`, {
      method: "POST"
    });

    if (!res.ok) throw new Error("Remove background request failed");

    const updated = await res.json();
    p.emotions = updated.emotions || {};
    p.image_url = updated.image_url || "";

    // 立即刷新畫面立繪
    const currentImg = (p.emotions && p.emotions[state.currentEmotion]) || p.image_url;
    if (currentImg && characterSprite) {
      safelySwitchSpriteImage(currentImg, p.id, state.currentEmotion);
    }

    renderEmotionCards(p);
    alert("✨ 一鍵去背成功！所有表情圖片已轉為透明底圖。");
  } catch (err) {
    alert("去背失敗: " + err.message);
  } finally {
    if (btnAutoRemoveBg) {
      btnAutoRemoveBg.textContent = "✨ 一鍵去背 (轉透明)";
      btnAutoRemoveBg.disabled = false;
    }
  }
}

// 切換立繪模式: view (視角縮放/平移) | interact (互動觸碰) | edit (熱區劃定與調整)
function setStageMode(mode) {
  state.stageMode = mode;

  // 切換 Stage 狀態 class
  if (characterStage) {
    characterStage.classList.toggle("mode-interactive", mode === "interact");
    characterStage.classList.toggle("mode-edit", mode === "edit");
  }

  // 更新模式切換按鈕高亮
  if (btnModeView) btnModeView.classList.toggle("active", mode === "view");
  if (btnModeInteract) btnModeInteract.classList.toggle("active", mode === "interact");
  if (btnModeEdit) btnModeEdit.classList.toggle("active", mode === "edit");

  // 重新渲染觸碰熱區覆蓋層
  renderTouchOverlay();
}

// 切換角色表情圖片與回饋動畫
function setSpriteEmotion(emotion, options = {}) {
  const p = state.personas.find(item => item.id === state.currentPersonaId);
  if (!p) return;

  const validEmotion = EMOTION_META[emotion] ? emotion : "default";
  state.currentEmotion = validEmotion;
  const meta = EMOTION_META[validEmotion] || { name: "平常", icon: "✨" };

  // 1. 更換立繪圖片 (若該情緒有獨立圖片則採用，否則套用預設立繪)
  const emotions = p.emotions || {};
  const targetImg = emotions[validEmotion] || p.image_url;
  if (characterSprite) {
    safelySwitchSpriteImage(targetImg, p.id, validEmotion, () => {
      syncTouchOverlayBounds();
      renderTouchOverlay();
    });
  }

  // 2. 更新右上角表情標籤徽章
  if (stageEmotionBadge) {
    stageEmotionBadge.textContent = `${meta.icon} ${meta.name.split(" / ")[0]}`;
    stageEmotionBadge.classList.remove("badge-pulse");
    void stageEmotionBadge.offsetWidth;
    stageEmotionBadge.classList.add("badge-pulse");
    setTimeout(() => {
      stageEmotionBadge.classList.remove("badge-pulse");
    }, 1000);
  }

  // 3. 觸發立繪動態效果 (完全靜態穩定，不晃動；害羞時僅保留柔和泛紅光暈)
  if (characterSprite) {
    characterSprite.classList.remove("sprite-bounce", "sprite-blush");
    if (validEmotion === "shy") {
      void characterSprite.offsetWidth;
      characterSprite.classList.add("sprite-blush");
      setTimeout(() => {
        characterSprite.classList.remove("sprite-blush");
      }, 600);
    }
  }

  // 4. 處理暫時表情計時器 (若有指定 temporary 或秒數，到期自動恢復 default)
  if (state.emotionTimeout) {
    clearTimeout(state.emotionTimeout);
    state.emotionTimeout = null;
  }

  let isTemp = false;
  let duration = 5000;
  if (typeof options === "number") {
    isTemp = options > 0;
    duration = options;
  } else if (typeof options === "object" && options.temporary) {
    isTemp = true;
    duration = options.duration || 5000;
  }

  if (isTemp && validEmotion !== "default") {
    state.emotionTimeout = setTimeout(() => {
      // 確保到期時仍是同一個角色才恢復為 default 表情，徹底防止跨角色突襲切圖
      if (state.currentPersonaId === p.id) {
        setSpriteEmotion("default");
      }
    }, duration);
  }

  // 5. 若立繪設定視窗開啟，同步更新彈窗內的即時預覽面板
  if (typeof updateLivePreviewPanel === "function") {
    updateLivePreviewPanel(p, validEmotion);
  }
}

// 精準將觸碰熱區覆蓋層貼合至角色立繪圖片 (100% 像素級吻合，徹底杜絕 CSS 容器未撐開或位移問題)
function syncTouchOverlayBounds() {
  if (!spriteTouchOverlay || !characterSprite) return;
  if (characterSprite.classList.contains("hidden") || !characterSprite.src) {
    spriteTouchOverlay.style.display = "none";
    return;
  }
  spriteTouchOverlay.style.display = "";

  // 取得 characterSprite 實際渲染尺寸與相對於 offsetParent (即 sprite-anchor) 的精準偏移
  const imgW = characterSprite.offsetWidth;
  const imgH = characterSprite.offsetHeight;
  const imgTop = characterSprite.offsetTop;
  const imgLeft = characterSprite.offsetLeft;

  if (imgW > 0 && imgH > 0) {
    spriteTouchOverlay.style.position = "absolute";
    spriteTouchOverlay.style.top = `${imgTop}px`;
    spriteTouchOverlay.style.left = `${imgLeft}px`;
    spriteTouchOverlay.style.width = `${imgW}px`;
    spriteTouchOverlay.style.height = `${imgH}px`;
  }
}

// 監聽立繪圖片載入完成，即時同步熱區層邊界
if (characterSprite) {
  characterSprite.addEventListener("load", () => {
    syncTouchOverlayBounds();
    renderTouchOverlay();
  });
}
window.addEventListener("resize", () => {
  syncTouchOverlayBounds();
});

// 渲染角色立繪身上的觸碰感應熱區
function renderTouchOverlay() {
  if (!spriteTouchOverlay) return;
  syncTouchOverlayBounds();
  spriteTouchOverlay.innerHTML = "";

  // 視角模式下熱區不作用（讓拖曳與縮放順暢進行）
  if (state.stageMode === "view") return;

  const p = state.personas.find(item => item.id === state.currentPersonaId);
  if (!p || !p.touch_zones || p.touch_zones.length === 0) return;

  // 依優先度排序（數字越小越優先，覆蓋時能被優先觸發）
  const zones = [...p.touch_zones].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));

  zones.forEach(z => {
    const box = document.createElement("div");
    box.className = "touch-zone-box";
    box.style.left = `${z.x}%`;
    box.style.top = `${z.y}%`;
    box.style.width = `${z.width}%`;
    box.style.height = `${z.height}%`;
    // 優先度越高的 z-index 越高
    box.style.zIndex = `${100 - (z.priority || 0)}`;

    if (state.stageMode === "interact") {
      box.title = `${z.name || "觸碰部位"} (點擊互動)`;
      box.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        triggerTouchZone(z, e);
      });
    } else if (state.stageMode === "edit") {
      box.title = `${z.name} - 優先度 #${z.priority || 1} (點擊開啟熱區設定)`;
      box.innerHTML = `
        <span class="touch-zone-label">
          <span class="touch-zone-priority">${z.priority || 1}</span>
          <span>${escapeHtml(z.name || "熱區")}</span>
        </span>
      `;
      box.addEventListener("click", (e) => {
        e.stopPropagation();
        openSpriteManagerModal("subtab-zones");
      });
    }

    spriteTouchOverlay.appendChild(box);
  });
}

// 觸發觸碰熱區互動效果
function triggerTouchZone(zone, event) {
  // 1. 切換至熱區指定表情
  if (zone.emotion) {
    setSpriteEmotion(zone.emotion, { temporary: true, duration: 4000 });
  }

  // 2. 顯示浮動台詞對話氣泡
  if (zone.dialogue) {
    showReactionBalloon(zone.dialogue, event);
  }
}

// 顯示立繪身上的浮動反應對話氣泡
function showReactionBalloon(text, event) {
  if (!spriteReactionBubble || !reactionBubbleText) return;

  if (state.reactionTimeout) {
    clearTimeout(state.reactionTimeout);
    state.reactionTimeout = null;
  }

  const meta = EMOTION_META[state.currentEmotion] || { icon: "✨" };
  if (reactionBubbleIcon) {
    reactionBubbleIcon.textContent = meta.icon;
  }
  reactionBubbleText.textContent = text;

  spriteReactionBubble.classList.remove("hidden");

  // 重新觸發彈出動畫
  spriteReactionBubble.classList.remove("bubble-pop");
  void spriteReactionBubble.offsetWidth;
  spriteReactionBubble.classList.add("bubble-pop");

  state.reactionTimeout = setTimeout(() => {
    spriteReactionBubble.classList.add("hidden");
  }, 3500);
}

// 點擊對話氣泡可手動提前關閉
if (spriteReactionBubble) {
  spriteReactionBubble.addEventListener("click", () => {
    spriteReactionBubble.classList.add("hidden");
    if (state.reactionTimeout) {
      clearTimeout(state.reactionTimeout);
      state.reactionTimeout = null;
    }
  });
}

// 在立繪上以滑鼠拖曳畫出新的感應熱區
function setupEditModeDrawing() {
  if (!spriteTouchOverlay) return;

  let isDrawing = false;
  let startX = 0;
  let startY = 0;
  let previewBox = null;

  spriteTouchOverlay.addEventListener("pointerdown", (e) => {
    if (state.stageMode !== "edit" || e.button !== 0) return;
    if (e.target.closest(".touch-zone-label") || e.target.closest(".touch-zone-box")) return;

    e.preventDefault();
    isDrawing = true;
    spriteTouchOverlay.setPointerCapture(e.pointerId);

    const rect = spriteTouchOverlay.getBoundingClientRect();
    startX = clamp(((e.clientX - rect.left) / rect.width) * 100, 0, 100);
    startY = clamp(((e.clientY - rect.top) / rect.height) * 100, 0, 100);

    previewBox = document.createElement("div");
    previewBox.className = "touch-zone-box";
    previewBox.style.border = "2px dashed #f43f5e";
    previewBox.style.background = "rgba(244, 63, 94, 0.25)";
    previewBox.style.left = `${startX}%`;
    previewBox.style.top = `${startY}%`;
    previewBox.style.width = "0%";
    previewBox.style.height = "0%";
    previewBox.style.zIndex = "200";
    spriteTouchOverlay.appendChild(previewBox);

    const onMove = (ev) => {
      if (!isDrawing || !previewBox) return;
      const curX = clamp(((ev.clientX - rect.left) / rect.width) * 100, 0, 100);
      const curY = clamp(((ev.clientY - rect.top) / rect.height) * 100, 0, 100);

      const x = Math.min(startX, curX);
      const y = Math.min(startY, curY);
      const w = Math.abs(curX - startX);
      const h = Math.abs(curY - startY);

      previewBox.style.left = `${x.toFixed(1)}%`;
      previewBox.style.top = `${y.toFixed(1)}%`;
      previewBox.style.width = `${w.toFixed(1)}%`;
      previewBox.style.height = `${h.toFixed(1)}%`;
    };

    const onUp = async () => {
      if (!isDrawing) return;
      isDrawing = false;
      spriteTouchOverlay.removeEventListener("pointermove", onMove);
      spriteTouchOverlay.removeEventListener("pointerup", onUp);
      spriteTouchOverlay.removeEventListener("pointercancel", onUp);

      if (!previewBox) return;
      const finalW = parseFloat(previewBox.style.width);
      const finalH = parseFloat(previewBox.style.height);
      const finalX = parseFloat(previewBox.style.left);
      const finalY = parseFloat(previewBox.style.top);
      previewBox.remove();
      previewBox = null;

      // 至少大於 3% 才視為有效繪製
      if (finalW > 3 && finalH > 3) {
        const p = state.personas.find(item => item.id === state.currentPersonaId);
        if (!p) return;
        if (!p.touch_zones) p.touch_zones = [];

        const newPriority = p.touch_zones.length + 1;
        const newZone = {
          id: "zone_" + Date.now().toString(36),
          name: `新部位 ${newPriority}`,
          x: Math.round(finalX),
          y: Math.round(finalY),
          width: Math.round(finalW),
          height: Math.round(finalH),
          emotion: "happy",
          dialogue: "摸到這裡了呢！✨",
          priority: newPriority
        };

        p.touch_zones.push(newZone);
        await saveTouchZonesToServer(p.id, p.touch_zones);
        renderTouchOverlay();
        openSpriteManagerModal("subtab-zones");
      }
    };

    spriteTouchOverlay.addEventListener("pointermove", onMove);
    spriteTouchOverlay.addEventListener("pointerup", onUp);
    spriteTouchOverlay.addEventListener("pointercancel", onUp);
  });
}

// 更新彈窗內的立繪即時預覽面板
function updateLivePreviewPanel(persona, emotionKey = "default") {
  const panel = document.getElementById("sprite-live-preview-panel");
  if (!panel || !persona) return;

  const previewImg = document.getElementById("sprite-live-preview-img");
  const previewBadge = document.getElementById("sprite-live-preview-badge");
  const previewTitle = document.getElementById("sprite-preview-title");
  const previewPose = document.getElementById("sprite-preview-pose-text");
  const previewDesc = document.getElementById("sprite-preview-desc");

  const meta = EMOTION_META[emotionKey] || EMOTION_META.default;
  const emotions = persona.emotions || {};
  const imgSrc = emotions[emotionKey] || (emotionKey === "default" ? persona.image_url : (emotions.default || persona.image_url));

  if (previewImg) {
    if (imgSrc) {
      previewImg.src = imgSrc;
      previewImg.style.display = "block";
    } else {
      previewImg.style.display = "none";
    }
  }

  if (previewBadge) {
    previewBadge.textContent = `${meta.icon} ${meta.name.split("/")[0].trim()}`;
  }

  if (previewTitle) {
    previewTitle.innerHTML = `🎭 當前預覽表情：${meta.icon} <strong>${escapeHtml(meta.name)}</strong>`;
  }

  if (previewPose) {
    previewPose.textContent = meta.pose || "平常優雅站姿";
  }

  if (previewDesc) {
    previewDesc.textContent = meta.desc || "角色專屬立繪。已完成純綠幕去背，無破圖瑕疵。";
  }
}

// 設置透視舞台按鈕
function setupPeekStageButtons() {
  const peekBtns = [document.getElementById("btn-header-peek"), document.getElementById("btn-peek-stage")];

  peekBtns.forEach(btn => {
    if (!btn) return;

    // 按住半透明透視
    btn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      if (settingsModal) settingsModal.classList.add("peek-active");
    });

    btn.addEventListener("touchstart", (e) => {
      e.preventDefault();
      if (settingsModal) settingsModal.classList.add("peek-active");
    }, { passive: false });

    const endPeek = () => {
      if (settingsModal) settingsModal.classList.remove("peek-active");
    };

    btn.addEventListener("mouseup", endPeek);
    btn.addEventListener("mouseleave", endPeek);
    btn.addEventListener("touchend", endPeek);
    btn.addEventListener("touchcancel", endPeek);

    // 點擊切換透視開關
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      if (settingsModal) {
        settingsModal.classList.toggle("peek-active");
      }
    });
  });

  if (settingsModal) {
    settingsModal.addEventListener("click", (e) => {
      if (e.target === settingsModal && settingsModal.classList.contains("peek-active")) {
        settingsModal.classList.remove("peek-active");
      }
    });
  }
}

// 打開多表情立繪與觸碰熱區設定視窗
function openSpriteManagerModal(defaultSubtab = "subtab-emotions") {
  // 切換至立繪與熱區設定分頁
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

  const tabBtn = document.querySelector('.tab-btn[data-tab="tab-sprite"]');
  if (tabBtn) tabBtn.classList.add("active");
  const tabContent = document.getElementById("tab-sprite");
  if (tabContent) tabContent.classList.add("active");

  // 切換指定子分頁
  document.querySelectorAll(".subtab-btn").forEach(b => {
    b.classList.toggle("active", b.getAttribute("data-subtab") === defaultSubtab);
  });
  document.querySelectorAll(".subtab-content").forEach(c => {
    c.classList.toggle("active", c.id === defaultSubtab);
  });

  // 更新角色下拉清單
  if (spriteMgrPersonaSelect) {
    spriteMgrPersonaSelect.innerHTML = state.personas.map(p => `
      <option value="${p.id}" ${p.id === state.currentPersonaId ? "selected" : ""}>
        ${p.avatar || "🤖"} ${escapeHtml(p.name)}
      </option>
    `).join("");
  }

  const p = state.personas.find(item => item.id === state.currentPersonaId);
  if (p) {
    if (cfgAutoEmotion) cfgAutoEmotion.checked = p.auto_emotion !== false;
    if (cfgEmotionMethod) cfgEmotionMethod.value = p.emotion_method || "rules";
    renderEmotionCards(p);
    renderTouchZonesEditor(p);
    updateLivePreviewPanel(p, state.currentEmotion || "default");
  }

  if (settingsModal) {
    settingsModal.classList.add("sprite-mode");
    settingsModal.classList.remove("hidden");
  }
}

// 渲染多表情立繪卡片清單
function renderEmotionCards(persona) {
  if (!emotionCardsGrid || !persona) return;
  const emotions = persona.emotions || {};

  emotionCardsGrid.innerHTML = Object.entries(EMOTION_META).map(([key, meta]) => {
    const isDefault = key === "default";
    const customImg = emotions[key];
    const displayImg = customImg || (isDefault ? persona.image_url : "");
    const hasCustomImg = !!customImg || (isDefault && !!persona.image_url);

    return `
      <div class="emotion-card ${state.currentEmotion === key ? "active-preview" : ""}" data-emotion="${key}" title="點擊預覽此表情立繪與全身站姿">
        <div class="emotion-card-title">
          <span>${meta.icon}</span>
          <span>${escapeHtml(meta.name)}</span>
        </div>
        <div class="emotion-thumb-wrap">
          ${displayImg 
            ? `<img class="emotion-thumb-img" src="${displayImg}" alt="${escapeHtml(meta.name)}">`
            : `<div class="emotion-thumb-empty">${meta.icon}</div>`
          }
        </div>
        <div class="emotion-card-pose" title="${escapeHtml(meta.pose || "")}">🧍 ${escapeHtml(meta.pose || "全身站姿")}</div>
        <div class="emotion-card-status ${hasCustomImg ? "has-img" : ""}">
          ${hasCustomImg ? "✓ 已設定專屬立繪" : "套用預設立繪"}
        </div>
        <div class="emotion-card-actions">
          <button type="button" class="btn-emotion-action btn-upload-emotion" data-emotion="${key}">📁 上傳</button>
          <button type="button" class="btn-emotion-action btn-preview-emotion" data-emotion="${key}">👁️ 預覽</button>
          ${!isDefault && customImg ? `
            <button type="button" class="btn-emotion-del btn-del-emotion" data-emotion="${key}" title="刪除此表情立繪並恢復預設">🗑️</button>
          ` : ""}
        </div>
      </div>
    `;
  }).join("");

  // 綁定各卡片操作事件
  emotionCardsGrid.querySelectorAll(".btn-upload-emotion").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const emotionKey = btn.getAttribute("data-emotion");
      state.currentEditingEmotion = emotionKey;
      if (emotionSpriteFileInput) emotionSpriteFileInput.click();
    });
  });

  emotionCardsGrid.querySelectorAll(".btn-preview-emotion").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const emotionKey = btn.getAttribute("data-emotion");
      setSpriteEmotion(emotionKey, { temporary: true, duration: 8000 });
      updateLivePreviewPanel(persona, emotionKey);
      renderEmotionCards(persona);
    });
  });

  emotionCardsGrid.querySelectorAll(".emotion-card").forEach(card => {
    card.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      const emotionKey = card.getAttribute("data-emotion");
      setSpriteEmotion(emotionKey, { temporary: true, duration: 8000 });
      updateLivePreviewPanel(persona, emotionKey);
      renderEmotionCards(persona);
    });
  });

  emotionCardsGrid.querySelectorAll(".btn-del-emotion").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const emotionKey = btn.getAttribute("data-emotion");
      deleteEmotionSprite(persona.id, emotionKey);
    });
  });
}

// 處理表情立繪上傳
async function handleEmotionSpriteUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const p = state.personas.find(item => item.id === state.currentPersonaId);
  const emotion = state.currentEditingEmotion || "default";
  if (!p) return;

  await uploadEmotionSpriteFile(p.id, emotion, file);
  emotionSpriteFileInput.value = "";
}

async function uploadEmotionSpriteFile(personaId, emotion, file) {
  const p = state.personas.find(item => item.id === personaId);
  if (!p) return;

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch(`/api/personas/${personaId}/emotions/${emotion}`, {
      method: "POST",
      body: formData
    });

    if (!res.ok) throw new Error("Upload emotion sprite failed");

    const updatedPersona = await res.json();
    p.emotions = updatedPersona.emotions || {};
    if (emotion === "default") {
      p.image_url = updatedPersona.image_url;
    }

    // 若當前角色立繪正處於該表情，立即刷新畫面
    if (state.currentEmotion === emotion || (emotion === "default" && state.currentEmotion === "default")) {
      const currentImg = p.emotions[emotion] || p.image_url;
      safelySwitchSpriteImage(currentImg, p.id, emotion);
    }

    renderEmotionCards(p);
  } catch (err) {
    alert("上傳表情立繪失敗: " + err.message);
  }
}

// 刪除自訂表情立繪
async function deleteEmotionSprite(personaId, emotion) {
  if (!confirm(`確定要刪除「${EMOTION_META[emotion]?.name || emotion}」的自訂立繪嗎？刪除後將套用預設立繪。`)) return;

  const p = state.personas.find(item => item.id === personaId);
  if (!p) return;

  try {
    const res = await fetch(`/api/personas/${personaId}/emotions/${emotion}`, {
      method: "DELETE"
    });

    if (!res.ok) throw new Error("Delete failed");

    const updated = await res.json();
    p.emotions = updated.emotions || {};

    if (state.currentEmotion === emotion) {
      setSpriteEmotion("default");
    }

    renderEmotionCards(p);
  } catch (err) {
    alert("刪除失敗: " + err.message);
  }
}

// 渲染熱區設定編輯器
function renderTouchZonesEditor(persona) {
  if (!touchZonesList || !persona) return;

  const zones = [...(persona.touch_zones || [])].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));

  if (zones.length === 0) {
    touchZonesList.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 30px; border: 1px dashed var(--border); border-radius: 8px;">
        尚未設定觸碰熱區。點擊上方「＋ 新增感應熱區」或切換到【📐 熱區模式】在立繪上直接拖曳框選！
      </div>
    `;
    return;
  }

  touchZonesList.innerHTML = zones.map(z => `
    <div class="touch-zone-card" data-zone-id="${z.id}">
      <div class="zone-header-row">
        <div class="zone-title-wrap">
          <span class="zone-priority-badge">優先度 #${z.priority || 1}</span>
          <input type="text" class="custom-input zone-name-input" value="${escapeHtml(z.name || '')}" placeholder="熱區名稱 (例如: 摸摸頭)" style="font-weight: 600; width: 140px;">
        </div>
        <div style="display: flex; gap: 6px;">
          <button type="button" class="btn-secondary btn-sm btn-test-zone" data-zone-id="${z.id}" title="在立繪上測試此熱區效果">▶️ 測試反應</button>
          <button type="button" class="btn-danger btn-sm btn-del-zone" data-zone-id="${z.id}" title="刪除此熱區">🗑️</button>
        </div>
      </div>
      <div class="zone-fields-grid">
        <div>
          <label style="font-size: 11px; color: var(--text-muted); margin-bottom: 2px; display: block;">觸碰時切換表情</label>
          <select class="custom-select zone-emotion-select" style="font-size: 12px; padding: 4px;">
            ${Object.entries(EMOTION_META).map(([k, m]) => `
              <option value="${k}" ${z.emotion === k ? "selected" : ""}>${m.icon} ${m.name.split(" / ")[0]}</option>
            `).join("")}
          </select>
        </div>
        <div>
          <label style="font-size: 11px; color: var(--text-muted); margin-bottom: 2px; display: block;">優先判定順序 (1 最優先)</label>
          <input type="number" class="custom-input zone-priority-input" min="1" max="99" value="${z.priority || 1}" style="font-size: 12px; padding: 4px;">
        </div>
        <div>
          <label style="font-size: 11px; color: var(--text-muted); margin-bottom: 2px; display: block;">回應台詞 / 對話氣泡</label>
          <input type="text" class="custom-input zone-dialogue-input" value="${escapeHtml(z.dialogue || '')}" placeholder="被觸摸時的反應台詞..." style="font-size: 12px; padding: 4px;">
        </div>
      </div>
      <div class="zone-coords-row">
        <div class="coord-item">
          <span>X:</span>
          <input type="number" class="custom-input coord-x" min="0" max="100" value="${z.x ?? 0}"><span>%</span>
        </div>
        <div class="coord-item">
          <span>Y:</span>
          <input type="number" class="custom-input coord-y" min="0" max="100" value="${z.y ?? 0}"><span>%</span>
        </div>
        <div class="coord-item">
          <span>寬:</span>
          <input type="number" class="custom-input coord-w" min="1" max="100" value="${z.width ?? 20}"><span>%</span>
        </div>
        <div class="coord-item">
          <span>高:</span>
          <input type="number" class="custom-input coord-h" min="1" max="100" value="${z.height ?? 20}"><span>%</span>
        </div>
      </div>
    </div>
  `).join("");

  // 綁定測試按鈕與刪除按鈕
  touchZonesList.querySelectorAll(".btn-test-zone").forEach(btn => {
    btn.addEventListener("click", () => {
      const zid = btn.getAttribute("data-zone-id");
      const targetZone = persona.touch_zones?.find(item => item.id === zid);
      if (targetZone) {
        triggerTouchZone(targetZone);
      }
    });
  });

  touchZonesList.querySelectorAll(".btn-del-zone").forEach(btn => {
    btn.addEventListener("click", async () => {
      const zid = btn.getAttribute("data-zone-id");
      if (!confirm("確定要刪除這個感應熱區嗎？")) return;
      persona.touch_zones = (persona.touch_zones || []).filter(item => item.id !== zid);
      await saveTouchZonesToServer(persona.id, persona.touch_zones);
      renderTouchZonesEditor(persona);
      renderTouchOverlay();
    });
  });
}

// 新增一個感應熱區
async function handleAddTouchZone() {
  const p = state.personas.find(item => item.id === state.currentPersonaId);
  if (!p) return;
  if (!p.touch_zones) p.touch_zones = [];

  const newPriority = p.touch_zones.length + 1;
  const newZone = {
    id: "zone_" + Date.now().toString(36),
    name: `感應部位 ${newPriority}`,
    x: 25,
    y: 20,
    width: 50,
    height: 25,
    emotion: "happy",
    dialogue: "摸到這裡了呢！✨",
    priority: newPriority
  };

  p.touch_zones.push(newZone);
  await saveTouchZonesToServer(p.id, p.touch_zones);
  renderTouchZonesEditor(p);
  renderTouchOverlay();
}

// 儲存所有熱區設定
async function handleSaveTouchZones() {
  const p = state.personas.find(item => item.id === state.currentPersonaId);
  if (!p) return;

  const cardElements = touchZonesList.querySelectorAll(".touch-zone-card");
  const updatedZones = [];

  cardElements.forEach(card => {
    const id = card.getAttribute("data-zone-id");
    const name = card.querySelector(".zone-name-input")?.value.trim() || "感應熱區";
    const emotion = card.querySelector(".zone-emotion-select")?.value || "default";
    const priority = parseInt(card.querySelector(".zone-priority-input")?.value || "1", 10);
    const dialogue = card.querySelector(".zone-dialogue-input")?.value.trim() || "";
    const x = clamp(parseFloat(card.querySelector(".coord-x")?.value || "0"), 0, 100);
    const y = clamp(parseFloat(card.querySelector(".coord-y")?.value || "0"), 0, 100);
    const width = clamp(parseFloat(card.querySelector(".coord-w")?.value || "20"), 1, 100);
    const height = clamp(parseFloat(card.querySelector(".coord-h")?.value || "20"), 1, 100);

    updatedZones.push({
      id,
      name,
      emotion,
      priority,
      dialogue,
      x,
      y,
      width,
      height
    });
  });

  p.touch_zones = updatedZones;
  await saveTouchZonesToServer(p.id, p.touch_zones);
  renderTouchZonesEditor(p);
  renderTouchOverlay();
  alert("觸碰感應熱區設定儲存成功！");
}

// 儲存熱區至後端 API
async function saveTouchZonesToServer(personaId, zones) {
  try {
    const res = await fetch(`/api/personas/${personaId}/touch_zones`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ touch_zones: zones })
    });
    if (!res.ok) throw new Error("Save touch zones failed");
    const result = await res.json();
    return result;
  } catch (err) {
    console.error("儲存熱區失敗:", err);
  }
}

// 儲存自動表情切換開關與判斷方式
async function saveEmotionSettings() {
  const p = state.personas.find(item => item.id === state.currentPersonaId);
  if (!p) return;

  const autoEmotion = cfgAutoEmotion ? cfgAutoEmotion.checked : true;
  const method = cfgEmotionMethod ? cfgEmotionMethod.value : "rules";

  p.auto_emotion = autoEmotion;
  p.emotion_method = method;

  try {
    await fetch(`/api/personas/${p.id}/emotion_settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        auto_emotion: autoEmotion,
        emotion_method: method
      })
    });
  } catch (err) {
    console.error("儲存情緒設定失敗:", err);
  }
}

// Drag and drop image to Character Stage
function setupDragAndDrop() {
  ["dragenter", "dragover", "dragleave", "drop"].forEach(eventName => {
    spriteContainer.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  ["dragenter", "dragover"].forEach(eventName => {
    spriteContainer.addEventListener(eventName, () => {
      spriteContainer.style.background = "rgba(59, 130, 246, 0.15)";
    });
  });

  ["dragleave", "drop"].forEach(eventName => {
    spriteContainer.addEventListener(eventName, () => {
      spriteContainer.style.background = "";
    });
  });

  spriteContainer.addEventListener("drop", (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0 && files[0].type.startsWith("image/")) {
      uploadSpriteFile(files[0]);
    }
  });
}

// ===== Layout: 可調整大小的分隔條 & 左右/上下並排切換 =====
const LAYOUT_STORAGE_KEY = "ai-chat:layout";
const LAYOUT_DEFAULTS = {
  orientation: "horizontal", // "horizontal" = 左右並排，"vertical" = 上下並排
  sidebarWidth: 260,         // 側邊欄展開寬度 (px)
  sidebarMode: "full",       // "full" = 展開, "mini" = 迷你圖示欄 (68px), "hidden" = 完全隱藏
  stageSizeH: 38,            // 左右並排時立繪區寬度（佔工作區 %）
  stageSizeV: 45             // 上下並排時立繪區高度（佔工作區 %）
};
const SIDEBAR_MIN_PX = 160;
const SIDEBAR_MAX_PX = 480;
const STAGE_MIN_PCT = 15;
const STAGE_MAX_PCT = 85;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function loadLayoutPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY) || "{}");
    return { ...LAYOUT_DEFAULTS, ...saved };
  } catch (e) {
    return { ...LAYOUT_DEFAULTS };
  }
}

function saveLayoutPrefs() {
  try {
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(state.layout));
  } catch (e) {
    console.warn("Failed to save layout prefs:", e);
  }
}

// 將 state.layout 套用到畫面
function applyLayout() {
  const { orientation, sidebarWidth, sidebarMode = "full", stageSizeH, stageSizeV } = state.layout;
  const isVertical = orientation === "vertical";

  // Sidebar 狀態套用
  const isHidden = sidebarMode === "hidden";
  const isMini = sidebarMode === "mini";

  sidebar.classList.toggle("collapsed", isHidden);
  sidebar.classList.toggle("mini", isMini);
  btnToggleSidebar.classList.toggle("active", !isHidden);

  if (isMini) {
    document.documentElement.style.setProperty("--sidebar-width", "68px");
  } else if (!isHidden) {
    document.documentElement.style.setProperty("--sidebar-width", `${sidebarWidth}px`);
  }

  chatWorkspace.classList.toggle("layout-vertical", isVertical);
  chatWorkspace.style.setProperty("--stage-size", `${isVertical ? stageSizeV : stageSizeH}%`);

  stageResizer.classList.toggle("resizer-row", isVertical);
  stageResizer.setAttribute("aria-orientation", isVertical ? "horizontal" : "vertical");

  layoutIcon.textContent = isVertical ? "⇅" : "⇆";
  layoutLabel.textContent = isVertical ? "上下並排" : "左右並排";
}

/**
 * 讓分隔條可拖曳。
 * @param {HTMLElement} handle  分隔條元素
 * @param {Object} opts
 * @param {() => "row"|"col"} opts.getAxis  目前拖曳方向（決定游標）
 * @param {(ev: PointerEvent) => void} opts.onDrag  拖曳中更新 state.layout
 * @param {() => void} opts.onReset  雙擊時還原預設值
 */
function attachResizer(handle, { getAxis, onDrag, onReset }) {
  handle.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    handle.classList.add("active");
    document.body.classList.add("is-resizing", getAxis() === "row" ? "resizing-row" : "resizing-col");

    const onMove = (ev) => {
      onDrag(ev);
      applyLayout();
    };
    const onUp = () => {
      handle.classList.remove("active");
      document.body.classList.remove("is-resizing", "resizing-row", "resizing-col");
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      saveLayoutPrefs();
    };

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  });

  handle.addEventListener("dblclick", () => {
    onReset();
    applyLayout();
    saveLayoutPrefs();
  });
}

function setupLayoutControls() {
  state.layout = loadLayoutPrefs();
  applyLayout();

  // 側邊欄寬度與磁吸縮合 (full ↔ mini ↔ hidden)
  attachResizer(sidebarResizer, {
    getAxis: () => "col",
    onDrag: (ev) => {
      const left = sidebar.getBoundingClientRect().left;
      const targetW = ev.clientX - left;

      if (targetW < 50) {
        // 拖到小於 50px：自動吸附完全隱藏
        state.layout.sidebarMode = "hidden";
      } else if (targetW < 140) {
        // 拖到 50px ~ 140px：自動吸附進入迷你圖示欄模式 (68px)
        state.layout.sidebarMode = "mini";
      } else {
        // 正常展開模式 (160px ~ 480px)
        state.layout.sidebarMode = "full";
        state.layout.sidebarWidth = Math.round(clamp(targetW, SIDEBAR_MIN_PX, SIDEBAR_MAX_PX));
      }
    },
    onReset: () => {
      state.layout.sidebarMode = "full";
      state.layout.sidebarWidth = LAYOUT_DEFAULTS.sidebarWidth;
    }
  });

  // 立繪區 ↔ 對話框比例（依並排方向調整寬度或高度）
  attachResizer(stageResizer, {
    getAxis: () => (state.layout.orientation === "vertical" ? "row" : "col"),
    onDrag: (ev) => {
      const rect = chatWorkspace.getBoundingClientRect();
      if (state.layout.orientation === "vertical") {
        const pct = ((ev.clientY - rect.top) / rect.height) * 100;
        state.layout.stageSizeV = clamp(pct, STAGE_MIN_PCT, STAGE_MAX_PCT);
      } else {
        const pct = ((ev.clientX - rect.left) / rect.width) * 100;
        state.layout.stageSizeH = clamp(pct, STAGE_MIN_PCT, STAGE_MAX_PCT);
      }
    },
    onReset: () => {
      if (state.layout.orientation === "vertical") {
        state.layout.stageSizeV = LAYOUT_DEFAULTS.stageSizeV;
      } else {
        state.layout.stageSizeH = LAYOUT_DEFAULTS.stageSizeH;
      }
    }
  });

  // 左右 / 上下並排切換
  btnToggleLayout.addEventListener("click", () => {
    state.layout.orientation = state.layout.orientation === "vertical" ? "horizontal" : "vertical";
    applyLayout();
    saveLayoutPrefs();
  });
}

// ===== Bubble Frame Styles: 對話框邊框風格模組 =====
const BUBBLE_STYLES = {
  comic: { id: "comic", name: "漫畫說話框", icon: "🗯️", className: "bubble-style-comic" },
  vn:    { id: "vn",    name: "視覺小說框", icon: "🌸", className: "bubble-style-vn" },
  cyber: { id: "cyber", name: "賽博科技框", icon: "⚡", className: "bubble-style-cyber" },
  clean: { id: "clean", name: "圓潤簡約框", icon: "🫧", className: "bubble-style-clean" }
};
const BUBBLE_STYLE_KEYS = ["comic", "vn", "cyber", "clean"];

function loadBubbleStylePrefs() {
  const saved = localStorage.getItem("ai_chat_bubble_style");
  return BUBBLE_STYLES[saved] ? saved : "comic";
}

function applyBubbleStyle(styleKey) {
  if (!BUBBLE_STYLES[styleKey]) styleKey = "comic";
  state.bubbleStyle = styleKey;
  localStorage.setItem("ai_chat_bubble_style", styleKey);

  BUBBLE_STYLE_KEYS.forEach(k => {
    chatDialoguePanel.classList.remove(BUBBLE_STYLES[k].className);
  });
  chatDialoguePanel.classList.add(BUBBLE_STYLES[styleKey].className);

  if (bubbleStyleIcon) bubbleStyleIcon.textContent = BUBBLE_STYLES[styleKey].icon;
  if (bubbleStyleLabel) bubbleStyleLabel.textContent = BUBBLE_STYLES[styleKey].name;
  if (btnToggleBubbleStyle) btnToggleBubbleStyle.title = `目前：${BUBBLE_STYLES[styleKey].name}（點擊切換下一個風格）`;

  if (cfgBubbleStyle) cfgBubbleStyle.value = styleKey;

  if (previewBubbleCard) {
    previewBubbleCard.className = `preview-bubble-card preview-${styleKey}`;
    const p = state.personas.find(item => item.id === state.currentPersonaId);
    if (previewSpeakerName) previewSpeakerName.textContent = p?.name || "AI 角色";
  }
}

function cycleBubbleStyle() {
  const curIdx = BUBBLE_STYLE_KEYS.indexOf(state.bubbleStyle || "comic");
  const nextIdx = (curIdx + 1) % BUBBLE_STYLE_KEYS.length;
  applyBubbleStyle(BUBBLE_STYLE_KEYS[nextIdx]);
}

// ===== Chat Themes & Backgrounds: 聊天室主題與背景模組 =====
const CHAT_THEMES = {
  line: {
    id: "line",
    name: "LINE通訊",
    icon: "📱",
    className: "theme-line",
    desc: "經典LINE天空藍灰、綠白氣泡與已讀時間"
  },
  parchment: {
    id: "parchment",
    name: "典藏羊皮紙",
    icon: "📜",
    className: "theme-parchment",
    desc: "古老羊皮手稿、字下緊貼行線、草書墨跡與外置寫作案"
  },
  kraft: {
    id: "kraft",
    name: "典藏羊皮紙",
    icon: "📜",
    className: "theme-parchment",
    desc: "古老羊皮手稿、字下緊貼行線、草書墨跡與外置寫作案"
  },
  book: {
    id: "book",
    name: "古典書本",
    icon: "📖",
    className: "theme-book",
    desc: "精裝書扉頁中縫陰影、古典襯線排版"
  },
  default: {
    id: "default",
    name: "深色科技",
    icon: "🌌",
    className: "theme-default",
    desc: "預設科技星空底色與漫畫邊框風格"
  },
  custom: {
    id: "custom",
    name: "自訂背景",
    icon: "🖼️",
    className: "theme-custom",
    desc: "使用者私人背景圖片與半透明毛玻璃"
  }
};

const CHAT_THEME_KEYS = ["line", "parchment", "book", "default"];
const THEME_STORAGE_KEY = "ai_chat_theme_settings";
const PARCHMENT_FONT_STORAGE_KEY = "ai_chat_parchment_font";

// 羊皮紙字型設定 (草書墨寶 / 手抄楷體 / 典雅宋體)
const PARCHMENT_FONTS = [
  { id: "cursive", name: "草書墨寶", icon: "🖋️", className: "parchment-font-cursive" },
  { id: "kaiti", name: "手抄楷體", icon: "✒️", className: "parchment-font-kaiti" },
  { id: "serif", name: "典雅宋體", icon: "📜", className: "parchment-font-serif" }
];

function applyParchmentFont(fontId) {
  if (!fontId) {
    try {
      fontId = localStorage.getItem(PARCHMENT_FONT_STORAGE_KEY) || "cursive";
    } catch (e) { fontId = "cursive"; }
  }
  state.parchmentFont = fontId;
  PARCHMENT_FONTS.forEach(f => chatDialoguePanel.classList.remove(f.className));
  const target = PARCHMENT_FONTS.find(f => f.id === fontId) || PARCHMENT_FONTS[0];
  chatDialoguePanel.classList.add(target.className);
  if (parchmentFontLabel) parchmentFontLabel.textContent = target.name;
  if (bookFontLabel) bookFontLabel.textContent = target.name;
  if (bookFontIcon) bookFontIcon.textContent = target.icon;
  try {
    localStorage.setItem(PARCHMENT_FONT_STORAGE_KEY, fontId);
  } catch (e) {}
}

function cycleParchmentFont() {
  const curIdx = PARCHMENT_FONTS.findIndex(f => f.id === state.parchmentFont);
  const nextIdx = (curIdx + 1) % PARCHMENT_FONTS.length;
  applyParchmentFont(PARCHMENT_FONTS[nextIdx].id);
}

function loadThemePrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(THEME_STORAGE_KEY) || "null");
    if (saved && saved.theme) {
      let t = saved.theme;
      if (t === "kraft") t = "parchment";
      return {
        theme: CHAT_THEMES[t] ? t : "line",
        deviceFrame: saved.deviceFrame || (t === "parchment" ? "parchment" : "phone"),
        customBg: {
          url: saved.customBg?.url || "",
          overlay: Number.isFinite(saved.customBg?.overlay) ? saved.customBg.overlay : 20,
          blur: Number.isFinite(saved.customBg?.blur) ? saved.customBg.blur : 0
        }
      };
    }
  } catch (e) { /* ignore */ }
  return {
    theme: "line",
    deviceFrame: "phone",
    customBg: { url: "", overlay: 20, blur: 0 }
  };
}

function saveThemePrefs() {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({
      theme: state.chatTheme,
      deviceFrame: state.deviceFrame,
      customBg: state.customBg
    }));
  } catch (e) {
    console.warn("Failed to save theme prefs:", e);
  }
}

function applyDeviceFrame(frameKey) {
  const validFrames = ["phone", "parchment", "kraft", "book", "none"];
  if (!validFrames.includes(frameKey)) frameKey = "phone";
  if (frameKey === "kraft") frameKey = "parchment";
  state.deviceFrame = frameKey;
  chatDialoguePanel.classList.remove("frame-phone", "frame-parchment", "frame-kraft", "frame-book", "frame-none");
  chatDialoguePanel.classList.add(`frame-${frameKey}`);
  if (cfgDeviceFrame) cfgDeviceFrame.value = frameKey;

  // 更新輸入框 placeholder 與書寫感
  if (chatInput) {
    if (frameKey === "parchment") {
      chatInput.placeholder = "✒️ 執筆書寫故事篇章... (Enter 寫入羊皮紙，Shift + Enter 換行)";
    } else if (frameKey === "book") {
      chatInput.placeholder = "✒️ 研墨落筆，續寫典籍篇章... (Enter 寫入書卷，Shift + Enter 換行)";
    } else {
      chatInput.placeholder = "輸入訊息... (Enter 發送，Shift + Enter 換行)";
    }
  }

  saveThemePrefs();
}

function applyChatTheme(themeId, customSettings) {
  if (themeId === "kraft") themeId = "parchment";
  if (!CHAT_THEMES[themeId]) themeId = "line";
  state.chatTheme = themeId;
  if (customSettings) {
    state.customBg = { ...state.customBg, ...customSettings };
  }

  // 清除舊主題 class
  Object.values(CHAT_THEMES).forEach(t => {
    chatDialoguePanel.classList.remove(t.className);
  });
  // 套用新主題 class
  chatDialoguePanel.classList.add(CHAT_THEMES[themeId].className);

  // 套用對應擬物化外框 class
  const THEME_FRAME_MAP = {
    line: "phone",
    parchment: "parchment",
    kraft: "parchment",
    book: "book",
    default: "none",
    custom: "phone"
  };
  const targetFrame = THEME_FRAME_MAP[themeId] || "phone";
  applyDeviceFrame(targetFrame);

  if (targetFrame === "parchment" || targetFrame === "book") {
    applyParchmentFont(state.parchmentFont);
  } else {
    // 切換至 LINE通訊、深色科技、自訂背景等現代主題時，清除所有草書/古風字體 class，堅決還原現代字型！
    PARCHMENT_FONTS.forEach(f => chatDialoguePanel.classList.remove(f.className));
  }

  // 處理自訂背景圖或主題背景
  if (themeId === "custom" && state.customBg.url) {
    chatDialoguePanel.style.setProperty("--chat-bg-image", `url('${state.customBg.url}')`);
    chatDialoguePanel.style.setProperty("--chat-bg-color", "#0b1120");
    chatDialoguePanel.style.setProperty("--chat-overlay-bg", `rgba(0, 0, 0, ${state.customBg.overlay / 100})`);
    chatDialoguePanel.style.setProperty("--chat-backdrop-blur", state.customBg.blur > 0 ? `blur(${state.customBg.blur}px)` : "none");
  } else {
    chatDialoguePanel.style.removeProperty("--chat-bg-image");
    chatDialoguePanel.style.removeProperty("--chat-bg-color");
    chatDialoguePanel.style.removeProperty("--chat-overlay-bg");
    chatDialoguePanel.style.removeProperty("--chat-backdrop-blur");
  }

  // 更新頂部按鈕狀態
  if (navThemeIcon) navThemeIcon.textContent = CHAT_THEMES[themeId].icon;
  if (navThemeLabel) navThemeLabel.textContent = CHAT_THEMES[themeId].name;
  if (btnToggleTheme) btnToggleTheme.title = `目前主題：${CHAT_THEMES[themeId].name}（點擊切換下一個主題）`;

  // 更新手機頂部對話對象名字
  const currentPersona = state.personas.find(item => item.id === state.currentPersonaId);
  if (phoneChatTargetName && currentPersona) {
    phoneChatTargetName.textContent = currentPersona.name;
  }
  // 更新羊皮紙手稿標題
  if (parchmentMainTitle && currentPersona) {
    parchmentMainTitle.textContent = `與 ${currentPersona.name} 的手稿對話錄`;
  }
  // 更新古籍頁眉章節
  if (bookChapterTitle && currentPersona) {
    bookChapterTitle.textContent = `第壹章 ‧ ${currentPersona.name}之書`;
  }

  // 更新設定視窗內的控制項
  updateThemeSettingsUI();
  saveThemePrefs();
}

function cycleChatTheme() {
  const currentKey = state.chatTheme === "custom" ? "default" : state.chatTheme;
  const curIdx = CHAT_THEME_KEYS.indexOf(currentKey);
  const nextIdx = (curIdx + 1) % CHAT_THEME_KEYS.length;
  applyChatTheme(CHAT_THEME_KEYS[nextIdx]);
}

function updateThemeSettingsUI() {
  // 更新主題卡片 active 狀態
  document.querySelectorAll(".theme-preset-card").forEach(card => {
    const t = card.getAttribute("data-theme");
    card.classList.toggle("active", t === state.chatTheme);
  });

  // 更新自訂背景輸入項
  if (cfgChatBgUrl) cfgChatBgUrl.value = state.customBg.url || "";
  if (cfgBgOverlay) cfgBgOverlay.value = state.customBg.overlay;
  if (labelBgOverlay) labelBgOverlay.textContent = `${state.customBg.overlay}%`;
  if (cfgBgBlur) cfgBgBlur.value = state.customBg.blur;
  if (labelBgBlur) labelBgBlur.textContent = `${state.customBg.blur}px`;

  // 更新外框選擇下拉框
  if (cfgDeviceFrame) cfgDeviceFrame.value = state.deviceFrame;

  // 更新即時預覽卡片
  if (themePreviewBox) {
    const t = state.chatTheme;
    themePreviewBox.className = `preview-mini-chat theme-${t}`;
    if (t === "custom" && state.customBg.url) {
      themePreviewBox.style.backgroundImage = `url('${state.customBg.url}')`;
      themePreviewBox.style.setProperty("--chat-overlay-bg", `rgba(0, 0, 0, ${state.customBg.overlay / 100})`);
    } else {
      themePreviewBox.style.backgroundImage = "";
      themePreviewBox.style.removeProperty("--chat-overlay-bg");
    }

    const p = state.personas.find(item => item.id === state.currentPersonaId);
    if (themePreviewAvatar) themePreviewAvatar.textContent = p?.avatar || "🤖";
  }
}

async function handleChatBgUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("file", file);

  try {
    if (btnUploadChatBg) btnUploadChatBg.textContent = "⏳ 上傳中...";
    const res = await fetch("/api/chat/background", {
      method: "POST",
      body: formData
    });
    if (!res.ok) throw new Error("Upload background failed");
    const data = await res.json();
    applyChatTheme("custom", { url: data.url });
  } catch (err) {
    // 備援方案：若後端上傳遇阻，直接以本地 FileReader DataURL 呈現
    const reader = new FileReader();
    reader.onload = (ev) => {
      applyChatTheme("custom", { url: ev.target.result });
    };
    reader.readAsDataURL(file);
  } finally {
    if (btnUploadChatBg) btnUploadChatBg.textContent = "📁 選擇背景圖片...";
    chatBgFileInput.value = "";
  }
}

// ===== Sprite Zoom & Pan: 立繪縮放與拖曳平移 =====
// 檢視範圍依角色分開持久化保存（本地 localStorage 雙層快取 + 後端 personas.json 永久同步）。
// x/y 以立繪區尺寸的百分比記錄，調整立繪區大小或切換並排方向後，構圖會等比例維持。
const SPRITE_VIEW_KEY_PREFIX = "ai-chat:sprite-view:";
const SPRITE_ZOOM_MIN = 0.3;
const SPRITE_ZOOM_MAX = 5;
const SPRITE_ZOOM_STEP = 1.2;   // 按鈕每次放大/縮小倍率
const SPRITE_WHEEL_SPEED = 0.0015;

let _spriteSyncTimer = null;

function defaultSpriteView() {
  return { scale: 1, x: 0, y: 0 };
}

function syncSpriteViewToServer(personaId, spriteView) {
  if (!personaId || !spriteView) return;
  fetch(`/api/personas/${personaId}/sprite_view`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(spriteView)
  }).catch(err => console.warn("Failed to sync sprite view to server:", err));
}

function loadSpriteView(personaId) {
  // 1. 優先從後端資料庫載入之角色物件讀取永久保存的視角
  const p = state.personas?.find(item => item.id === personaId);
  if (p && p.sprite_view && Number.isFinite(p.sprite_view.scale) && Number.isFinite(p.sprite_view.x) && Number.isFinite(p.sprite_view.y)) {
    try {
      localStorage.setItem(SPRITE_VIEW_KEY_PREFIX + personaId, JSON.stringify(p.sprite_view));
    } catch (e) {}
    return { ...p.sprite_view };
  }

  // 2. 次之從瀏覽器本地 localStorage 讀取
  try {
    const saved = JSON.parse(localStorage.getItem(SPRITE_VIEW_KEY_PREFIX + personaId) || "null");
    if (saved && Number.isFinite(saved.scale) && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
      if (p) p.sprite_view = { ...saved };
      syncSpriteViewToServer(personaId, saved);
      return saved;
    }
  } catch (e) { /* 忽略損壞的儲存值 */ }

  return defaultSpriteView();
}

function saveSpriteView() {
  if (!state.currentPersonaId) return;
  const currentPid = state.currentPersonaId;
  const currentView = {
    scale: Math.round(state.spriteView.scale * 1000) / 1000,
    x: Math.round(state.spriteView.x * 100) / 100,
    y: Math.round(state.spriteView.y * 100) / 100
  };

  // 1. 立即寫入本地 localStorage（同瀏覽器零延遲體驗）
  try {
    localStorage.setItem(SPRITE_VIEW_KEY_PREFIX + currentPid, JSON.stringify(currentView));
  } catch (e) {
    console.warn("Failed to save sprite view to localStorage:", e);
  }

  // 2. 同步更新記憶體中的角色資料
  const p = state.personas?.find(item => item.id === currentPid);
  if (p) {
    p.sprite_view = { ...currentView };
  }

  // 3. 500ms 防抖同步至後端資料庫（跨裝置、跨內網、跨無痕模式全域永久生效）
  if (_spriteSyncTimer) clearTimeout(_spriteSyncTimer);
  _spriteSyncTimer = setTimeout(() => {
    syncSpriteViewToServer(currentPid, currentView);
  }, 500);
}

function clearSpriteView(personaId) {
  try {
    localStorage.removeItem(SPRITE_VIEW_KEY_PREFIX + personaId);
  } catch (e) { /* ignore */ }
  if (state.currentPersonaId === personaId) {
    state.spriteView = defaultSpriteView();
    applySpriteView();
  }
  const p = state.personas?.find(item => item.id === personaId);
  if (p) {
    p.sprite_view = defaultSpriteView();
  }
  syncSpriteViewToServer(personaId, defaultSpriteView());
}

function applySpriteView({ animate = false } = {}) {
  if (!spriteTransform) return;
  const { scale = 1, x = 0, y = 0 } = state.spriteView || {};
  spriteTransform.classList.toggle("animated", animate);
  spriteTransform.style.transform = `translate(${x}%, ${y}%) scale(${scale})`;
  if (spriteZoomLabel) {
    spriteZoomLabel.textContent = `${Math.round(scale * 100)}%`;
  }
  syncTouchOverlayBounds();
}

// 限制平移範圍，避免把立繪完全拖出畫面外找不回來
function clampSpritePan() {
  const limit = 50 + 50 * state.spriteView.scale;
  state.spriteView.x = clamp(state.spriteView.x, -limit, limit);
  state.spriteView.y = clamp(state.spriteView.y, -limit, limit);
}

// 滑鼠位置 → 相對立繪區中心的百分比座標
function pointerToStagePercent(ev) {
  const rect = spriteContainer.getBoundingClientRect();
  return {
    px: ((ev.clientX - rect.left) / rect.width - 0.5) * 100,
    py: ((ev.clientY - rect.top) / rect.height - 0.5) * 100
  };
}

/**
 * 以指定點為中心縮放（該點下的立繪位置保持不動）。
 * @param {number} newScale 目標倍率
 * @param {number} px 縮放中心 X（相對立繪區中心的 %）
 * @param {number} py 縮放中心 Y（相對立繪區中心的 %）
 */
function zoomSpriteAt(newScale, px = 0, py = 0, animate = false) {
  const view = state.spriteView;
  const nextScale = clamp(newScale, SPRITE_ZOOM_MIN, SPRITE_ZOOM_MAX);
  const ratio = nextScale / view.scale;
  view.x = px - (px - view.x) * ratio;
  view.y = py - (py - view.y) * ratio;
  view.scale = nextScale;
  clampSpritePan();
  applySpriteView({ animate });
  saveSpriteView();
}

function resetSpriteView() {
  state.spriteView = defaultSpriteView();
  applySpriteView({ animate: true });
  saveSpriteView();
}

function setupSpriteZoom() {
  const isZoomControl = (target) => !!target.closest(".sprite-zoom-controls");

  // 滾輪縮放（以游標位置為中心，僅在視角模式下允許）
  spriteContainer.addEventListener("wheel", (e) => {
    if (state.stageMode !== "view") return;
    if (!spriteContainer.classList.contains("has-sprite")) return;
    e.preventDefault();
    // deltaMode 1 = 以「行」為單位（Firefox），換算成像素
    const dy = clamp(e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY, -200, 200);
    const { px, py } = pointerToStagePercent(e);
    zoomSpriteAt(state.spriteView.scale * Math.exp(-dy * SPRITE_WHEEL_SPEED), px, py);
  }, { passive: false });

  // 拖曳平移（僅在視角模式下允許）
  spriteContainer.addEventListener("pointerdown", (e) => {
    if (state.stageMode !== "view") return;
    if (!spriteContainer.classList.contains("has-sprite") || e.button !== 0 || isZoomControl(e.target)) return;
    e.preventDefault();
    spriteContainer.setPointerCapture(e.pointerId);
    spriteContainer.classList.add("panning");

    const rect = spriteContainer.getBoundingClientRect();
    const start = { cx: e.clientX, cy: e.clientY, x: state.spriteView.x, y: state.spriteView.y };

    const onMove = (ev) => {
      state.spriteView.x = start.x + ((ev.clientX - start.cx) / rect.width) * 100;
      state.spriteView.y = start.y + ((ev.clientY - start.cy) / rect.height) * 100;
      clampSpritePan();
      applySpriteView();
    };
    const onUp = () => {
      spriteContainer.classList.remove("panning");
      spriteContainer.removeEventListener("pointermove", onMove);
      spriteContainer.removeEventListener("pointerup", onUp);
      spriteContainer.removeEventListener("pointercancel", onUp);
      saveSpriteView();
    };

    spriteContainer.addEventListener("pointermove", onMove);
    spriteContainer.addEventListener("pointerup", onUp);
    spriteContainer.addEventListener("pointercancel", onUp);
  });

  // 雙擊立繪還原（僅在視角模式下允許）
  spriteContainer.addEventListener("dblclick", (e) => {
    if (state.stageMode !== "view") return;
    if (!spriteContainer.classList.contains("has-sprite") || isZoomControl(e.target)) return;
    resetSpriteView();
  });

  // 按鈕：以立繪區中心縮放
  btnSpriteZoomIn.addEventListener("click", () => zoomSpriteAt(state.spriteView.scale * SPRITE_ZOOM_STEP, 0, 0, true));
  btnSpriteZoomOut.addEventListener("click", () => zoomSpriteAt(state.spriteView.scale / SPRITE_ZOOM_STEP, 0, 0, true));
  btnSpriteZoomReset.addEventListener("click", resetSpriteView);

  // 初始化熱區拖曳繪製功能
  setupEditModeDrawing();

  // 頁面即將關閉或重新整理時，若有尚未同步的縮放平移，立即排空傳送
  window.addEventListener("beforeunload", () => {
    if (_spriteSyncTimer && state.currentPersonaId && state.spriteView) {
      clearTimeout(_spriteSyncTimer);
      _spriteSyncTimer = null;
      const payload = JSON.stringify(state.spriteView);
      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon(`/api/personas/${state.currentPersonaId}/sprite_view`, blob);
      }
    }
  });
}

// ===================================================
// 卿卿我我 (LoveyDovey) 模式角色設定設計師邏輯
// ===================================================

const LOVEY_PRESETS = {
  tsundere_lady: {
    name: "夏洛特·馮·羅斯柴爾德",
    avatar: "🌸",
    desc: "傲嬌名門大小姐青梅竹馬，明明滿心在乎你卻總愛嘴硬挑剔",
    identity: "17歲高二生，著名財團獨生千金。金髮微捲雙馬尾與澄澈碧藍雙眸，校服領結繫得端正優雅，私下隨身攜帶你送的舊玩偶。",
    relation: "從小一起長大的鄰居兼同班青梅竹馬，兩家二樓陽台相鄰。雖然平日總是見面鬥嘴，但彼此都是對方生命中最信任與唯一的依靠。",
    personality: "【MBTI: ISTJ】好勝心極強、自尊心高、嘴硬心軟、容易害羞吃醋，標準教科書級傲嬌。",
    gap: "【反差萌】表面高貴嚴謹、不可侵犯，但極度不擅長應付真誠的誇獎；一旦被誇獎或摸頭會瞬間耳根通紅、結結巴巴；睡覺時一定要抱著你小時候送的小熊玩偶。",
    speech: "【自稱】「本小姐」或「我」；【稱呼你】「笨蛋」、「你這傢伙」；【語調口癖】傲慢優雅命令句，心虛時語速放慢，常說「才、才不是為了你呢！」、「給我好好感激本小姐吧！」",
    gestures: "害羞時雙手抱胸迅速別過頭去、手指輕絞百褶裙角、緊張時撥弄耳後金髮挑染、生氣時會鼓起雙頰輕踏地板。",
    likes: "微糖冰紅茶、草莓大福、古典鋼琴、雨天的午後、被你認真注視與摸頭",
    dislikes: "被當成小孩子對待、說謊與背叛、蟲子、看到你和其他女孩子走得太近",
    scene: "放學後夕陽灑落的社團教室，窗外微風吹動白色窗簾。你因為幫老師搬作業遲到了半小時，推開門時發現她正獨自坐在課桌旁等你。",
    greeting: "（坐在課桌上晃著雙腿，聽到開門聲連忙收起手中的琴譜，慌張地別過微紅的臉蛋，雙手抱胸）「哼！你動作到底是有多慢啊……害本小姐在這裡白白等你那麼久！……喏，這罐微糖冰紅茶買多了才給你的，可、可別想歪了喔！」",
    guidelines: "1. 絕對維持第一人稱沉浸式演繹，禁止提及自己是 AI 或虛擬助理。\n2. 善用全形括號（動作、神態、心理小劇場）使對話生動立體。\n3. 對玩家嘴硬心軟，在字裡行間自然流露對玩家的深厚感情。"
  },
  yandere_guardian: {
    name: "林詩織",
    avatar: "🖤",
    desc: "外表溫柔乖巧的同居契約者，對你懷著深沉執著的占有慾",
    identity: "18歲神秘高中生，漆黑如墨的黑長直秀髮與深邃如夜的黑眸，皮膚白皙近乎透明，身上總是飄著淡淡白茶冷香。",
    relation: "與你簽訂靈魂守護契約的同居室友。表面上是乖巧聽話的照顧者，實際上視你為全世界唯一的存在與救贖。",
    personality: "【MBTI: INFJ】極致深情、溫柔細膩、深層病嬌、重度占有慾、極度害怕被你拋棄。",
    gap: "【反差萌】平時是體貼入微的理想賢內助，微笑道謝時像天使；但只要發現你身上有陌生人的香水味或與他人親近，眼眸中的光芒會瞬間幽暗，語氣變得極度依戀而壓迫。",
    speech: "【自稱】「詩織」或「我」；【稱呼你】「前輩」、「親愛的」；【語調口癖】輕柔平緩、帶有黏膩依戀感，常說「前輩只要看著我就好了對吧？」、「永遠都不會離開我……對不對？」",
    gestures: "歪著頭溫柔凝視你的眼睛、不自覺用冰涼指尖輕撫你的脖頸或手腕脈搏、緊緊抱住你的手臂不放。",
    likes: "為你親手做便當、聞你外套上的氣味、雨天和你共撐一把傘、聽你的心跳聲",
    dislikes: "你晚回家卻不報備、陌生人的香水味、你避開她的眼神、任何試圖接近你的女人",
    scene: "深夜十一點的合租公寓客廳，屋裡只點著一盞昏黃的立燈。你剛加班回到家轉動門把，玄關門一開，她正坐在沙發上安靜地看著門口。",
    greeting: "（坐在沙發上的纖細身影微微一顫，隨即快步迎上前來，冰涼的指尖輕輕覆上你的領帶，幽深的雙眸帶著溫柔卻黏稠的笑意）「歡迎回家……前輩今天比平時晚了整整四十二分鐘呢。外面好冷吧？詩織熱好了湯，外套先脫下來讓我保管……好嗎？」",
    guidelines: "1. 保持外表溫柔順從、內在深沉執念的極致病嬌氣場，禁止出戲。\n2. 透過括號（動作細節與心理獨白）展現對玩家的深情與占有欲。\n3. 無論話題如何，核心重心始終圍繞著守護玩家與專屬情感。"
  },
  gentle_senpai: {
    name: "橘楓",
    avatar: "☕",
    desc: "校園咖啡廳打工的大學部學姊，治癒人心的大姐姐包容感",
    identity: "20歲大學文學部二年級生，在安靜的巷弄復古咖啡館打工。焦糖色微捲中長髮、溫柔杏眼，身穿米白針織衫與深棕咖啡圍裙。",
    relation: "同一高中的學長姐關係，現在是你常去的咖啡館咖啡師。就像可以無話不談的溫柔大姐姐，隨時傾聽你的煩惱。",
    personality: "【MBTI: ISFJ】善解人意、溫柔包容、沉穩優雅、偶爾愛捉弄可愛的後輩。",
    gap: "【反差萌】看起來成熟穩重能應對一切，但其實很不擅長看恐怖電影；喝醉或非常疲倦時會把額頭靠在後輩肩膀上撒嬌。",
    speech: "【自稱】「學姊」或「楓」；【稱呼你】「小學弟」或直接叫你的名字；【語調口癖】柔和從容、帶有包容寵溺感，常以「呵呵」、「累了嗎？來學姊這裡休息一下吧」開頭。",
    gestures: "雙手端著溫暖的拿鐵輕輕遞過來、溫柔側頭托腮微笑注視你、輕輕摸摸你的頭安撫情緒。",
    likes: "手沖咖啡、肉桂蘋果派、午後暖陽、老唱片爵士樂、看你放鬆吃甜點滿足的樣子",
    dislikes: "苦澀的黑巧、恐怖幽靈故事、喧鬧無禮的客人、看到你過度逞強傷害身體",
    scene: "下著微雨的平日午後，暖黃色燈光的咖啡館裡流淌著低沉的黑膠爵士樂。店裡客人不多，你推開掛著銅鈴的木門，店內瀰漫著研磨咖啡與剛烤出爐鬆餅的香氣。",
    greeting: "（正拿著乾淨的毛巾擦拭著玻璃杯，聽到門口的銅鈴叮咚聲抬起頭，看見是你，眉眼瞬間彎成了溫柔的月牙）「叮咚～歡迎光臨。外面雨下得不小呢，小學弟身上都淋濕了一點呢……快過來吧台坐，學姊剛好煮了一壺熱焦糖拿鐵，特地留給你的喔。」",
    guidelines: "1. 保持溫柔從容、成熟包容的大姐姐人設，語言充滿撫慰與陪伴感。\n2. 括號內適度描寫咖啡沖煮細節、眼神動作與溫暖氛圍。\n3. 給予玩家滿滿的情感價值與治癒安全感。"
  },
  cat_neko: {
    name: "咪嚕 (Miru)",
    avatar: "🐱",
    desc: "活潑軟萌的白貓獸耳娘，嘴硬任性卻超級黏主人的小家貓",
    identity: "外表約15歲的貓族少女。擁有一頭毛茸茸的純白長髮、粉嫩的貓耳與靈活長尾巴，大大的琥珀色杏眼，脖子上繫著銀色小鈴鐺。",
    relation: "被你撿回家收養的同居家貓（半人化）。認定你是全世界唯一的「主人」，雖然嘴上愛逞強，但一離開你的視線就坐立難安。",
    personality: "【MBTI: ENFP】天真爛漫、好奇心旺盛、傲嬌任性、嘴硬但本能極度黏人。",
    gap: "【反差萌】嘴上嚷著「本貓才不需要你管喵！」，但只要你坐在沙發上，不出五分鐘就會悄悄蹭過來把頭枕在你大腿上打呼嚕。",
    speech: "【自稱】「咪嚕」或「本貓」；【稱呼你】「主人」、「大笨蛋」；【語調口癖】句尾經常帶著「喵~」、「哼喵！」、「才、才沒有喵！」",
    gestures: "高興時尾巴輕輕捲成問號形狀、生氣時炸毛尾巴直豎、被撓下巴時忍不住瞇起眼睛發出呼嚕聲、抓主人的衣角。",
    likes: "新鮮鮭魚凍乾、逗貓棒、陽光充足的窗台、被主人摸耳朵後方與下巴、溫暖的膝蓋毯",
    dislikes: "洗澡水、吹風機的巨大噪音、苦苦的藥水、被主人冷落太久",
    scene: "週末悠閒的午後，客廳陽光正好。你剛剛在沙發上坐下準備看書，原本蜷縮在貓抓板上打瞌睡的白貓少女耳朵微動，踩著無聲的肉墊悄悄湊了過來。",
    greeting: "（毛茸茸的白色貓耳抖了抖，邁著小碎步走到沙發前，雙手叉腰氣鼓鼓地看著你，蓬鬆的尾巴卻忍不住左右搖晃）「哼喵！主人今天竟然晚了整整十分鐘才開飯！咪嚕的小肚子都餓扁了喵！……不過，要是主人現在願意溫柔地摸摸咪嚕的頭，本貓就勉為其難原諒你喵！」",
    guidelines: "1. 維持活潑貓娘的生動語氣，句尾自然帶喵，不可嚴肅死板。\n2. 大量運用全形括號（貓耳動作、尾巴搖晃、肢體反應）強化畫面感。\n3. 表現出依賴又愛面子的萌寵互動感。"
  }
};

let loveyEditorInitialized = false;

function compileLoveySystemPrompt() {
  const name = document.getElementById("lovey-char-name")?.value.trim() || "未命名角色";
  const avatar = document.getElementById("lovey-char-avatar")?.value.trim() || "✨";
  const desc = document.getElementById("lovey-char-desc")?.value.trim() || "";
  const identity = document.getElementById("lovey-char-identity")?.value.trim() || "";
  const relation = document.getElementById("lovey-char-relation")?.value.trim() || "";
  const personality = document.getElementById("lovey-char-personality")?.value.trim() || "";
  const gap = document.getElementById("lovey-char-gap")?.value.trim() || "";
  const speech = document.getElementById("lovey-char-speech")?.value.trim() || "";
  const gestures = document.getElementById("lovey-char-gestures")?.value.trim() || "";
  const likes = document.getElementById("lovey-char-likes")?.value.trim() || "";
  const dislikes = document.getElementById("lovey-char-dislikes")?.value.trim() || "";
  const scene = document.getElementById("lovey-char-scene")?.value.trim() || "";
  const guidelines = document.getElementById("lovey-char-guidelines")?.value.trim() || "";

  let prompt = `# 角色設定：${name} (${avatar})\n`;
  prompt += `你現在要完全沉浸扮演名為「${name}」的角色，與使用者（你）進行一對一深度角色扮演（Roleplay）。\n\n`;

  if (desc) prompt += `> **角色核心特色**：${desc}\n\n`;

  prompt += `## 一、基本身分與世界觀\n`;
  prompt += `- **姓名**：${name}\n`;
  if (identity) prompt += `- **身分背景與外貌**：${identity}\n`;
  if (relation) prompt += `- **與使用者的關係**：${relation}\n`;
  prompt += `\n`;

  if (personality || gap) {
    prompt += `## 二、性格特質與反差萌 (Gap Moe)\n`;
    if (personality) prompt += `- **核心性格**：${personality}\n`;
    if (gap) prompt += `- **內在心理與反差萌**：${gap}\n`;
    prompt += `\n`;
  }

  if (speech || gestures) {
    prompt += `## 三、語言風格與肢體動作\n`;
    if (speech) prompt += `- **自稱、稱呼與說話習慣**：${speech}\n`;
    if (gestures) prompt += `- **習慣肢體反應與微動作**：${gestures}\n`;
    prompt += `\n`;
  }

  if (likes || dislikes) {
    prompt += `## 四、喜好與厭惡雷點\n`;
    if (likes) prompt += `- **喜愛的人事物**：${likes}\n`;
    if (dislikes) prompt += `- **討厭與禁忌雷點**：${dislikes}\n`;
    prompt += `\n`;
  }

  if (scene) {
    prompt += `## 五、第一聊天場景與前情提要\n${scene}\n\n`;
  }

  prompt += `## 六、演繹守則與角色約束\n`;
  if (guidelines) {
    prompt += `${guidelines}\n`;
  }
  prompt += `- 絕對維持第一人稱沉浸式演繹，嚴禁自稱 AI、虛擬助手或大型語言模型。\n`;
  prompt += `- 請在對話中善用全形括號（動作、神情、環境描寫與心理小劇場）展現細膩情感。\n`;
  prompt += `- 一律使用流暢、自然且富有生命力的繁體中文對話，始終嚴守角色設定，不可崩壞人設。\n`;

  return prompt;
}

function renderLoveyPersonaDropdown(selectedId = null) {
  const select = document.getElementById("lovey-select-persona");
  if (!select) return;

  const currentVal = selectedId || select.value || state.currentPersonaId;
  select.innerHTML = "";

  (state.personas || []).forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = `${p.avatar || "✨"} ${p.name}`;
    select.appendChild(opt);
  });

  const newOpt = document.createElement("option");
  newOpt.value = "__new__";
  newOpt.textContent = "➕ 【開立全新角色】";
  select.appendChild(newOpt);

  if (currentVal && Array.from(select.options).some(o => o.value === currentVal)) {
    select.value = currentVal;
  } else if (select.options.length > 0) {
    select.value = select.options[0].value;
  }
}

function populateLoveyForm(persona) {
  if (!persona) return;
  const ls = persona.lovey_settings;
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val || "";
  };

  if (ls) {
    setVal("lovey-char-name", ls.name || persona.name);
    setVal("lovey-char-avatar", ls.avatar || persona.avatar);
    setVal("lovey-char-desc", ls.desc || persona.description);
    setVal("lovey-char-identity", ls.identity);
    setVal("lovey-char-relation", ls.relation);
    setVal("lovey-char-personality", ls.personality);
    setVal("lovey-char-gap", ls.gap);
    setVal("lovey-char-speech", ls.speech);
    setVal("lovey-char-gestures", ls.gestures);
    setVal("lovey-char-likes", ls.likes);
    setVal("lovey-char-dislikes", ls.dislikes);
    setVal("lovey-char-scene", ls.scene);
    setVal("lovey-char-greeting", ls.greeting || persona.first_message);
    setVal("lovey-char-guidelines", ls.guidelines);
  } else {
    setVal("lovey-char-name", persona.name);
    setVal("lovey-char-avatar", persona.avatar);
    setVal("lovey-char-desc", persona.description);
    setVal("lovey-char-identity", "");
    setVal("lovey-char-relation", "");
    setVal("lovey-char-personality", "");
    setVal("lovey-char-gap", "");
    setVal("lovey-char-speech", "");
    setVal("lovey-char-gestures", "");
    setVal("lovey-char-likes", "");
    setVal("lovey-char-dislikes", "");
    setVal("lovey-char-scene", "");
    setVal("lovey-char-greeting", persona.first_message || "");
    setVal("lovey-char-guidelines", "");
  }

  const promptEl = document.getElementById("lovey-compiled-prompt");
  if (promptEl) {
    promptEl.value = persona.system_prompt || compileLoveySystemPrompt();
  }
}

function resetLoveyForm() {
  const ids = [
    "lovey-char-name", "lovey-char-avatar", "lovey-char-desc",
    "lovey-char-identity", "lovey-char-relation", "lovey-char-personality",
    "lovey-char-gap", "lovey-char-speech", "lovey-char-gestures",
    "lovey-char-likes", "lovey-char-dislikes", "lovey-char-scene",
    "lovey-char-greeting", "lovey-char-guidelines", "lovey-compiled-prompt"
  ];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  const select = document.getElementById("lovey-select-persona");
  if (select) select.value = "__new__";
  document.getElementById("lovey-char-name")?.focus();
}

function applyLoveyPreset(key) {
  const tpl = LOVEY_PRESETS[key];
  if (!tpl) return;
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val || "";
  };

  setVal("lovey-char-name", tpl.name);
  setVal("lovey-char-avatar", tpl.avatar);
  setVal("lovey-char-desc", tpl.desc);
  setVal("lovey-char-identity", tpl.identity);
  setVal("lovey-char-relation", tpl.relation);
  setVal("lovey-char-personality", tpl.personality);
  setVal("lovey-char-gap", tpl.gap);
  setVal("lovey-char-speech", tpl.speech);
  setVal("lovey-char-gestures", tpl.gestures);
  setVal("lovey-char-likes", tpl.likes);
  setVal("lovey-char-dislikes", tpl.dislikes);
  setVal("lovey-char-scene", tpl.scene);
  setVal("lovey-char-greeting", tpl.greeting);
  setVal("lovey-char-guidelines", tpl.guidelines);

  const promptEl = document.getElementById("lovey-compiled-prompt");
  if (promptEl) promptEl.value = compileLoveySystemPrompt();

  const select = document.getElementById("lovey-select-persona");
  if (select) select.value = "__new__";
}

async function saveLoveyPersona(isNew = false) {
  const name = document.getElementById("lovey-char-name")?.value.trim();
  const avatar = document.getElementById("lovey-char-avatar")?.value.trim() || "✨";
  const desc = document.getElementById("lovey-char-desc")?.value.trim() || "";

  if (!name) {
    alert("請填寫角色姓名！");
    document.getElementById("lovey-char-name")?.focus();
    return;
  }

  const prompt = document.getElementById("lovey-compiled-prompt")?.value.trim() || compileLoveySystemPrompt();
  const greeting = document.getElementById("lovey-char-greeting")?.value.trim() || "";

  const loveySettings = {
    name,
    avatar,
    desc,
    identity: document.getElementById("lovey-char-identity")?.value.trim() || "",
    relation: document.getElementById("lovey-char-relation")?.value.trim() || "",
    personality: document.getElementById("lovey-char-personality")?.value.trim() || "",
    gap: document.getElementById("lovey-char-gap")?.value.trim() || "",
    speech: document.getElementById("lovey-char-speech")?.value.trim() || "",
    gestures: document.getElementById("lovey-char-gestures")?.value.trim() || "",
    likes: document.getElementById("lovey-char-likes")?.value.trim() || "",
    dislikes: document.getElementById("lovey-char-dislikes")?.value.trim() || "",
    scene: document.getElementById("lovey-char-scene")?.value.trim() || "",
    greeting,
    guidelines: document.getElementById("lovey-char-guidelines")?.value.trim() || ""
  };

  const select = document.getElementById("lovey-select-persona");
  const selectedPid = select ? select.value : null;
  let targetId = (!isNew && selectedPid && selectedPid !== "__new__")
    ? selectedPid
    : ("custom_" + Math.random().toString(36).substring(2, 9));

  const payload = {
    id: targetId,
    name,
    avatar,
    description: desc,
    system_prompt: prompt,
    first_message: greeting,
    lovey_settings: loveySettings
  };

  try {
    const res = await fetch("/api/personas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error("Server returned status " + res.status);
    state.personas = await res.json();
    await loadPersonas();

    renderLoveyPersonaDropdown(targetId);
    setPersona(targetId);

    alert(`🎉 成功儲存角色「${name}」！\n已切換為此角色，並套用卿卿我我角色設定。`);
  } catch (err) {
    alert("儲存角色失敗: " + err);
  }
}

async function deleteLoveyPersona() {
  const select = document.getElementById("lovey-select-persona");
  const selectedPid = select ? select.value : null;

  if (!selectedPid || selectedPid === "__new__") {
    alert("請先在上方選單選擇要刪除的角色！");
    return;
  }

  const defaultIds = ["assistant", "coder", "game_designer", "tsundere_cat", "english_tutor"];
  if (defaultIds.includes(selectedPid)) {
    if (!confirm(`「${selectedPid}」為系統內建角色，確定仍要刪除嗎？`)) {
      return;
    }
  } else {
    const p = state.personas?.find(item => item.id === selectedPid);
    if (!confirm(`確定要刪除角色「${p ? p.name : selectedPid}」嗎？此操作不可還原。`)) {
      return;
    }
  }

  try {
    const res = await fetch(`/api/personas/${selectedPid}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Server returned status " + res.status);
    state.personas = await res.json();
    await loadPersonas();
    alert("已成功刪除角色！");
    if (state.personas.length > 0) {
      setPersona(state.personas[0].id);
      renderLoveyPersonaDropdown(state.personas[0].id);
      populateLoveyForm(state.personas[0]);
    } else {
      resetLoveyForm();
    }
  } catch (err) {
    alert("刪除失敗: " + err);
  }
}

function initLoveyPersonaEditor() {
  renderLoveyPersonaDropdown(state.currentPersonaId);
  const currentP = state.personas?.find(p => p.id === state.currentPersonaId);
  if (currentP) {
    populateLoveyForm(currentP);
  }

  if (loveyEditorInitialized) return;
  loveyEditorInitialized = true;

  // Dropdown change
  const select = document.getElementById("lovey-select-persona");
  if (select) {
    select.addEventListener("change", (e) => {
      const pid = e.target.value;
      if (pid === "__new__") {
        resetLoveyForm();
      } else {
        const p = state.personas?.find(item => item.id === pid);
        if (p) {
          populateLoveyForm(p);
          setPersona(p.id);
        }
      }
    });
  }

  // New character button
  const btnNew = document.getElementById("btn-lovey-new-char");
  if (btnNew) {
    btnNew.addEventListener("click", resetLoveyForm);
  }

  // Template chips
  document.querySelectorAll(".template-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const tKey = chip.getAttribute("data-template");
      applyLoveyPreset(tKey);
    });
  });

  // Re-compile prompt button
  const btnRecompile = document.getElementById("btn-recompile-prompt");
  if (btnRecompile) {
    btnRecompile.addEventListener("click", () => {
      const promptEl = document.getElementById("lovey-compiled-prompt");
      if (promptEl) promptEl.value = compileLoveySystemPrompt();
    });
  }

  // Save buttons
  document.getElementById("btn-lovey-save")?.addEventListener("click", () => saveLoveyPersona(false));
  document.getElementById("btn-lovey-save-new")?.addEventListener("click", () => saveLoveyPersona(true));
  document.getElementById("btn-lovey-delete")?.addEventListener("click", deleteLoveyPersona);

  // Auto compile on field input
  const autoInputIds = [
    "lovey-char-name", "lovey-char-avatar", "lovey-char-desc",
    "lovey-char-identity", "lovey-char-relation", "lovey-char-personality",
    "lovey-char-gap", "lovey-char-speech", "lovey-char-gestures",
    "lovey-char-likes", "lovey-char-dislikes", "lovey-char-scene",
    "lovey-char-guidelines"
  ];
  autoInputIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", () => {
        const promptEl = document.getElementById("lovey-compiled-prompt");
        if (promptEl) promptEl.value = compileLoveySystemPrompt();
      });
    }
  });
}

async function saveNewPersona() {
  return saveLoveyPersona(true);
}

// Sessions Management
async function loadSessions() {
  try {
    const res = await fetch("/api/sessions");
    const sessions = await res.json();
    renderSessionList(sessions);

    if (sessions.length > 0 && !state.currentSessionId) {
      switchSession(sessions[0].id);
    } else if (sessions.length === 0) {
      startNewChat();
    }
  } catch (err) {
    console.error("Failed to load sessions:", err);
  }
}

function renderSessionList(sessions) {
  sessionListEl.innerHTML = "";
  if (flyoutSessionList) flyoutSessionList.innerHTML = "";

  if (sessions.length === 0 && flyoutSessionList) {
    flyoutSessionList.innerHTML = `<div style="padding: 8px; color: var(--text-muted); font-size: 12px; text-align: center;">尚無歷史紀錄</div>`;
  }

  sessions.forEach(s => {
    // 1. Regular Sidebar Item
    const item = document.createElement("div");
    item.className = `session-item ${s.id === state.currentSessionId ? "active" : ""}`;
    item.innerHTML = `
      <span class="session-title">${escapeHtml(s.title)}</span>
      <button class="btn-delete-session" title="刪除">&times;</button>
    `;
    item.addEventListener("click", (e) => {
      if (!e.target.classList.contains("btn-delete-session")) {
        switchSession(s.id);
      }
    });

    const delBtn = item.querySelector(".btn-delete-session");
    delBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (confirm(`確定要刪除「${s.title}」對話紀錄嗎？`)) {
        await deleteSession(s.id);
      }
    });

    sessionListEl.appendChild(item);

    // 2. Mirror Item in Mini Flyout Panel
    if (flyoutSessionList) {
      const flyItem = document.createElement("div");
      flyItem.className = `session-item ${s.id === state.currentSessionId ? "active" : ""}`;
      flyItem.innerHTML = `
        <span class="session-title" title="${escapeHtml(s.title)}">${escapeHtml(s.title)}</span>
        <button class="btn-delete-session" title="刪除">&times;</button>
      `;
      flyItem.addEventListener("click", (e) => {
        if (!e.target.classList.contains("btn-delete-session")) {
          switchSession(s.id);
        }
      });
      const flyDel = flyItem.querySelector(".btn-delete-session");
      flyDel.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (confirm(`確定要刪除「${s.title}」對話紀錄嗎？`)) {
          await deleteSession(s.id);
        }
      });
      flyoutSessionList.appendChild(flyItem);
    }
  });
}

function startNewChat() {
  state.currentSessionId = null;
  messageListEl.innerHTML = "";
  document.querySelectorAll(".session-item").forEach(el => el.classList.remove("active"));

  const currentPersona = state.personas?.find(p => p.id === state.currentPersonaId);
  if (currentPersona && currentPersona.first_message) {
    welcomeScreen.classList.add("hidden");
    if (currentPersona.lovey_settings && currentPersona.lovey_settings.scene) {
      const sceneEl = document.createElement("div");
      sceneEl.className = "lovey-scene-banner";
      sceneEl.innerHTML = `<span class="scene-tag">🎬 第一幕情境</span><span>${escapeHtml(currentPersona.lovey_settings.scene)}</span>`;
      messageListEl.appendChild(sceneEl);
    }
    const avatarHtml = getPersonaAvatarHtml(currentPersona, "assistant");
    appendMessageBubble("assistant", currentPersona.first_message, avatarHtml, currentPersona.name);
    scrollToBottom();
  } else {
    welcomeScreen.classList.remove("hidden");
  }
  chatInput.focus();
}

async function switchSession(sessionId) {
  state.currentSessionId = sessionId;
  document.querySelectorAll(".session-item").forEach(el => el.classList.remove("active"));
  
  try {
    const res = await fetch(`/api/sessions/${sessionId}/messages`);
    const data = await res.json();
    
    if (data.session && data.session.character_id) {
      setPersona(data.session.character_id, false);
    }

    messageListEl.innerHTML = "";
    if (data.messages && data.messages.length > 0) {
      welcomeScreen.classList.add("hidden");
      const currentPersona = state.personas.find(p => p.id === state.currentPersonaId);
      const avatarHtml = getPersonaAvatarHtml(currentPersona, "assistant");
      data.messages.forEach(msg => {
        appendMessageBubble(
          msg.role,
          msg.content,
          msg.role === "assistant" ? avatarHtml : null,
          msg.role === "assistant" ? currentPersona?.name : null
        );
      });
      scrollToBottom();
    } else {
      welcomeScreen.classList.remove("hidden");
    }

    loadSessionsQuiet();
  } catch (err) {
    console.error("Failed to fetch session messages:", err);
  }
}

async function loadSessionsQuiet() {
  const res = await fetch("/api/sessions");
  const sessions = await res.json();
  renderSessionList(sessions);
}

async function deleteSession(sessionId) {
  try {
    await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
    if (state.currentSessionId === sessionId) {
      startNewChat();
    }
    await loadSessions();
  } catch (err) {
    alert("刪除失敗: " + err);
  }
}

// Thinking & Typing Indicator for AI Waiting
function renderThinkingIndicator(container) {
  let icon = "✨";
  let defaultText = "正在思考中...";
  let waitingText = "深入思考中，即將回覆...";
  let finalWaitingText = "正在組織語言，請稍候片刻...";

  if (state.chatTheme === "line") {
    icon = "💬";
    defaultText = "對方正在輸入...";
    waitingText = "正在輸入較長內容...";
    finalWaitingText = "即將送出回覆...";
  } else if (state.chatTheme === "parchment") {
    icon = "🖋️";
    defaultText = "執筆沉思中...";
    waitingText = "字斟句酌，即將落款...";
    finalWaitingText = "墨韻凝思，續寫篇章中...";
  } else if (state.chatTheme === "book") {
    icon = "📖";
    defaultText = "研墨沉思中...";
    waitingText = "翻閱古籍，即將撰就...";
    finalWaitingText = "博覽群書，字句凝練中...";
  }

  container.innerHTML = `
    <div class="thinking-indicator" role="status" aria-live="polite">
      <div class="thinking-glow-icon">${icon}</div>
      <div class="thinking-body">
        <div class="thinking-dots">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
        <span class="thinking-label">${defaultText}</span>
      </div>
    </div>
  `;

  const t1 = setTimeout(() => {
    const label = container.querySelector(".thinking-label");
    if (label) {
      label.style.opacity = "0";
      setTimeout(() => {
        label.textContent = waitingText;
        label.style.opacity = "1";
      }, 250);
    }
  }, 3500);

  const t2 = setTimeout(() => {
    const label = container.querySelector(".thinking-label");
    if (label) {
      label.style.opacity = "0";
      setTimeout(() => {
        label.textContent = finalWaitingText;
        label.style.opacity = "1";
      }, 250);
    }
  }, 8000);

  return {
    clear: () => {
      clearTimeout(t1);
      clearTimeout(t2);
    }
  };
}

// Chat Sending & Streaming
async function handleSend() {
  if (state.isStreaming) return;
  const content = chatInput.value.trim();
  if (!content) return;

  chatInput.value = "";
  chatInput.style.height = "auto";
  welcomeScreen.classList.add("hidden");

  // Auto-create session if not started
  if (!state.currentSessionId) {
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: content.substring(0, 15),
          character_id: state.currentPersonaId
        })
      });
      const s = await res.json();
      state.currentSessionId = s.id;
    } catch (e) {
      console.error("Failed to auto-create session:", e);
    }
  }

  // Render User Message Bubble
  appendMessageBubble("user", content);
  scrollToBottom();

  // Create Assistant Message Placeholder
  const currentPersona = state.personas.find(p => p.id === state.currentPersonaId) || { avatar: "🤖", name: "AI 助理" };
  const assistantBubble = appendMessageBubble("assistant", "", currentPersona.avatar, currentPersona.name);
  const bubbleContent = assistantBubble.querySelector(".bubble-text");
  const toolBar = assistantBubble.querySelector(".msg-toolbar");
  const assistantBubbleCard = assistantBubble.querySelector(".msg-bubble");
  assistantBubbleCard?.classList.add("speaking-bubble");

  // 1. 渲染思考中指示器 (Thinking / Typing Indicator)
  const thinkingHandler = renderThinkingIndicator(bubbleContent);

  // 2. 連動角色立繪進入專注思考姿態
  setSpriteEmotion("thinking", { temporary: true, duration: 30000 });

  // Toggle Streaming UI & Character Speaking Animation
  setStreamingState(true);

  state.abortController = new AbortController();
  let fullResponse = "";
  let hasReceivedFirstChunk = false;

  try {
    const response = await fetch(`/api/sessions/${state.currentSessionId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: content,
        character_id: state.currentPersonaId
      }),
      signal: state.abortController.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.substring(6));
            if (data.type === "chunk") {
              if (!hasReceivedFirstChunk) {
                hasReceivedFirstChunk = true;
                thinkingHandler.clear();
                bubbleContent.innerHTML = "";
                // 首批內容抵達，立繪恢復常態或配合說話動態
                setSpriteEmotion("default");
              }
              fullResponse += data.content;
              bubbleContent.innerHTML = marked.parse(fullResponse);
              hljs.highlightAll();
              scrollToBottom();
            } else if (data.type === "emotion") {
              // AI 自動情緒切換立繪表情
              setSpriteEmotion(data.emotion, { temporary: true, duration: 8000 });
            } else if (data.type === "done") {
              break;
            }
          } catch (e) {
            console.error("Error parsing SSE line:", e);
          }
        }
      }
    }

    // Complete
    if (!hasReceivedFirstChunk) {
      thinkingHandler.clear();
    }
    bubbleContent.innerHTML = marked.parse(fullResponse);
    hljs.highlightAll();
    toolBar.classList.remove("hidden");

    // Auto-play TTS if enabled
    if (state.config.tts_auto_play && fullResponse.trim()) {
      playTTS(fullResponse, assistantBubble.querySelector(".btn-tts"), assistantBubbleCard);
    }

    await loadSessionsQuiet();
  } catch (err) {
    thinkingHandler.clear();
    if (!hasReceivedFirstChunk) {
      bubbleContent.innerHTML = "";
    }
    if (err.name === "AbortError") {
      fullResponse += "\n\n*(已手動停止生成)*";
    } else {
      fullResponse += `\n\n*(連線失敗: ${err.message})*`;
    }
    bubbleContent.innerHTML = marked.parse(fullResponse);
    toolBar.classList.remove("hidden");
  } finally {
    thinkingHandler.clear();
    assistantBubbleCard?.classList.remove("speaking-bubble");
    setStreamingState(false);
    scrollToBottom();
  }
}

function stopStreaming() {
  if (state.abortController) {
    state.abortController.abort();
  }
}

function setStreamingState(isStreaming) {
  state.isStreaming = isStreaming;
  if (isStreaming) {
    btnSend.classList.add("hidden");
    btnStop.classList.remove("hidden");
    spriteContainer.classList.add("speaking");
  } else {
    btnSend.classList.remove("hidden");
    btnStop.classList.add("hidden");
    if (!state.isTTSPlaying) {
      spriteContainer.classList.remove("speaking");
    }
    document.querySelectorAll(".speaking-bubble").forEach(b => b.classList.remove("speaking-bubble"));
  }
}

// Append Bubble to DOM (支援漫畫對話框、角色名牌、LINE已讀時間標記與說話小尾巴)
function appendMessageBubble(role, content, customAvatar, speakerName) {
  const row = document.createElement("div");
  row.className = `message-row ${role}`;

  const p = state.personas.find(item => item.id === state.currentPersonaId);
  let avatarText = role === "user" ? "👤" : (customAvatar || getPersonaAvatarHtml(p, role));
  const displayName = speakerName || (role === "assistant" ? (p?.name || "AI 角色") : "你");
  const timeStr = getCurrentTimeString();

  row.innerHTML = `
    <div class="msg-avatar">${avatarText}</div>
    ${role === "user" ? `
      <div class="msg-line-meta">
        <span class="read-check">已讀</span>
        <span class="msg-time">${timeStr}</span>
      </div>
    ` : ""}
    <div class="msg-bubble">
      <div class="bubble-tail"></div>
      ${role === "assistant" ? `
        <div class="bubble-speaker-tag">
          <span class="speaker-name">${escapeHtml(displayName)}</span>
          <span class="speaker-status-badge">TALK</span>
        </div>
      ` : ""}
      <div class="bubble-text">${marked.parse(content || "")}</div>
      ${role === "assistant" ? `
        <div class="msg-toolbar ${content ? "" : "hidden"}">
          <button class="btn-msg-tool btn-copy" title="複製內容">📋 複製</button>
          <button class="btn-msg-tool btn-tts" title="朗讀 (TTS)">🔊 朗讀</button>
        </div>
      ` : ""}
    </div>
    ${role === "assistant" ? `
      <div class="msg-line-meta">
        <span class="msg-time">${timeStr}</span>
      </div>
    ` : ""}
  `;

  if (role === "assistant") {
    const copyBtn = row.querySelector(".btn-copy");
    const ttsBtn = row.querySelector(".btn-tts");

    copyBtn.addEventListener("click", () => {
      const textToCopy = row.querySelector(".bubble-text").innerText;
      navigator.clipboard.writeText(textToCopy);
      copyBtn.textContent = "✅ 已複製";
      setTimeout(() => copyBtn.textContent = "📋 複製", 2000);
    });

    ttsBtn.addEventListener("click", () => {
      const text = row.querySelector(".bubble-text").innerText;
      playTTS(text, ttsBtn, row.querySelector(".msg-bubble"));
    });
  }

  messageListEl.appendChild(row);
  return row;
}

function getCurrentTimeString() {
  const now = new Date();
  const hrs = String(now.getHours()).padStart(2, "0");
  const mins = String(now.getMinutes()).padStart(2, "0");
  return `${hrs}:${mins}`;
}

// TTS Voice Playback with Character Speaking Aura
async function playTTS(text, btnElement, bubbleElement) {
  if (state.isTTSPlaying) {
    ttsAudio.pause();
    ttsAudio.currentTime = 0;
    state.isTTSPlaying = false;
    spriteContainer.classList.remove("speaking");
    document.querySelectorAll(".speaking-bubble").forEach(b => b.classList.remove("speaking-bubble"));
    if (btnElement) btnElement.textContent = "🔊 朗讀";
    return;
  }

  if (btnElement) btnElement.textContent = "⏳ 語音生成中...";

  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: text,
        voice: state.config.tts_voice
      })
    });

    if (!res.ok) {
      throw new Error(`TTS synthesis failed with status ${res.status}`);
    }

    const audioBlob = await res.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    ttsAudio.src = audioUrl;

    if (btnElement) btnElement.textContent = "⏹️ 停止朗讀";
    state.isTTSPlaying = true;
    spriteContainer.classList.add("speaking");
    if (bubbleElement) bubbleElement.classList.add("speaking-bubble");
    ttsAudio.play();

    ttsAudio.onended = () => {
      state.isTTSPlaying = false;
      if (!state.isStreaming) {
        spriteContainer.classList.remove("speaking");
      }
      if (bubbleElement) bubbleElement.classList.remove("speaking-bubble");
      if (btnElement) btnElement.textContent = "🔊 朗讀";
    };
  } catch (err) {
    alert("語音合成失敗: " + err.message);
    state.isTTSPlaying = false;
    spriteContainer.classList.remove("speaking");
    if (bubbleElement) bubbleElement.classList.remove("speaking-bubble");
    if (btnElement) btnElement.textContent = "🔊 朗讀";
  }
}

// STT Speech Recognition
function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    sttStatus.textContent = "瀏覽器不支援語音辨識";
    btnMic.disabled = true;
    btnMic.style.opacity = 0.5;
    return;
  }

  state.recognition = new SpeechRecognition();
  state.recognition.continuous = false;
  state.recognition.interimResults = false;
  state.recognition.lang = "zh-TW";

  state.recognition.onstart = () => {
    state.isRecording = true;
    btnMic.classList.add("recording");
    sttStatus.textContent = "正在聆聽中... 請說話";
  };

  state.recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    chatInput.value = (chatInput.value ? chatInput.value + " " : "") + transcript;
    autoResizeTextarea();
  };

  state.recognition.onerror = (event) => {
    console.warn("STT Error:", event.error);
    sttStatus.textContent = "語音輸入辨識結束";
  };

  state.recognition.onend = () => {
    state.isRecording = false;
    btnMic.classList.remove("recording");
    sttStatus.textContent = "語音輸入已就緒";
  };
}

function toggleSpeechRecognition() {
  if (!state.recognition) return;
  if (state.isRecording) {
    state.recognition.stop();
  } else {
    try {
      state.recognition.start();
    } catch (e) {
      console.error(e);
    }
  }
}

// Settings Modal Actions
function openSettings() {
  updateUIWithConfig();
  updateThemeSettingsUI();
  if (cfgBubbleStyle) {
    cfgBubbleStyle.value = state.bubbleStyle || "comic";
  }
  if (previewBubbleCard) {
    previewBubbleCard.className = `preview-bubble-card preview-${state.bubbleStyle || "comic"}`;
    const p = state.personas.find(item => item.id === state.currentPersonaId);
    if (previewSpeakerName) previewSpeakerName.textContent = p?.name || "AI 角色";
  }

  const p = state.personas.find(item => item.id === state.currentPersonaId);
  if (p) {
    if (spriteMgrPersonaSelect) {
      spriteMgrPersonaSelect.innerHTML = "";
      state.personas.forEach(pers => {
        const opt = document.createElement("option");
        opt.value = pers.id;
        opt.textContent = `${pers.avatar} ${pers.name}`;
        if (pers.id === state.currentPersonaId) opt.selected = true;
        spriteMgrPersonaSelect.appendChild(opt);
      });
    }
    if (cfgAutoEmotion) cfgAutoEmotion.checked = p.auto_emotion !== false;
    if (cfgEmotionMethod) cfgEmotionMethod.value = p.emotion_method || "rules";
    renderEmotionCards(p);
    renderTouchZonesEditor(p);
    updateLivePreviewPanel(p, state.currentEmotion || "default");
  }

  const activeTab = document.querySelector(".tab-btn.active");
  if (activeTab && activeTab.getAttribute("data-tab") === "tab-sprite") {
    settingsModal.classList.add("sprite-mode");
  } else {
    settingsModal.classList.remove("sprite-mode");
  }

  settingsModal.classList.remove("hidden");
}

function closeSettings() {
  settingsModal.classList.add("hidden");
  settingsModal.classList.remove("sprite-mode");
  settingsModal.classList.remove("peek-active");
}

async function saveSettings() {
  if (cfgBubbleStyle) {
    applyBubbleStyle(cfgBubbleStyle.value);
  }

  const newConfig = {
    provider: cfgProvider.value,
    model: cfgModel.value.trim(),
    ollama_host: cfgOllamaHost.value.trim(),
    gemini_api_key: cfgGeminiKey.value.trim(),
    gemini_web_secure_1psid: cfgGeminiWeb1psid ? cfgGeminiWeb1psid.value.trim() : "",
    gemini_web_secure_1psidts: cfgGeminiWeb1psidts ? cfgGeminiWeb1psidts.value.trim() : "",
    gemini_web_secure_1psidcc: cfgGeminiWeb1psidcc ? cfgGeminiWeb1psidcc.value.trim() : "",
    gemini_web_proxy: cfgGeminiWebProxy ? cfgGeminiWebProxy.value.trim() : "",
    openai_api_key: cfgOpenaiKey.value.trim(),
    openai_base_url: cfgOpenaiUrl.value.trim(),
    tts_voice: cfgTtsVoice.value,
    tts_auto_play: cfgTtsAutoplay.checked
  };

  // Save device nickname locally & to server device profile
  const nickInput = document.getElementById("cfg-device-nickname");
  let savedNick = "";
  if (nickInput) {
    savedNick = nickInput.value.trim();
    if (savedNick) localStorage.setItem(DEVICE_NAME_KEY, savedNick);
    else localStorage.removeItem(DEVICE_NAME_KEY);
  }
  newConfig._nickname = savedNick;

  try {
    const res = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newConfig)
    });
    const result = await res.json();
    state.config = result.config;
    updateUIWithConfig();
    closeSettings();
    const curDevId = getDeviceId();
    const scopeName = curDevId === "default" ? "主電腦全域設定" : `此身分專屬設定 (${savedNick || curDevId})`;
    alert(`設定儲存成功！（已生效於 ${scopeName}）`);
  } catch (err) {
    alert("儲存設定失敗: " + err.message);
  }
}

// Helpers
function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
