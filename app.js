const $ = (sel) => document.querySelector(sel);
const messagesEl = $('#messages');
const typingEl = $('#typing');
const wsUrlEl = $('#wsUrl');
const wsTokenEl = $('#wsToken');
const connectBtn = $('#connectBtn');
const disconnectBtn = $('#disconnectBtn');
const connIndicator = $('#connIndicator');
const connText = $('#connText');
const errorText = $('#errorText');
const chatInput = $('#chatInput');
const sendBtn = $('#sendBtn');
const sessionLabel = $('#sessionLabel');
const modelLabel = $('#modelLabel');
const agentLabel = $('#agentLabel');

const modal = $('#modal');
const modalTitle = $('#modalTitle');
const modalSearch = $('#modalSearch');
const modalList = $('#modalList');
const modalClose = $('#modalClose');

let ws = null;
let connected = false;
let manualClose = false;
let retryCount = 0;
let pending = new Map();
let streamMap = new Map();
let currentSession = null;
let currentModel = null;
let currentAgent = null;
let lastRunId = null;

function setStatus(state) {
  connIndicator.className = `dot ${state}`;
  connText.textContent = state;
}

function showError(msg) {
  errorText.textContent = msg || '';
}

function encodeMessage(obj) {
  const json = JSON.stringify(obj);
  return new TextEncoder().encode(json);
}

function decodeMessage(data) {
  if (data instanceof ArrayBuffer) {
    return new TextDecoder().decode(new Uint8Array(data));
  }
  if (data instanceof Blob) {
    return data.text();
  }
  if (typeof data === 'string') return data;
  return '';
}

function sendRaw(obj) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(encodeMessage(obj));
}

function rpcCall(method, params = {}) {
  const id = crypto.randomUUID();
  const payload = { id, method, params };
  sendRaw(payload);
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error('RPC timeout'));
    }, 30000);
    pending.set(id, { resolve, reject, timeout });
  });
}

function addMessage(role, content, opts = {}) {
  const div = document.createElement('div');
  div.className = `message ${role}`;
  if (role === 'assistant') {
    div.innerHTML = window.marked.parse(content);
    div.querySelectorAll('pre code').forEach((block) => hljs.highlightElement(block));
  } else {
    div.textContent = content;
  }
  if (opts.runId) div.dataset.runId = opts.runId;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return div;
}

function updateStreaming(runId, delta, done) {
  let div = messagesEl.querySelector(`[data-run-id="${runId}"]`);
  if (!div) {
    div = addMessage('assistant', '', { runId });
  }
  const prev = streamMap.get(runId) || '';
  const next = prev + (delta || '');
  streamMap.set(runId, next);
  div.innerHTML = window.marked.parse(next);
  div.querySelectorAll('pre code').forEach((block) => hljs.highlightElement(block));
  if (done) {
    streamMap.delete(runId);
    typingEl.classList.add('hidden');
  }
}

function handlePush(event, payload) {
  if (!payload) return;
  if (payload.delta || payload.runId) {
    typingEl.classList.remove('hidden');
    updateStreaming(payload.runId || 'stream', payload.delta || payload.text || '', payload.done);
    if (payload.done && payload.message) {
      addMessage(payload.message.role || 'assistant', payload.message.content || '');
    }
    return;
  }
  if (payload.message) {
    addMessage(payload.message.role || 'assistant', payload.message.content || payload.message);
    return;
  }
  if (event) {
    addMessage('system', `[${event}] ${JSON.stringify(payload)}`);
  }
}

let connectNonce = null;
let connectSent = false;

