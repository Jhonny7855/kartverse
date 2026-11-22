import os
from playwright.sync_api import sync_playwright

URL = "http://localhost:5173/"
OUT = "D:/SteamUnlocked Launcher/kartverse/scripts/out"
os.makedirs(OUT, exist_ok=True)
logs = []

NAV = ["mode", "garage", "tracks", "career", "leaderboard", "settings"]

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True, args=[
            "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
            "--disable-gpu-sandbox", "--no-sandbox",
        ])
        for i, name in enumerate(NAV):
            page = browser.new_page(viewport={"width": 1280, "height": 800})
            page.on("console", lambda m: logs.append(f"[{m.type}] {m.text}"))
            page.on("pageerror", lambda e: logs.append(f"[pageerror] {e}"))
            page.goto(URL, wait_until="domcontentloaded")
            page.wait_for_timeout(900)
            page.get_by_text("Skip intro").click(timeout=8000)
            page.wait_for_timeout(600)
            items = page.locator(".menu-nav-item")
            print(f"{name}: nav count {items.count()}")
            items.nth(i).click(force=True)
            page.wait_for_timeout(2400)
            text = page.locator("body").inner_text()
            print(f"  -> {len(text)} chars")
            page.screenshot(path=f"{OUT}/61-{name}.png")
            page.close()
        browser.close()

run()
print("--- CONSOLE ---")
for line in logs[-12:]:
    print(line)
