#!/usr/bin/env python3
"""Screenshot Femmina with morphed HRA skin via existing box Chrome CDP (9224)."""
import base64, json, os, socket, struct, time, urllib.request
from urllib.parse import urlparse

PORT = 9224
URL = "http://127.0.0.1:5173/?t=skinmorphv4"
OUT = "/workspace/corpo-umano/screenshots/donna-skin-morph.png"

def http_get(url):
    with urllib.request.urlopen(url, timeout=10) as r:
        return json.loads(r.read().decode())

def http_put(url):
    req = urllib.request.Request(url, method="PUT")
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read().decode())

def ws_connect(ws_url):
    u = urlparse(ws_url)
    key = base64.b64encode(os.urandom(16)).decode()
    s = socket.create_connection((u.hostname, u.port or 80), timeout=60)
    s.settimeout(120)
    path = u.path + (("?" + u.query) if u.query else "")
    s.sendall(
        f"GET {path} HTTP/1.1\r\nHost: {u.hostname}:{u.port}\r\nUpgrade: websocket\r\n"
        f"Connection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n".encode()
    )
    data = b""
    while b"\r\n\r\n" not in data:
        data += s.recv(4096)
    return s

def ws_send(sock, payload, opcode=0x1):
    data = payload if isinstance(payload, bytes) else payload.encode()
    mask = os.urandom(4)
    masked = bytes(b ^ mask[i % 4] for i, b in enumerate(data))
    ln = len(data)
    if ln < 126:
        hdr = bytes([0x80 | opcode, 0x80 | ln]) + mask
    elif ln < 65536:
        hdr = bytes([0x80 | opcode, 0x80 | 126]) + struct.pack("!H", ln) + mask
    else:
        hdr = bytes([0x80 | opcode, 0x80 | 127]) + struct.pack("!Q", ln) + mask
    sock.sendall(hdr + masked)

def ws_recv(sock):
    def recvn(n):
        buf = b""
        while len(buf) < n:
            c = sock.recv(n - len(buf))
            if not c:
                raise RuntimeError("closed")
            buf += c
        return buf
    hdr = recvn(2)
    opcode = hdr[0] & 0x0F
    ln = hdr[1] & 0x7F
    if ln == 126:
        ln = struct.unpack("!H", recvn(2))[0]
    elif ln == 127:
        ln = struct.unpack("!Q", recvn(8))[0]
    if hdr[1] & 0x80:
        mask = recvn(4)
        data = bytes(b ^ mask[i % 4] for i, b in enumerate(recvn(ln)))
    else:
        data = recvn(ln)
    if opcode == 0x8:
        return None
    if opcode == 0x9:
        ws_send(sock, data, opcode=0xA)
        return ws_recv(sock)
    if opcode != 0x1 and opcode != 0x0:
        return ws_recv(sock)
    return data.decode()

def cdp(sock, method, params=None, msg_id=1):
    msg = {"id": msg_id, "method": method}
    if params:
        msg["params"] = params
    ws_send(sock, json.dumps(msg))
    while True:
        raw = ws_recv(sock)
        if raw is None:
            raise RuntimeError("closed")
        obj = json.loads(raw)
        if obj.get("id") == msg_id:
            if "error" in obj:
                raise RuntimeError(obj["error"])
            return obj.get("result", {})

def main():
    # Create dedicated tab
    target = http_put(f"http://127.0.0.1:{PORT}/json/new?{urllib.request.quote(URL, safe='')}")
    ws_url = target.get("webSocketDebuggerUrl")
    if not ws_url:
        # fallback: list and pick about:blank
        pages = http_get(f"http://127.0.0.1:{PORT}/json/list")
        page = next((p for p in pages if p.get("type") == "page" and "5173" in (p.get("url") or "")), None)
        if not page:
            page = next(p for p in pages if p.get("type") == "page")
        ws_url = page["webSocketDebuggerUrl"]
        tid = page["id"]
    else:
        tid = target["id"]
    print("target", tid, ws_url, flush=True)
    sock = ws_connect(ws_url)
    mid = 1
    cdp(sock, "Page.enable", msg_id=mid); mid += 1
    cdp(sock, "Runtime.enable", msg_id=mid); mid += 1
    cdp(sock, "Network.enable", msg_id=mid); mid += 1
    cdp(sock, "Network.setCacheDisabled", {"cacheDisabled": True}, msg_id=mid); mid += 1
    cdp(sock, "Emulation.setDeviceMetricsOverride", {
        "width": 1400, "height": 900, "deviceScaleFactor": 1, "mobile": False
    }, msg_id=mid); mid += 1
    cdp(sock, "Page.addScriptToEvaluateOnNewDocument", {
        "source": "localStorage.setItem('corpo-umano-species','uomo');localStorage.setItem('corpo-umano-sex','femmina');localStorage.setItem('corpo-umano-theme','dark');"
    }, msg_id=mid); mid += 1
    cdp(sock, "Page.navigate", {"url": URL}, msg_id=mid); mid += 1
    time.sleep(4)
    ready = False
    deadline = time.time() + 300
    while time.time() < deadline:
        res = cdp(sock, "Runtime.evaluate", {
            "expression": "(()=>{const l=document.querySelector('#loader');const b=document.querySelector('#part-count-badge');const s=document.querySelector('#sex-femmina');const msg=document.querySelector('#loader-msg');return{loaderHidden:!!(l&&(l.hidden||l.classList.contains('fade'))),badge:b&&b.textContent,sex:s&&s.getAttribute('aria-pressed'),msg:msg&&msg.textContent};})()",
            "returnByValue": True,
        }, msg_id=mid); mid += 1
        v = res.get("result", {}).get("value") or {}
        print(v, flush=True)
        if v.get("loaderHidden") and v.get("sex") == "true" and "parti" in (v.get("badge") or ""):
            time.sleep(5)
            ready = True
            break
        if v.get("loaderHidden") and v.get("sex") != "true":
            cdp(sock, "Runtime.evaluate", {
                "expression": "document.querySelector('#sex-femmina')?.click();true",
                "returnByValue": True,
            }, msg_id=mid); mid += 1
        time.sleep(2)
    print("ready", ready, flush=True)
    shot = cdp(sock, "Page.captureScreenshot", {"format": "png", "fromSurface": True}, msg_id=mid); mid += 1
    open(OUT, "wb").write(base64.b64decode(shot["data"]))
    print("wrote", OUT, os.path.getsize(OUT), flush=True)
    # close tab
    try:
        urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json/close/{tid}", timeout=5).read()
    except Exception as e:
        print("close tab", e)
    sock.close()

if __name__ == "__main__":
    main()