async function connect() {
  showError('');
  const baseUrl = wsUrlEl.value.trim();
  if (!baseUrl) return showError('URL required');
  let url = baseUrl;
  const token = wsTokenEl.value.trim();
  if (token && !url.includes('token=')) {
    url += (url.includes('?') ? '&' : '?') + `token=${encodeURIComponent(token)}`;
  }
  manualClose = false;
  connectNonce = null;
  connectSent = false;
  setStatus('connecting');
  ws = new WebSocket(url);
  ws.binaryType = 'arraybuffer';

  ws.onopen = () => {
    retryCount = 0;
    // Wait for connect.challenge before sending connect
  };

  ws.onclose = () => {
    connected = false;
    connectSent = false;
    setStatus('offline');
    connectBtn.disabled = false;
    disconnectBtn.disabled = true;
    if (!manualClose) scheduleReconnect();
  };

  ws.onerror = (e) => {
    showError('WebSocket error');
    console.error(e);
  };

  ws.onmessage = async (msg) => {
    const text = await decodeMessage(msg.data);
    if (!text) return;
    let data;
    try { data = JSON.parse(text); } catch { return; }

    // Handle connect challenge
    if (data.event === 'connect.challenge' && data.payload?.nonce) {
      connectNonce = data.payload.nonce;
      sendConnect();
      return;
    }

    // Handle connect response
    if (data.type === 'res' && data.id && data.result?.connected) {
      connected = true;
      setStatus('connected');
      connectBtn.disabled = true;
      disconnectBtn.disabled = false;
      addMessage('system', 'Connected to gateway.');
      return;
    }

    // Handle errors from connect
    if (data.type === 'res' && data.id && data.error) {
      showError(`Auth failed: ${data.error.message || data.error}`);
      disconnect();
      return;
    }

    // Handle pending RPC responses
    if (data.id) {
      const entry = pending.get(data.id);
      if (!entry) return;
      clearTimeout(entry.timeout);
      pending.delete(data.id);
      if (data.error) entry.reject(data.error);
      else entry.resolve(data.result);
      return;
    }

    // Handle server push events
    if (data.event) {
      handlePush(data.event, data.payload);
    }
  };
}

function sendConnect() {
  if (connectSent || !ws || ws.readyState !== WebSocket.OPEN) return;
  connectSent = true;
  const token = wsTokenEl.value.trim();
  const params = {
    minProtocol: 1,
    maxProtocol: 1,
    client: {
      id: 'pwa-client',
      version: '1.0.0',
      platform: 'web',
      mode: 'frontend'
    },
    role: 'operator',
    scopes: ['operator.admin'],
    caps: ['chat', 'sessions', 'models'],
    auth: token ? { token } : undefined,
    nonce: connectNonce
  };
  sendRaw({ type: 'req', method: 'connect', id: crypto.randomUUID(), params });
}

function disconnect() {
  manualClose = true;
  if (ws) ws.close();
}

function scheduleReconnect() {
  if (retryCount >= 5) return;
  retryCount += 1;
  const delay = Math.min(1000 * 2 ** (retryCount - 1), 15000);
  addMessage('system', `Reconnecting in ${delay / 1000}s... (${retryCount}/5)`);
  setTimeout(() => {
    if (!connected && !manualClose) connect();
  }, delay);
}

async function sendChatMessage(content) {
  if (!currentSession) {
    await loadSessions(true);
  }
  addMessage('user', content);
  typingEl.classList.remove('hidden');
  const params = {
    sessionKey: currentSession,
    message: content,
  };
  try {
    const res = await rpcCall('chat.send', params);
    lastRunId = res?.runId || null;
  } catch (err) {
    typingEl.classList.add('hidden');
    addMessage('system', `Error: ${err.message || err}`);
  }
}

async function loadSessions(pickFirst = false) {
  try {
    const res = await rpcCall('sessions.list', { limit: 20, includeDerivedTitles: true, includeLastMessage: true });
    const sessions = res.sessions || [];
    if (pickFirst && sessions.length) {
      currentSession = sessions[0].key;
      sessionLabel.textContent = sessions[0].displayName || sessions[0].derivedTitle || sessions[0].key;
    }
    return sessions;
  } catch (err) {
    addMessage('system', `Session load failed: ${err.message || err}`);
    return [];
  }
}

async function loadModels() {
  try {
    const res = await rpcCall('models.list');
    return res.models || [];
  } catch (err) {
    addMessage('system', `Model load failed: ${err.message || err}`);
    return [];
  }
}

async function loadAgents() {
  try {
    const res = await rpcCall('agents.list');
    currentAgent = res.defaultId || currentAgent;
    agentLabel.textContent = currentAgent || 'default';
    return res.agents || [];
  } catch (err) {
    addMessage('system', `Agent load failed: ${err.message || err}`);
    return [];
  }
}

