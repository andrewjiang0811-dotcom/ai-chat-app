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
  bubbleStyle: "comic", // 對話框邊框風格 (comic | vn | cyber | clean)
  chatTheme: "default", // 聊天室背景與情境主題 (line | parchment | book | default | custom)
  deviceFrame: "phone", // 擬物化裝置外框 (phone | parchment | book | none)
  parchmentFont: "cursive", // 羊皮紙字型 (cursive 草書 | kaiti 楷體 | serif 古宋)
  customBg: { url: "", overlay: 20, blur: 0 } // 自訂背景圖片設定
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
const cfgOpenaiKey = document.getElementById("cfg-openai-key");
const cfgOpenaiUrl = document.getElementById("cfg-openai-url");
const cfgModel = document.getElementById("cfg-model");
const modelQuickSelect = document.getElementById("model-quick-select");
const cfgTtsVoice = document.getElementById("cfg-tts-voice");
const cfgTtsAutoplay = document.getElementById("cfg-tts-autoplay");
const groupOllama = document.getElementById("group-ollama");
const groupGemini = document.getElementById("group-gemini");
const groupOpenai = document.getElementById("group-openai");

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
    characterStage.classList.toggle("collapsed");
    btnToggleStage.classList.toggle("active", !characterStage.classList.contains("collapsed"));
  });

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

  // Stage Controls
  btnChangeSprite.addEventListener("click", () => spriteFileInput.click());
  btnEmptyUpload.addEventListener("click", () => spriteFileInput.click());
  spriteFileInput.addEventListener("change", handleSpriteUpload);

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
      document.getElementById(tabId).classList.add("active");
    });
  });

  cfgProvider.addEventListener("change", updateProviderFields);
  modelQuickSelect.addEventListener("change", (e) => {
    if (e.target.value) {
      cfgModel.value = e.target.value;
    }
  });

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
  navModelName.textContent = `${p.toUpperCase()}: ${m}`;
  
  cfgProvider.value = p;
  cfgModel.value = m;
  cfgOllamaHost.value = state.config.ollama_host || "http://localhost:11434";
  cfgGeminiKey.value = state.config.gemini_api_key || "";
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
  groupOpenai.classList.add("hidden");

  if (val === "ollama") groupOllama.classList.remove("hidden");
  else if (val === "gemini") groupGemini.classList.remove("hidden");
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
    else list = data.openai || [];

    list.forEach(m => {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m;
      modelQuickSelect.appendChild(opt);
    });
  } catch (e) {
    console.error("Failed to fetch models:", e);
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
  if (persona.image_url) {
    characterSprite.src = persona.image_url;
    characterSprite.className = "sprite-img";
    characterSprite.classList.remove("hidden");
    spriteEmptyState.classList.add("hidden");
  } else {
    characterSprite.classList.add("hidden");
    characterSprite.src = "";
    spriteEmptyState.classList.remove("hidden");
  }

  // 立繪縮放/平移：有圖才顯示控制鈕，並載入此角色上次的檢視範圍
  const hasSprite = !!persona.image_url;
  spriteContainer.classList.toggle("has-sprite", hasSprite);
  spriteZoomControls.classList.toggle("hidden", !hasSprite);
  state.spriteView = loadSpriteView(persona.id);
  applySpriteView();
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

  // 滾輪縮放（以游標位置為中心）
  spriteContainer.addEventListener("wheel", (e) => {
    if (!spriteContainer.classList.contains("has-sprite")) return;
    e.preventDefault();
    // deltaMode 1 = 以「行」為單位（Firefox），換算成像素
    const dy = clamp(e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY, -200, 200);
    const { px, py } = pointerToStagePercent(e);
    zoomSpriteAt(state.spriteView.scale * Math.exp(-dy * SPRITE_WHEEL_SPEED), px, py);
  }, { passive: false });

  // 拖曳平移
  spriteContainer.addEventListener("pointerdown", (e) => {
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

  // 雙擊立繪還原
  spriteContainer.addEventListener("dblclick", (e) => {
    if (!spriteContainer.classList.contains("has-sprite") || isZoomControl(e.target)) return;
    resetSpriteView();
  });

  // 按鈕：以立繪區中心縮放
  btnSpriteZoomIn.addEventListener("click", () => zoomSpriteAt(state.spriteView.scale * SPRITE_ZOOM_STEP, 0, 0, true));
  btnSpriteZoomOut.addEventListener("click", () => zoomSpriteAt(state.spriteView.scale / SPRITE_ZOOM_STEP, 0, 0, true));
  btnSpriteZoomReset.addEventListener("click", resetSpriteView);
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

  // Toggle Streaming UI & Character Speaking Animation
  setStreamingState(true);

  state.abortController = new AbortController();
  let fullResponse = "";

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
              fullResponse += data.content;
              bubbleContent.innerHTML = marked.parse(fullResponse);
              hljs.highlightAll();
              scrollToBottom();
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
    bubbleContent.innerHTML = marked.parse(fullResponse);
    hljs.highlightAll();
    toolBar.classList.remove("hidden");

    // Auto-play TTS if enabled
    if (state.config.tts_auto_play && fullResponse.trim()) {
      playTTS(fullResponse, assistantBubble.querySelector(".btn-tts"), assistantBubbleCard);
    }

    await loadSessionsQuiet();
  } catch (err) {
    if (err.name === "AbortError") {
      fullResponse += "\n\n*(已手動停止生成)*";
    } else {
      fullResponse += `\n\n*(連線失敗: ${err.message})*`;
    }
    bubbleContent.innerHTML = marked.parse(fullResponse);
    toolBar.classList.remove("hidden");
  } finally {
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
  settingsModal.classList.remove("hidden");
}

function closeSettings() {
  settingsModal.classList.add("hidden");
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
