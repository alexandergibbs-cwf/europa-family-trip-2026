"""Build the private calendar feed from the app's own day logic.
Run after any change to STAYS / MOVES / EVENTS:  python3 tools/make_ics.py
Writes public/cal/<token>.ics (the token is fixed so the subscription link never changes)."""
import http.server, threading, functools, pathlib, sys
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent / "public"
TOKEN = "ed3056321e507c456ba8"
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT)))
threading.Thread(target=srv.serve_forever, daemon=True).start()
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page()
    pg.add_init_script("try{localStorage.setItem('tour','1')}catch(e){}")
    pg.route("**/api.open-meteo.com/**", lambda r: r.abort())
    pg.goto(f"http://127.0.0.1:{srv.server_address[1]}/index.html"); pg.wait_for_timeout(800)
    ics = pg.evaluate("window.__tripICS()")
    b.close()
srv.shutdown()
out = ROOT / "cal" / f"{TOKEN}.ics"; out.parent.mkdir(exist_ok=True)
out.write_bytes(ics.encode("utf-8"))
print(out, ics.count("BEGIN:VEVENT"), "events")
