import os
from playwright.sync_api import sync_playwright

URL = "http://localhost:5173/"
OUT = "D:/SteamUnlocked Launcher/kartverse/scripts/out"
os.makedirs(OUT, exist_ok=True)

logs = []

def hud(page):
    loc = page.locator(".hud")
    return loc.first.inner_text() if loc.count() else "<none>"

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
        page.wait_for_timeout(1200)
        page.get_by_text("Skip intro").click(timeout=8000)
        page.wait_for_timeout(1000)
        page.screenshot(path=f"{OUT}/10-menu.png")

        page.get_by_role("button", name="Quick Race").click(timeout=10000)
        page.wait_for_timeout(6000)
        page.screenshot(path=f"{OUT}/11-race-loaded.png")
        print("HUD at load:", hud(page))

        if page.get_by_text("GOT IT").count():
            page.get_by_text("GOT IT").click()
            print("dismissed controls guide")

        page.wait_for_timeout(1000)
        print("HUD after guide:", hud(page))

        page.keyboard.down("KeyW")
        page.wait_for_timeout(6000)
        page.screenshot(path=f"{OUT}/12-accelerating.png")
        print("HUD accelerating:", hud(page))

        page.keyboard.down("KeyA")
        page.wait_for_timeout(1200)
        page.keyboard.up("KeyA")
        page.keyboard.down("KeyD")
        page.wait_for_timeout(1200)
        page.keyboard.up("KeyD")
        page.wait_for_timeout(3000)
        page.screenshot(path=f"{OUT}/13-turning.png")
        print("HUD turning:", hud(page))

        page.keyboard.down("Space")
        page.wait_for_timeout(1800)
        page.keyboard.up("Space")
        page.keyboard.down("ShiftLeft")
        page.wait_for_timeout(1200)
        page.keyboard.up("ShiftLeft")
        page.screenshot(path=f"{OUT}/14-drift-boost.png")
        print("HUD drift/boost:", hud(page))

        page.keyboard.up("KeyW")
        page.keyboard.press("Escape")
        page.wait_for_timeout(800)
        page.screenshot(path=f"{OUT}/15-pause.png")
        print("Pause visible:", page.get_by_text("Resume").count() > 0)

        browser.close()

run()
print("--- CONSOLE ---")
for line in logs[-40:]:
    print(line)
