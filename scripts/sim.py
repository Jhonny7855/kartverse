import json
import os
from playwright.sync_api import sync_playwright

URL = "http://localhost:5173/"
OUT = "D:/SteamUnlocked Launcher/kartverse/scripts/out"
os.makedirs(OUT, exist_ok=True)

logs = []

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True, args=[
            "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
            "--disable-gpu-sandbox", "--no-sandbox",
        ])
        page = browser.new_page(viewport={"width": 1280, "height": 720})
        page.on("console", lambda m: logs.append(f"[{m.type}] {m.text}"))
        page.on("pageerror", lambda e: logs.append(f"[pageerror] {e}"))
        page.goto(URL, wait_until="domcontentloaded")
        page.wait_for_timeout(1200)
        page.get_by_text("Skip intro").click(timeout=8000)
        page.wait_for_timeout(800)
        page.get_by_role("button", name="Quick Race").click(timeout=10000)
        page.wait_for_timeout(5000)
        if page.get_by_text("GOT IT").count():
            page.get_by_text("GOT IT").click()
        page.wait_for_timeout(1500)

        state = page.evaluate("() => window.__kartverse ? window.__kartverse.debugState() : null")
        print("state after load:", json.dumps(state))

        for i in range(22):
            page.evaluate("() => window.__kartverse && window.__kartverse.debugAutopilot(1200)")
            st = page.evaluate("() => window.__kartverse ? window.__kartverse.debugState() : null")
            print(f"batch {i}:", json.dumps(st))
            if st and st.get("finished"):
                break

        page.wait_for_timeout(1200)
        page.screenshot(path=f"{OUT}/20-after-sim.png")
        print("results visible:", page.get_by_text("Race again").count() > 0)
        if page.get_by_text("Race again").count():
            page.get_by_text("Race again").click()
            page.wait_for_timeout(4000)
            print("restart state:", json.dumps(page.evaluate("() => window.__kartverse ? window.__kartverse.debugState() : null")))

        browser.close()

run()
print("--- CONSOLE ---")
for line in logs[-30:]:
    print(line)
