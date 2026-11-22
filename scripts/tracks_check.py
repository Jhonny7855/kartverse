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
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.on("console", lambda m: logs.append(f"[{m.type}] {m.text}"))
        page.on("pageerror", lambda e: logs.append(f"[pageerror] {e}"))
        page.goto(URL, wait_until="domcontentloaded")
        page.wait_for_timeout(1000)
        page.get_by_text("Skip intro").click(timeout=8000)
        page.wait_for_timeout(700)

        page.get_by_role("button", name="TRACKS", exact=False).first.click()
        page.wait_for_timeout(1800)
        page.screenshot(path=f"{OUT}/40-tracks-all.png")

        names = ["NEON CITY", "SUNSET COAST", "FOREST RUSH", "VOLCANO CIRCUIT", "SKYLINE GP", "DESERT STORM"]
        for i, n in enumerate(names):
            try:
                page.get_by_text(n, exact=True).first.click(timeout=4000)
                page.wait_for_timeout(700)
                page.screenshot(path=f"{OUT}/41-track-{i}.png", clip={"x": 40, "y": 370, "width": 1360, "height": 240})
            except Exception as e:
                print(f"{n}: {e}")

        # Race on the newly shaped track.
        page.get_by_role("button", name="RACE HERE", exact=False).first.click()
        page.wait_for_timeout(6000)
        if page.get_by_text("GOT IT").count():
            page.get_by_text("GOT IT").click()
        page.wait_for_timeout(1000)
        print("start:", json.dumps(page.evaluate("() => window.__kartverse ? window.__kartverse.debugState() : null")))

        for i in range(22):
            page.evaluate("() => window.__kartverse && window.__kartverse.debugAutopilot(1200)")
            st = page.evaluate("() => window.__kartverse ? window.__kartverse.debugState() : null")
            if i % 4 == 0 or st.get("finished"):
                print(f"b{i}:", json.dumps(st))
            if st.get("finished"):
                break

        page.wait_for_timeout(1200)
        page.screenshot(path=f"{OUT}/42-results.png")
        print("results:", page.get_by_text("Race again").count() > 0)

        browser.close()

run()
print("--- CONSOLE ---")
for line in logs[-20:]:
    print(line)
