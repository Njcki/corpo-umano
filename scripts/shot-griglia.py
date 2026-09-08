#!/usr/bin/env python3
"""Launch headless Chrome, wait for body load, screenshot assembled + grid-aligned."""
import base64, json, os, socket, struct, subprocess, time, urllib.request
from urllib.parse import urlparse, quote

PORT = 9238
URL = "http://127.0.0.1:5173/"
OUT_A = "/workspace/corpo-umano/screenshots/corpo-umano-griglia.png"
OUT_B = "/workspace/corpo-umano/screenshots/corpo-umano-griglia-allineata.png"

def http_get(url):
    with urllib.request.urlopen(url, timeout=5) as r:
        return json.loads(r.read().decode())

def wait_http(url, tries=60):
    for _ in range(tries):
        try:
            with urllib.request.urlopen(url, timeout=2) as r:
                if r.status == 200:
                    return
        except Exception:
            time.sleep(0.5)
    raise RuntimeError(f"timeout waiting {url}")

def ws_connect(ws_url):
    u = urlparse(ws_url)
    host, port = u.hostname, u.port or 80
    path = u.path + (("?" + u.query) if u.query else "")
    key = base64.b64encode(os.urandom(16)).decode()
    s = socket.create_connection((host, port), timeout=120)
    s.settimeout(180)
    req = (
        f"GET {path} HTTP/1.1\r\nHost: {host}:{port}\r\nUpgrade: websocket\r\n"
        f"Connection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n"
    )
    s.sendall(req.encode())
    data = b""
    while b"\r\n\r\n" not in data:
        data += s.recv(4096)
    if b"101" not in data.split(b"\r\n", 1)[0]:
        raise RuntimeError("WS upgrade failed: " + data[:200].decode(errors="replace"))
    return s

def ws_send(sock, payload: str):
    data = payload.encode()
    mask = os.urandom(4)
    masked = bytes(b ^ mask[i % 4] for i, b in enumerate(data))
    ln = len(data)
    if ln < 126:
        hdr = bytes([0x81, 0x80 | ln]) + mask
    elif ln < 65536:
        hdr = bytes([0x81, 0x80 | 126]) + struct.pack("!H", ln) + mask
    else:
        hdr = bytes([0x81, 0x80 | 127]) + struct.pack("!Q", ln) + mask
    sock.sendall(hdr + masked)

def ws_recv(sock):
    def recvn(n):
        buf = b""
        while len(buf) < n:
            chunk = sock.recv(n - len(buf))
            if not chunk:
                raise RuntimeError("socket closed")
            buf += chunk
        return buf
    hdr = recvn(2)
    b1, b2 = hdr[0], hdr[1]
    opcode = b1 & 0x0F
    masked = (b2 & 0x80) != 0
    ln = b2 & 0x7F
    if ln == 126:
        ln = struct.unpack("!H", recvn(2))[0]
    elif ln == 127:
        ln = struct.unpack("!Q", recvn(8))[0]
    if masked:
        mask = recvn(4)
        data = bytes(b ^ mask[i % 4] for i, b in enumerate(recvn(ln)))
    else:
        data = recvn(ln)
    if opcode == 0x8:
        return None
    if opcode == 0x9:  # ping
        # pong
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

def kill_old():
    subprocess.run(["pkill", "-f", f"--remote-debugging-port={PORT}"], check=False)
    time.sleep(0.5)

def main():
    wait_http(URL)
    kill_old()
    udir = "/tmp/corpo-chrome-griglia"
    subprocess.run(["rm", "-rf", udir], check=False)
    chrome = subprocess.Popen(
        [
            "google-chrome",
            f"--remote-debugging-port={PORT}",
            "--headless=new",
            "--disable-gpu",
            "--use-gl=angle",
            "--use-angle=swiftshader",
            "--enable-webgl",
            "--ignore-gpu-blocklist",
            "--window-size=1400,900",
            "--hide-scrollbars",
            "--no-first-run",
            "--no-default-browser-check",
            f"--user-data-dir={udir}",
            "about:blank",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        for _ in range(50):
            try:
                http_get(f"http://127.0.0.1:{PORT}/json/version")
                break
            except Exception:
                time.sleep(0.2)
        else:
            raise RuntimeError("chrome CDP not up")

        pages = http_get(f"http://127.0.0.1:{PORT}/json/list")
        page = next((p for p in pages if p.get("type") == "page"), None)
        if not page:
            raise RuntimeError("no page")
        print("page0", page.get("url"), page.get("id"))
        sock = ws_connect(page["webSocketDebuggerUrl"])
        mid = 1
        cdp(sock, "Page.enable", msg_id=mid); mid += 1
        cdp(sock, "Runtime.enable", msg_id=mid); mid += 1
        cdp(sock, "Emulation.setDeviceMetricsOverride", {
            "width": 1400, "height": 900, "deviceScaleFactor": 1, "mobile": False
        }, msg_id=mid); mid += 1
        nav = cdp(sock, "Page.navigate", {"url": URL}, msg_id=mid); mid += 1
        print("nav", nav)
        time.sleep(2)

        deadline = time.time() + 300
        ready = False
        while time.time() < deadline:
            res = cdp(sock, "Runtime.evaluate", {
                "expression": "(() => { const l=document.querySelector('#loader'); const badge=document.querySelector('#part-count-badge'); const btn=document.querySelector('#btn-allinea'); const app=document.querySelector('.app'); return {hasApp: !!app, loaderHidden: !!(l && (l.hidden || l.classList.contains('fade'))), badge: badge && badge.textContent, hasBtn: !!btn, loaderExists: !!l}; })()",
                "returnByValue": True,
            }, msg_id=mid); mid += 1
            val = res.get("result", {}).get("value") or {}
            print("status", val, flush=True)
            if val.get("hasBtn") and val.get("loaderHidden") and "parti" in (val.get("badge") or ""):
                time.sleep(5)
                ready = True
                break
            time.sleep(2)
        if not ready:
            print("WARNING: timed out waiting for load")

        shot = cdp(sock, "Page.captureScreenshot", {"format": "png", "fromSurface": True}, msg_id=mid); mid += 1
        open(OUT_A, "wb").write(base64.b64decode(shot["data"]))
        print("wrote", OUT_A, os.path.getsize(OUT_A))

        # Hide skin for clearer grid shot (optional UX: still full systems but denser skin hides structure)
        # Keep default; click align
        cdp(sock, "Runtime.evaluate", {
            "expression": "document.querySelector('#btn-allinea')?.click(); !!document.querySelector('#btn-allinea')",
            "returnByValue": True,
        }, msg_id=mid); mid += 1
        time.sleep(3.5)

        shot2 = cdp(sock, "Page.captureScreenshot", {"format": "png", "fromSurface": True}, msg_id=mid); mid += 1
        open(OUT_B, "wb").write(base64.b64decode(shot2["data"]))
        print("wrote", OUT_B, os.path.getsize(OUT_B))
        sock.close()
    finally:
        chrome.terminate()
        try:
            chrome.wait(timeout=5)
        except Exception:
            chrome.kill()

if __name__ == "__main__":
    main()
