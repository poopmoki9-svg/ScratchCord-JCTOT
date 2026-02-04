/* ScratchCord: JCTOT
 * Fully client-side social hub with chat + WebRTC voice calling.
 * All storage is via public JSON endpoints (Firebase REST or similar).
 */

const DEFAULT_SETTINGS = {
  cloudBaseUrl: "",
  useLocalFallback: true,
};

const state = {
  settings: { ...DEFAULT_SETTINGS },
  data: null,
  activeRoomId: "global",
  chatPoller: null,
  callPoller: null,
  peerConnection: null,
  localStream: null,
  isCaller: false,
  callId: null,
  sentCandidateIds: new Set(),
  processedRemoteCandidates: new Set(),
};

const dom = {
  cloudBaseUrl: document.getElementById("cloudBaseUrl"),
  localFallback: document.getElementById("localFallback"),
  saveCloud: document.getElementById("saveCloud"),
  cloudStatus: document.getElementById("cloudStatus"),
  feed: document.getElementById("feed"),
  profiles: document.getElementById("profiles"),
  projects: document.getElementById("projects"),
  series: document.getElementById("series"),
  roomSelect: document.getElementById("roomSelect"),
  newRoom: document.getElementById("newRoom"),
  characterSelect: document.getElementById("characterSelect"),
  chatMessages: document.getElementById("chatMessages"),
  chatForm: document.getElementById("chatForm"),
  chatInput: document.getElementById("chatInput"),
  oocToggle: document.getElementById("oocToggle"),
  callerCharacter: document.getElementById("callerCharacter"),
  callId: document.getElementById("callId"),
  createCall: document.getElementById("createCall"),
  joinCall: document.getElementById("joinCall"),
  leaveCall: document.getElementById("leaveCall"),
  muteToggle: document.getElementById("muteToggle"),
  callState: document.getElementById("callState"),
  callHint: document.getElementById("callHint"),
  remoteAudio: document.getElementById("remoteAudio"),
};

class CloudStore {
  constructor(settings) {
    this.settings = settings;
  }

  get hasCloud() {
    return Boolean(this.settings.cloudBaseUrl);
  }

  async get(path) {
    if (this.hasCloud) {
      const response = await fetch(`${this.settings.cloudBaseUrl}/${path}.json`);
      return response.ok ? response.json() : null;
    }
    if (this.settings.useLocalFallback) {
      const raw = localStorage.getItem(path);
      return raw ? JSON.parse(raw) : null;
    }
    return null;
  }

