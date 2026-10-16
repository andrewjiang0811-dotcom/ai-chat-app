// AI Chat App Frontend Logic (SillyTavern Style Support)
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

// Event Listeners Setup
function setupEventListeners() {
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
  btnSaveNewPersona.addEventListener("click", saveNewPersona);

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

      // Auto side-dock when in sprite tab
      if (settingsModal) {
        settingsModal.classList.toggle("sprite-mode", tabId === "tab-sprite");
      }
      if (tabId === "tab-sprite") {
        const p = state.personas.find(item => item.id === state.currentPersonaId);
        if (p) updateLivePreviewPanel(p, state.currentEmotion || "default");
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
    
    personaSelect.innerHTML = "";
    state.personas.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = `${p.avatar} ${p.name}`;
      personaSelect.appendChild(opt);
    });

    if (state.personas.length > 0) {
      setPersona(state.personas[0].id);
    }
  } catch (err) {
    console.error("Failed to load personas:", err);
  }
}

function setPersona(personaId) {
  state.currentPersonaId = personaId;
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

  renderCharacterSprite(p);
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

  if (currentImg) {
    characterSprite.src = currentImg;
    characterSprite.className = "sprite-img";
    characterSprite.classList.remove("hidden");
    spriteEmptyState.classList.add("hidden");
  } else {
    characterSprite.classList.add("hidden");
    characterSprite.src = "";
    spriteEmptyState.classList.remove("hidden");
  }

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
      characterSprite.src = currentImg;
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
  if (targetImg && characterSprite) {
    characterSprite.src = targetImg;
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
      setSpriteEmotion("default");
    }, duration);
  }

  // 5. 若立繪設定視窗開啟，同步更新彈窗內的即時預覽面板
  if (typeof updateLivePreviewPanel === "function") {
    updateLivePreviewPanel(p, validEmotion);
  }
}

// 渲染角色立繪身上的觸碰感應熱區
function renderTouchOverlay() {
  if (!spriteTouchOverlay) return;
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
      characterSprite.src = p.emotions[emotion] || p.image_url;
      characterSprite.classList.remove("hidden");
      spriteEmptyState.classList.add("hidden");
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
// 檢視範圍依角色分開存在 localStorage。x/y 以立繪區尺寸的百分比記錄，
// 所以調整立繪區大小或切換並排方向後，構圖會等比例維持。
const SPRITE_VIEW_KEY_PREFIX = "ai-chat:sprite-view:";
const SPRITE_ZOOM_MIN = 0.3;
const SPRITE_ZOOM_MAX = 5;
const SPRITE_ZOOM_STEP = 1.2;   // 按鈕每次放大/縮小倍率
const SPRITE_WHEEL_SPEED = 0.0015;

function defaultSpriteView() {
  return { scale: 1, x: 0, y: 0 };
}

function loadSpriteView(personaId) {
  try {
    const saved = JSON.parse(localStorage.getItem(SPRITE_VIEW_KEY_PREFIX + personaId) || "null");
    if (saved && Number.isFinite(saved.scale) && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
      return saved;
    }
  } catch (e) { /* 忽略損壞的儲存值 */ }
  return defaultSpriteView();
}

function saveSpriteView() {
  if (!state.currentPersonaId) return;
  try {
    localStorage.setItem(SPRITE_VIEW_KEY_PREFIX + state.currentPersonaId, JSON.stringify(state.spriteView));
  } catch (e) {
    console.warn("Failed to save sprite view:", e);
  }
}

function clearSpriteView(personaId) {
  try {
    localStorage.removeItem(SPRITE_VIEW_KEY_PREFIX + personaId);
  } catch (e) { /* ignore */ }
}

function applySpriteView({ animate = false } = {}) {
  const { scale, x, y } = state.spriteView;
  spriteTransform.classList.toggle("animated", animate);
  spriteTransform.style.transform = `translate(${x}%, ${y}%) scale(${scale})`;
  spriteZoomLabel.textContent = `${Math.round(scale * 100)}%`;
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
}

async function saveNewPersona() {
  const name = personaFormName.value.trim();
  const avatar = personaFormAvatar.value.trim() || "✨";
  const desc = personaFormDesc.value.trim();
  const prompt = personaFormPrompt.value.trim();

  if (!name || !prompt) {
    alert("請至少填寫角色名稱與系統提示詞！");
    return;
  }

  const payload = {
    name,
    avatar,
    description: desc,
    system_prompt: prompt,
    image_url: ""
  };

  try {
    const res = await fetch("/api/personas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    state.personas = await res.json();
    await loadPersonas();
    alert("成功新增自訂角色！您可以直接在立繪區為它上傳圖片。");
    personaFormName.value = "";
    personaFormAvatar.value = "";
    personaFormDesc.value = "";
    personaFormPrompt.value = "";
  } catch (err) {
    alert("儲存角色失敗: " + err);
  }
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
  welcomeScreen.classList.remove("hidden");
  document.querySelectorAll(".session-item").forEach(el => el.classList.remove("active"));
  chatInput.focus();
}

async function switchSession(sessionId) {
  state.currentSessionId = sessionId;
  document.querySelectorAll(".session-item").forEach(el => el.classList.remove("active"));
  
  try {
    const res = await fetch(`/api/sessions/${sessionId}/messages`);
    const data = await res.json();
    
    if (data.session && data.session.character_id) {
      setPersona(data.session.character_id);
    }

    messageListEl.innerHTML = "";
    if (data.messages && data.messages.length > 0) {
      welcomeScreen.classList.add("hidden");
      data.messages.forEach(msg => {
        appendMessageBubble(msg.role, msg.content);
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

  let avatarText = role === "user" ? "👤" : (customAvatar || "🤖");
  const p = state.personas.find(item => item.id === state.currentPersonaId);
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
    alert("設定儲存成功！");
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
