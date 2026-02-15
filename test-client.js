
const WebSocket = global.WebSocket || require('ws'); // Fallback if not global

const TARGET = 'ws://192.168.1.19:11112';
const TOKEN = 'Yh3uR2p6Q9vM7tC1nX8aL4eS5kJ0wB2fG6zH9dP3';

console.log(`Connecting to ${TARGET}...`);
const ws = new WebSocket(TARGET + `?token=${TOKEN}`);

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

ws.onopen = () => {
  console.log('WS Open');
};

ws.onmessage = (event) => {
  const text = event.data.toString();
  console.log('< RECV:', text);
  const data = JSON.parse(text);

  if (data.event === 'connect.challenge') {
    const nonce = data.payload.nonce;
    console.log('> Sending connect with nonce:', nonce);
    
    const msg = {
      type: 'req',
      method: 'connect',
      id: generateUUID(),
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        client: { id: 'test-bot', version: '1.0.0' },
        caps: ['chat', 'sessions', 'models', 'agents'],
        role: 'operator',
        scopes: ['operator.read', 'operator.write', 'operator.admin'],
        auth: { token: TOKEN },
        nonce: nonce
      }
    };
    ws.send(JSON.stringify(msg));
  }

  if (data.event === 'helloOk') {
    console.log('SUCCESS: Connected (helloOk)');
    sendChat();
  }
  
  // Handle older gateway response style or generic 'res'
  if (data.type === 'res' && data.result && (data.result.connected || data.result.type === 'hello-ok')) {
     console.log('SUCCESS: Connected (res)');
     sendChat();
  }
};

function sendChat() {
    // First list sessions to get one
    const id = generateUUID();
    console.log('> Listing sessions...');
    ws.send(JSON.stringify({
        type: 'req',
        method: 'sessions.list',
        id: id,
        params: { limit: 1 }
    }));
}

// Handle session list response to send chat
const originalOnMessage = ws.onmessage;
ws.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    if (data.result && data.result.sessions) {
        console.log('Session list received:', data.result.sessions.length);
        const session = data.result.sessions[0];
        if (session) {
            console.log('> Sending chat to session:', session.key);
            ws.send(JSON.stringify({
                type: 'req',
                method: 'chat.send',
                id: generateUUID(),
                params: {
                    sessionKey: session.key,
                    message: "Hello from QA automated test"
                }
            }));
        } else {
             console.log('No sessions found to test chat.');
             process.exit(0);
        }
    }
    
    if (data.result && data.result.runId) {
        console.log('SUCCESS: Chat run started, RunID:', data.result.runId);
        // We can exit now, test passed
        setTimeout(() => process.exit(0), 1000);
    }
});

ws.onerror = (e) => console.error('WS Error:', e.message);
