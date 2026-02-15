import asyncio
import json
import uuid
import sys
import websockets

TARGET = "ws://192.168.1.19:11112?token=Yh3uR2p6Q9vM7tC1nX8aL4eS5kJ0wB2fG6zH9dP3"

async def test():
    print(f"Connecting to {TARGET}...")
    try:
        async with websockets.connect(TARGET) as ws:
            print("WS Open")
            
            # Wait for messages
            while True:
                msg = await ws.recv()
                print(f"< RECV: {msg[:100]}...")
                data = json.loads(msg)
                
                if data.get("event") == "connect.challenge":
                    nonce = data["payload"]["nonce"]
                    print(f"> Sending connect with nonce: {nonce}")
                    req = {
                        "type": "req",
                        "method": "connect",
                        "id": str(uuid.uuid4()),
                        "params": {
                            "minProtocol": 3,
                            "maxProtocol": 3,
                            "client": {"id": "test-bot-py", "version": "1.0.0"},
                            "caps": ["chat"],
                            "role": "operator",
                            "auth": {"token": "Yh3uR2p6Q9vM7tC1nX8aL4eS5kJ0wB2fG6zH9dP3"},
                            "nonce": nonce
                        }
                    }
                    await ws.send(json.dumps(req))
                    
                elif data.get("event") == "helloOk":
                    print("SUCCESS: Connected (helloOk)")
                    # Trigger chat test
                    await list_sessions(ws)

                elif data.get("type") == "res" and data.get("result", {}).get("connected"):
                    print("SUCCESS: Connected (res)")
                    await list_sessions(ws)
                    
                elif data.get("type") == "res" and "sessions" in data.get("result", {}):
                    sessions = data["result"]["sessions"]
                    if sessions:
                        print(f"> Found {len(sessions)} sessions. Sending chat to first one...")
                        await send_chat(ws, sessions[0]["key"])
                    else:
                        print("No sessions found.")
                        return

                elif data.get("type") == "res" and "runId" in data.get("result", {}):
                    print(f"SUCCESS: Chat run started. RunID: {data['result']['runId']}")
                    return

    except Exception as e:
        print(f"Error: {e}")

async def list_sessions(ws):
    print("> Listing sessions...")
    req = {
        "type": "req", 
        "method": "sessions.list", 
        "id": str(uuid.uuid4()), 
        "params": {"limit": 1}
    }
    await ws.send(json.dumps(req))

async def send_chat(ws, session_key):
    req = {
        "type": "req",
        "method": "chat.send",
        "id": str(uuid.uuid4()),
        "params": {
            "sessionKey": session_key,
            "message": "Hello from QA python test"
        }
    }
    await ws.send(json.dumps(req))

if __name__ == "__main__":
    asyncio.run(test())