  async set(path, value) {
    if (this.hasCloud) {
      await fetch(`${this.settings.cloudBaseUrl}/${path}.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      });
      return;
    }
    if (this.settings.useLocalFallback) {
      localStorage.setItem(path, JSON.stringify(value));
    }
  }

  async update(path, patch) {
    if (this.hasCloud) {
      await fetch(`${this.settings.cloudBaseUrl}/${path}.json`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      return;
    }
    if (this.settings.useLocalFallback) {
      const current = (await this.get(path)) || {};
      const next = { ...current, ...patch };
      await this.set(path, next);
    }
  }
}

const cloud = () => new CloudStore(state.settings);

const renderAvatar = (character) => {
  const initials = character.name
    .split(" ")
    .map((chunk) => chunk[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return `
    <div class="profile-chip">
      <span class="avatar" style="background:${character.color}">${initials}</span>
      <span>${character.name}</span>
    </div>
  `;
};

const loadSettings = () => {
  const stored = localStorage.getItem("scratchcordSettings");
  state.settings = stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
  dom.cloudBaseUrl.value = state.settings.cloudBaseUrl;
  dom.localFallback.checked = state.settings.useLocalFallback;
  updateCloudStatus();
};

const saveSettings = () => {
  state.settings.cloudBaseUrl = dom.cloudBaseUrl.value.trim();
  state.settings.useLocalFallback = dom.localFallback.checked;
  localStorage.setItem("scratchcordSettings", JSON.stringify(state.settings));
  updateCloudStatus();
  startChatPolling();
};

const updateCloudStatus = () => {
  if (state.settings.cloudBaseUrl) {
    dom.cloudStatus.textContent = "Cloud connected";
  } else if (state.settings.useLocalFallback) {
    dom.cloudStatus.textContent = "Local demo mode";
  } else {
    dom.cloudStatus.textContent = "Not connected";
  }
};

const renderFeed = () => {
  dom.feed.innerHTML = state.data.feed
    .map(
      (item) => `
      <article class="card">
        <h3>${item.title}</h3>
        <div class="chat-meta">${item.type} • ${item.character}</div>
        <p>${item.body}</p>
        <div>${item.reactions.map((reaction) => `<span class="tag">${reaction}</span>`).join("")}</div>
      </article>
    `,
    )
    .join("");
};

const renderProfiles = () => {
  dom.profiles.innerHTML = state.data.characters
    .map(
      (character) => `
      <article class="card">
        ${renderAvatar(character)}
        <p>${character.bio}</p>
        <p><strong>Traits:</strong> ${character.traits.join(", ")}</p>
        <p><strong>Role:</strong> ${character.role}</p>
        <p><strong>Projects:</strong> ${character.projects.join(", ")}</p>
      </article>
    `,
    )
    .join("");
};

const renderProjects = () => {
  dom.projects.innerHTML = state.data.projects
    .map(
      (project) => `
      <article class="card">
        <h3>${project.title}</h3>
        <p>${project.description}</p>
        <p><strong>Contributors:</strong> ${project.contributors.join(", ")}</p>
        <p>${project.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}</p>
      </article>
    `,
    )
    .join("");

  dom.series.innerHTML = state.data.series
    .map(
      (series) => `
      <article class="card">
        <h3>${series.title}</h3>
        <p>${series.description}</p>
        <p><strong>Episodes:</strong> ${series.episodes.join(" → ")}</p>
        <p><strong>Canon:</strong> ${series.canon ? "Canon" : "Non-canon"}</p>
      </article>
    `,
    )
    .join("");
};

const populateSelectors = () => {
  const options = state.data.characters
    .map((character) => `<option value="${character.id}">${character.name}</option>`)
    .join("");
  dom.characterSelect.innerHTML = options;
  dom.callerCharacter.innerHTML = options;

  const roomOptions = state.data.rooms
    .map((room) => `<option value="${room.id}">${room.name}</option>`)
    .join("");
  dom.roomSelect.innerHTML = roomOptions;
};

const formatTimestamp = (iso) =>
  new Date(iso).toLocaleString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  });

const renderChatMessages = (messages = []) => {
  dom.chatMessages.innerHTML = messages
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .map((message) => {
      const character = state.data.characters.find((entry) => entry.id === message.characterId);
      const speaker = character ? character.name : "Unknown";
      const oocLabel = message.ooc ? "(OOC)" : "";
      return `
        <div class="chat-message">
          <div class="chat-meta">${speaker} ${oocLabel} • ${formatTimestamp(message.timestamp)}</div>
          <div class="chat-text">${message.text}</div>
        </div>
      `;
    })
    .join("");
};

const fetchChatMessages = async () => {
  const roomId = state.activeRoomId;
  const data = (await cloud().get(`chats/${roomId}`)) || { messages: {} };
  const messages = Object.values(data.messages || {});
  renderChatMessages(messages);
};

const sendChatMessage = async (text) => {
  const roomId = state.activeRoomId;
  const messageId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const payload = {
    characterId: dom.characterSelect.value,
    timestamp: new Date().toISOString(),
    text,
    ooc: dom.oocToggle.checked,
  };

  const current = (await cloud().get(`chats/${roomId}`)) || { messages: {} };
  const nextMessages = { ...(current.messages || {}), [messageId]: payload };
  await cloud().set(`chats/${roomId}`, { ...current, messages: nextMessages });
  await fetchChatMessages();
};

const startChatPolling = () => {
  if (state.chatPoller) {
    clearInterval(state.chatPoller);
  }
  fetchChatMessages();
  state.chatPoller = setInterval(fetchChatMessages, 3000);
};

const ensureRoomsInCloud = async () => {
  const existing = await cloud().get("rooms");
  if (!existing) {
    await cloud().set("rooms", state.data.rooms);
  }
};

const setCallState = (text) => {
  dom.callState.textContent = text;
};

const createPeerConnection = () => {
  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  });

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      queueLocalCandidate(event.candidate);
    }
  };

  pc.ontrack = (event) => {
    const [stream] = event.streams;
    dom.remoteAudio.srcObject = stream;
  };

  pc.onconnectionstatechange = () => {
    if (["failed", "disconnected"].includes(pc.connectionState)) {
      setCallState("Connection failed");
    }
  };

  return pc;
};

const queueLocalCandidate = async (candidate) => {
  if (!state.callId) return;
  const candidateId = `${candidate.sdpMLineIndex}-${candidate.candidate}`;
  if (state.sentCandidateIds.has(candidateId)) return;
  state.sentCandidateIds.add(candidateId);

  const path = state.isCaller
    ? `calls/${state.callId}/callerCandidates`
    : `calls/${state.callId}/calleeCandidates`;
  const existing = (await cloud().get(path)) || {};
  const update = { ...existing, [Date.now()]: candidate.toJSON() };
  await cloud().set(path, update);
};

const applyRemoteCandidates = async () => {
  if (!state.callId || !state.peerConnection) return;
  const path = state.isCaller
    ? `calls/${state.callId}/calleeCandidates`
    : `calls/${state.callId}/callerCandidates`;
  const candidates = (await cloud().get(path)) || {};

  for (const [id, candidate] of Object.entries(candidates)) {
    if (state.processedRemoteCandidates.has(id)) continue;
    state.processedRemoteCandidates.add(id);
    try {
      await state.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.warn("Failed to add ICE candidate", error);
    }
  }
};

const startCallPolling = () => {
  if (state.callPoller) {
    clearInterval(state.callPoller);
  }

  state.callPoller = setInterval(async () => {
    if (!state.callId) return;
    const callData = (await cloud().get(`calls/${state.callId}`)) || {};

    if (!state.isCaller && callData.offer && !state.peerConnection.currentRemoteDescription) {
      await state.peerConnection.setRemoteDescription(new RTCSessionDescription(callData.offer));
      const answer = await state.peerConnection.createAnswer();
      await state.peerConnection.setLocalDescription(answer);
      await cloud().update(`calls/${state.callId}`, { answer });
      setCallState("Answer sent");
    }

    if (state.isCaller && callData.answer && !state.peerConnection.currentRemoteDescription) {
      await state.peerConnection.setRemoteDescription(new RTCSessionDescription(callData.answer));
      setCallState("Connected");
    }

    await applyRemoteCandidates();
  }, 2000);
};

const startLocalAudio = async () => {
  try {
    state.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  } catch (error) {
    setCallState("Microphone blocked");
    throw error;
  }

  state.localStream.getTracks().forEach((track) => {
    state.peerConnection.addTrack(track, state.localStream);
  });
  dom.muteToggle.disabled = false;
  dom.muteToggle.textContent = "Mute";
};

const createCall = async () => {
  if (!dom.callId.value.trim()) {
    dom.callId.value = `call-${Math.random().toString(16).slice(2, 7)}`;
  }
  state.callId = dom.callId.value.trim();
  state.isCaller = true;
  state.sentCandidateIds.clear();
  state.processedRemoteCandidates.clear();
  setCallState("Creating offer");

  state.peerConnection = createPeerConnection();
  await startLocalAudio();

  const offer = await state.peerConnection.createOffer();
  await state.peerConnection.setLocalDescription(offer);
  await cloud().set(`calls/${state.callId}`, {
    offer,
    caller: dom.callerCharacter.value,
    createdAt: new Date().toISOString(),
  });

  setCallState("Offer sent");
  dom.leaveCall.disabled = false;
  startCallPolling();
};

const joinCall = async () => {
  if (!dom.callId.value.trim()) {
    setCallState("Enter a Call ID");
    return;
  }

  state.callId = dom.callId.value.trim();
  state.isCaller = false;
  state.sentCandidateIds.clear();
  state.processedRemoteCandidates.clear();
  setCallState("Joining call");

  const callData = await cloud().get(`calls/${state.callId}`);
  if (!callData || !callData.offer) {
    setCallState("Offer not found");
    return;
  }

  state.peerConnection = createPeerConnection();
  await startLocalAudio();
  await state.peerConnection.setRemoteDescription(new RTCSessionDescription(callData.offer));
  const answer = await state.peerConnection.createAnswer();
  await state.peerConnection.setLocalDescription(answer);
  await cloud().update(`calls/${state.callId}`, { answer, callee: dom.callerCharacter.value });

  setCallState("Answer sent");
  dom.leaveCall.disabled = false;
  startCallPolling();
};

const leaveCall = async () => {
  if (state.peerConnection) {
    state.peerConnection.close();
  }
  if (state.localStream) {
    state.localStream.getTracks().forEach((track) => track.stop());
  }

  state.peerConnection = null;
  state.localStream = null;
  state.callId = null;
  dom.remoteAudio.srcObject = null;
  dom.leaveCall.disabled = true;
  dom.muteToggle.disabled = true;
  setCallState("Idle");
  if (state.callPoller) {
    clearInterval(state.callPoller);
  }
};

const toggleMute = () => {
  if (!state.localStream) return;
  const track = state.localStream.getAudioTracks()[0];
  if (!track) return;
  track.enabled = !track.enabled;
  dom.muteToggle.textContent = track.enabled ? "Mute" : "Unmute";
};

const initialize = async () => {
  loadSettings();
  const response = await fetch("data/sample-data.json");
  state.data = await response.json();

  renderFeed();
  renderProfiles();
  renderProjects();
  populateSelectors();
  await ensureRoomsInCloud();
  startChatPolling();
};

// Event listeners

dom.saveCloud.addEventListener("click", saveSettings);

dom.roomSelect.addEventListener("change", (event) => {
  state.activeRoomId = event.target.value;
  fetchChatMessages();
});

dom.newRoom.addEventListener("click", async () => {
  const name = window.prompt("Name your new room");
  if (!name) return;
  const id = `room-${Math.random().toString(16).slice(2, 7)}`;
  state.data.rooms.push({ id, name });
  populateSelectors();
  dom.roomSelect.value = id;
  state.activeRoomId = id;
  await cloud().set("rooms", state.data.rooms);
  await cloud().set(`chats/${id}`, { messages: {} });
});

dom.chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = dom.chatInput.value.trim();
  if (!text) return;
  await sendChatMessage(text);
  dom.chatInput.value = "";
});

dom.createCall.addEventListener("click", createCall);

dom.joinCall.addEventListener("click", joinCall);

dom.leaveCall.addEventListener("click", leaveCall);

dom.muteToggle.addEventListener("click", toggleMute);

initialize();
