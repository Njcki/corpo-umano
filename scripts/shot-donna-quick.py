#!/usr/bin/env python3
import base64, json, os, socket, struct, subprocess, time, urllib.request
from urllib.parse import urlparse
PORT=9242
URL="http://127.0.0.1:5173/"
OUT="/workspace/corpo-umano/screenshots/donna-fixed.png"

def http_get(url):
    with urllib.request.urlopen(url, timeout=5) as r:
        return json.loads(r.read().decode())

def ws_connect(ws_url):
    u=urlparse(ws_url); key=base64.b64encode(os.urandom(16)).decode()
    s=socket.create_connection((u.hostname,u.port or 80), timeout=60); s.settimeout(240)
    path=u.path+(("?"+u.query) if u.query else "")
    s.sendall(f"GET {path} HTTP/1.1\r\nHost: {u.hostname}:{u.port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n".encode())
    data=b""
    while b"\r\n\r\n" not in data: data+=s.recv(4096)
    return s

def ws_send(sock, payload):
    data=payload.encode(); mask=os.urandom(4)
    masked=bytes(b^mask[i%4] for i,b in enumerate(data)); ln=len(data)
    hdr=bytes([0x81,0x80|ln])+mask if ln<126 else bytes([0x81,0x80|126])+struct.pack("!H",ln)+mask
    sock.sendall(hdr+masked)

def ws_recv(sock):
    def recvn(n):
        buf=b""
        while len(buf)<n:
            c=sock.recv(n-len(buf))
            if not c: raise RuntimeError("closed")
            buf+=c
        return buf
    hdr=recvn(2); opcode=hdr[0]&0x0F; ln=hdr[1]&0x7F
    if ln==126: ln=struct.unpack("!H",recvn(2))[0]
    elif ln==127: ln=struct.unpack("!Q",recvn(8))[0]
    if hdr[1]&0x80:
        mask=recvn(4); data=bytes(b^mask[i%4] for i,b in enumerate(recvn(ln)))
    else: data=recvn(ln)
    if opcode==0x8: return None
    if opcode!=0x1 and opcode!=0x0: return ws_recv(sock)
    return data.decode()

def cdp(sock, method, params=None, msg_id=1):
    msg={"id":msg_id,"method":method}
    if params: msg["params"]=params
    ws_send(sock, json.dumps(msg))
    while True:
        raw=ws_recv(sock)
        if raw is None: raise RuntimeError("closed")
        obj=json.loads(raw)
        if obj.get("id")==msg_id:
            if "error" in obj: raise RuntimeError(obj["error"])
            return obj.get("result",{})

subprocess.run(["pkill","-f",f"remote-debugging-port={PORT}"],check=False)
time.sleep(0.3)
udir="/tmp/corpo-chrome-donna2"
subprocess.run(["rm","-rf",udir],check=False)
chrome=subprocess.Popen(["google-chrome",f"--remote-debugging-port={PORT}","--headless=new","--disable-gpu","--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--ignore-gpu-blocklist","--window-size=1400,900","--hide-scrollbars","--no-first-run",f"--user-data-dir={udir}","about:blank"],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
    for _ in range(40):
        try: http_get(f"http://127.0.0.1:{PORT}/json/version"); break
        except Exception: time.sleep(0.2)
    page=next(p for p in http_get(f"http://127.0.0.1:{PORT}/json/list") if p.get("type")=="page")
    sock=ws_connect(page["webSocketDebuggerUrl"]); mid=1
    cdp(sock,"Page.enable",msg_id=mid); mid+=1
    cdp(sock,"Runtime.enable",msg_id=mid); mid+=1
    cdp(sock,"Emulation.setDeviceMetricsOverride",{"width":1400,"height":900,"deviceScaleFactor":1,"mobile":False},msg_id=mid); mid+=1
    cdp(sock,"Page.addScriptToEvaluateOnNewDocument",{"source":"localStorage.setItem('corpo-umano-species','uomo');localStorage.setItem('corpo-umano-sex','femmina');localStorage.setItem('corpo-umano-theme','dark');"},msg_id=mid); mid+=1
    cdp(sock,"Page.navigate",{"url":URL},msg_id=mid); mid+=1
    ready=False
    deadline=time.time()+360
    while time.time()<deadline:
        res=cdp(sock,"Runtime.evaluate",{"expression":"(()=>{const l=document.querySelector('#loader');const b=document.querySelector('#part-count-badge');const s=document.querySelector('#sex-femmina');return{loaderHidden:!!(l&&(l.hidden||l.classList.contains('fade'))),badge:b&&b.textContent,sex:s&&s.getAttribute('aria-pressed')};})()","returnByValue":True},msg_id=mid); mid+=1
        v=res.get("result",{}).get("value") or {}
        print(v, flush=True)
        if v.get("loaderHidden") and v.get("sex")=="true" and "parti" in (v.get("badge") or ""):
            time.sleep(5); ready=True; break
        if v.get("loaderHidden") and v.get("sex")!="true":
            cdp(sock,"Runtime.evaluate",{"expression":"document.querySelector('#sex-femmina')?.click();true","returnByValue":True},msg_id=mid); mid+=1
        time.sleep(2)
    print("ready", ready, flush=True)
    # hide remaining tegumentario (eyebrows etc) optional — already no male skin
    shot=cdp(sock,"Page.captureScreenshot",{"format":"png","fromSurface":True},msg_id=mid); mid+=1
    open(OUT,"wb").write(base64.b64decode(shot["data"]))
    print("wrote", OUT, os.path.getsize(OUT))
    sock.close()
finally:
    chrome.terminate()
    try: chrome.wait(timeout=5)
    except Exception: chrome.kill()
