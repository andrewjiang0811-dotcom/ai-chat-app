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
  isTTSPlaying: false
};

// DOM Elements - Navigation & Sidebar
const sidebar = document.getElementById("sidebar");
const btnToggleSidebar = document.getElementById("btn-toggle-sidebar");
const btnToggleStage = document.getElementById("btn-toggle-stage");
const sessionListEl = document.getElementById("session-list");
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
const btnToggleDisplayMode = document.getElementById("btn-toggle-display-mode");
const displayModeIcon = document.getElementById("display-mode-icon");
const displayModeLabel = document.getElementById("display-mode-label");

// DOM Elements - Chat Window
const messagesContainer = document.getElementById("messages-container");
const messageListEl = document.getElementById("message-list");
const welcomeScreen = document.getElementById("welcome-screen");
const chatInput = document.getElementById("chat-input");
const btnSend = document.getElementById("btn-send");
const btnStop = document.getElementById("btn-stop");
const btnMic = document.getElementById("btn-mic");
const sttStatus = document.getElementById("stt-status");

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
const personaFormMode = document.getElementById("persona-form-mode");
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
  setupEventListeners();
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
  btnToggleSidebar.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
  });

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
  btnToggleDisplayMode.addEventListener("click", toggleDisplayMode);
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

  renderCharacterSprite(p);
}

function renderCharacterSprite(persona) {
  const mode = persona.display_mode || "half_body";
  updateDisplayModeUI(mode);

  if (persona.image_url) {
    characterSprite.src = persona.image_url;
    characterSprite.className = `sprite-img mode-${mode.replace('_', '-')}`;
    characterSprite.classList.remove("hidden");
    spriteEmptyState.classList.add("hidden");
  } else {
    characterSprite.classList.add("hidden");
    characterSprite.src = "";
    spriteEmptyState.classList.remove("hidden");
  }
}

function updateDisplayModeUI(mode) {
  if (mode === "full_body") {
    displayModeLabel.textContent = "全身";
    displayModeIcon.textContent = "🧍";
    characterSprite.className = "sprite-img mode-full-body";
  } else {
    displayModeLabel.textContent = "上半身";
    displayModeIcon.textContent = "👤";
    characterSprite.className = "sprite-img mode-half-body";
  }
}

async function toggleDisplayMode() {
  const p = state.personas.find(item => item.id === state.currentPersonaId);
  if (!p) return;

  const currentMode = p.display_mode || "half_body";
  const newMode = currentMode === "half_body" ? "full_body" : "half_body";
  p.display_mode = newMode;

  updateDisplayModeUI(newMode);

  // Persist to backend
  try {
    await fetch(`/api/personas/${p.id}/display_mode`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_mode: newMode })
    });
  } catch (e) {
    console.error("Failed to update display mode:", e);
  }
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
  formData.append("display_mode", p.display_mode || "half_body");

  try {
    btnChangeSprite.textContent = "⏳ 上傳中...";
    const res = await fetch(`/api/personas/${p.id}/avatar`, {
      method: "POST",
      body: formData
    });

    if (!res.ok) throw new Error("Upload failed");

    const updatedPersona = await res.json();
    p.image_url = updatedPersona.image_url;
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

async function saveNewPersona() {
  const name = personaFormName.value.trim();
  const avatar = personaFormAvatar.value.trim() || "✨";
  const mode = personaFormMode.value || "half_body";
  const desc = personaFormDesc.value.trim();
  const prompt = personaFormPrompt.value.trim();

  if (!name || !prompt) {
    alert("請至少填寫角色名稱與系統提示詞！");
    return;
  }

  const payload = {
    name,
    avatar,
    display_mode: mode,
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
  sessions.forEach(s => {
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
  const currentPersona = state.personas.find(p => p.id === state.currentPersonaId) || { avatar: "🤖" };
  const assistantBubble = appendMessageBubble("assistant", "", currentPersona.avatar);
  const bubbleContent = assistantBubble.querySelector(".bubble-text");
  const toolBar = assistantBubble.querySelector(".msg-toolbar");

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
      playTTS(fullResponse, assistantBubble.querySelector(".btn-tts"));
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
  }
}

// Append Bubble to DOM
function appendMessageBubble(role, content, customAvatar) {
  const row = document.createElement("div");
  row.className = `message-row ${role}`;

  let avatarText = role === "user" ? "👤" : (customAvatar || "🤖");

  row.innerHTML = `
    <div class="msg-avatar">${avatarText}</div>
    <div class="msg-bubble">
      <div class="bubble-text">${marked.parse(content || "")}</div>
      ${role === "assistant" ? `
        <div class="msg-toolbar ${content ? "" : "hidden"}">
          <button class="btn-msg-tool btn-copy" title="複製內容">📋 複製</button>
          <button class="btn-msg-tool btn-tts" title="朗讀 (TTS)">🔊 朗讀</button>
        </div>
      ` : ""}
    </div>
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
      playTTS(text, ttsBtn);
    });
  }

  messageListEl.appendChild(row);
  return row;
}

// TTS Voice Playback with Character Speaking Aura
async function playTTS(text, btnElement) {
  if (state.isTTSPlaying) {
    ttsAudio.pause();
    ttsAudio.currentTime = 0;
    state.isTTSPlaying = false;
    spriteContainer.classList.remove("speaking");
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
    ttsAudio.play();

    ttsAudio.onended = () => {
      state.isTTSPlaying = false;
      if (!state.isStreaming) {
        spriteContainer.classList.remove("speaking");
      }
      if (btnElement) btnElement.textContent = "🔊 朗讀";
    };
  } catch (err) {
    alert("語音合成失敗: " + err.message);
    state.isTTSPlaying = false;
    spriteContainer.classList.remove("speaking");
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
  settingsModal.classList.remove("hidden");
}

function closeSettings() {
  settingsModal.classList.add("hidden");
}

async function saveSettings() {
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