function openModal(title, items, onSelect, formatter = (x) => x) {
  modalTitle.textContent = title;
  modalList.innerHTML = '';
  modalSearch.value = '';
  modal.classList.remove('hidden');

  let activeIndex = -1;
  const render = (filter = '') => {
    const filtered = items.filter((i) => formatter(i).toLowerCase().includes(filter.toLowerCase()));
    modalList.innerHTML = '';
    filtered.forEach((item, idx) => {
      const li = document.createElement('li');
      li.textContent = formatter(item);
      li.onclick = () => { closeModal(); onSelect(item); };
      if (idx === activeIndex) li.classList.add('active');
      modalList.appendChild(li);
    });
  };

  const keyHandler = (e) => {
    const listItems = [...modalList.querySelectorAll('li')];
    if (e.key === 'ArrowDown') { activeIndex = Math.min(activeIndex + 1, listItems.length - 1); }
    if (e.key === 'ArrowUp') { activeIndex = Math.max(activeIndex - 1, 0); }
    if (e.key === 'Enter' && listItems[activeIndex]) { listItems[activeIndex].click(); }
    listItems.forEach((li, idx) => li.classList.toggle('active', idx === activeIndex));
  };

  modalSearch.oninput = () => render(modalSearch.value);
  modalSearch.onkeydown = keyHandler;
  render();
  modalSearch.focus();
}

function closeModal() {
  modal.classList.add('hidden');
}

async function ensureSession() {
  if (!currentSession) {
    await loadSessions(true);
  }
}

async function handleSlash(cmd) {
  const [base, ...rest] = cmd.split(' ');
  const arg = rest.join(' ').trim();
  switch (base) {
    case '/help':
      addMessage('system', 'Commands: /help /model [id] /models /session [key] /sessions /agent [id] /agents /status /reset /abort');
      break;
    case '/model':
      if (!arg) {
        addMessage('system', `Current model: ${currentModel || 'default'}`);
      } else {
        await ensureSession();
        await rpcCall('sessions.patch', { key: currentSession, model: arg });
        currentModel = arg;
        modelLabel.textContent = arg;
      }
      break;
    case '/models':
      await ensureSession();
      openModal('Models', await loadModels(), async (m) => {
        await rpcCall('sessions.patch', { key: currentSession, model: m.id });
        currentModel = m.id;
        modelLabel.textContent = m.name || m.id;
      }, (m) => `${m.id} — ${m.name || ''}`);
      break;
    case '/session':
      if (!arg) {
        addMessage('system', `Current session: ${currentSession || 'none'}`);
      } else {
        currentSession = arg;
        sessionLabel.textContent = arg;
      }
      break;
    case '/sessions':
      openModal('Sessions', await loadSessions(), (s) => {
        currentSession = s.key;
        sessionLabel.textContent = s.displayName || s.derivedTitle || s.key;
      }, (s) => `${s.displayName || s.derivedTitle || s.key}`);
      break;
    case '/agent':
      if (!arg) {
        addMessage('system', `Current agent: ${currentAgent || 'default'}`);
      } else {
        currentAgent = arg;
        agentLabel.textContent = arg;
      }
      break;
    case '/agents':
      openModal('Agents', await loadAgents(), (a) => {
        currentAgent = a.id;
        agentLabel.textContent = a.name || a.id;
      }, (a) => `${a.id} — ${a.name || ''}`);
      break;
    case '/status':
      addMessage('system', JSON.stringify(await rpcCall('status'), null, 2));
      break;
    case '/reset':
      await ensureSession();
      await rpcCall('sessions.reset', { key: currentSession, reason: 'user' });
      addMessage('system', 'Session reset.');
      break;
    case '/abort':
      await ensureSession();
      if (!lastRunId) return addMessage('system', 'No active run to abort.');
      await rpcCall('chat.abort', { sessionKey: currentSession, runId: lastRunId });
      addMessage('system', 'Abort requested.');
      break;
    default:
      addMessage('system', `Unknown command: ${base}`);
  }
}

connectBtn.onclick = () => connect();
disconnectBtn.onclick = () => disconnect();
modalClose.onclick = () => closeModal();
modal.onclick = (e) => { if (e.target === modal) closeModal(); };

sendBtn.onclick = async () => {
  const text = chatInput.value.trim();
  if (!text) return;
  chatInput.value = '';
  if (text.startsWith('/')) return handleSlash(text);
  await sendChatMessage(text);
};

chatInput.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendBtn.click();
  }
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}

setStatus('offline');
