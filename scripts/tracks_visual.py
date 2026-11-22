import os
from playwright.sync_api import sync_playwright

URL = "http://localhost:5173/"
OUT = "D:/SteamUnlocked Launcher/kartverse/scripts/out"
os.makedirs(OUT, exist_ok=True)
logs = []

TRACKS = ["NEON CITY", "SUNSET COAST", "FOREST RUSH", "VOLCANO CIRCUIT", "SKYLINE GP", "DESERT STORM"]
SLUGS = ["neon", "coast", "forest", "volcano", "skyline", "desert"]

def run():
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", headless=True, args=[
            "--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--no-sandbox"])
        pg = b.new_page(viewport={"width":1280,"height":720})
        pg.on("pageerror", lambda e: logs.append(f"[pageerror] {e}"))
        pg.goto(URL, wait_until="domcontentloaded")
        pg.wait_for_timeout(900)
        pg.get_by_text("Skip intro").click(timeout=8000)
        pg.wait_for_timeout(700)

        for name, slug in zip(TRACKS, SLUGS):
            pg.locator(".menu-nav-item").nth(2).click(force=True)  # tracks
            pg.wait_for_timeout(1800)
            try:
                pg.get_by_text(name, exact=False).first.click(force=True, timeout=5000)
                pg.wait_for_timeout(700)
            except Exception as e:
                print(f"{name}: select fail {e}")
            pg.get_by_role("button", name="RACE HERE", exact=False).first.click(force=True)
            pg.wait_for_timeout(6500)
            if pg.get_by_text("GOT IT").count():
                pg.get_by_text("GOT IT").click()
            pg.wait_for_timeout(600)
            pg.evaluate("() => window.__kartverse && window.__kartverse.debugAutopilot(1500)")
            pg.wait_for_timeout(700)
            pg.screenshot(path=f"{OUT}/T-{slug}.png")
            st = pg.evaluate("() => window.__kartverse ? window.__kartverse.debugState() : null")
            print(f"{slug}: {st}")
            pg.keyboard.press("Escape")
            pg.wait_for_timeout(700)
            if pg.get_by_role("button", name="Quit to menu", exact=False).count():
                pg.get_by_role("button", name="Quit to menu", exact=False).first.click(force=True)
            pg.wait_for_timeout(1400)

        b.close()

run()
print("--- CONSOLE ---")
for l in logs[-10:]:
    print(l)
