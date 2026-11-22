import json, os
from playwright.sync_api import sync_playwright

URL = "http://localhost:5173/"
OUT = "D:/SteamUnlocked Launcher/kartverse/scripts/out"
os.makedirs(OUT, exist_ok=True)
logs = []

def hud(pg):
    loc = pg.locator(".hud")
    return loc.first.inner_text().replace("\n", " | ") if loc.count() else ""

def run():
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", headless=True, args=[
            "--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--no-sandbox"])
        pg = b.new_page(viewport={"width":1440,"height":900})
        pg.on("pageerror", lambda e: logs.append(f"[pageerror] {e}"))
        pg.goto(URL, wait_until="domcontentloaded")
        pg.wait_for_timeout(900)
        pg.get_by_text("Skip intro").click(timeout=8000)
        pg.wait_for_timeout(700)
        print("save present at boot:", pg.evaluate("() => !!localStorage.getItem('kartverse.save.v2')"))

        # Settings -> Gameplay -> mph
        pg.locator(".menu-nav-item").nth(5).click(force=True)
        pg.wait_for_timeout(1500)
        pg.get_by_text("Gameplay", exact=True).first.click(force=True)
        pg.wait_for_timeout(900)
        page_shot = f"{OUT}/B1-settings-gameplay.png"
        pg.screenshot(path=page_shot)
        mph = pg.get_by_role("button", name="mph", exact=True)
        print("mph buttons:", mph.count())
        if mph.count():
            mph.first.click(force=True)
            pg.wait_for_timeout(800)
        print("units:", pg.evaluate("() => JSON.parse(localStorage.getItem('kartverse.save.v2')).settings.units"))

        # Race and confirm mph in HUD
        pg.locator(".page-header button").first.click(force=True)
        pg.wait_for_timeout(900)
        pg.locator(".menu-nav-item").nth(0).click(force=True)
        pg.wait_for_timeout(1200)
        pg.get_by_role("button", name="Quick Race", exact=False).first.click(force=True)
        pg.wait_for_timeout(400)
        pg.get_by_role("button", name="Start Race", exact=False).first.click(force=True)
        pg.wait_for_timeout(6000)
        if pg.get_by_text("GOT IT").count():
            pg.get_by_text("GOT IT").click()
        pg.wait_for_timeout(600)
        pg.evaluate("() => window.__kartverse.debugAutopilot(1200)")
        pg.wait_for_timeout(400)
        print("hud (mph):", hud(pg)[-90:])
        pg.screenshot(path=f"{OUT}/B2-hud-mph.png")

        # Toggle back to km/h mid-race
        pg.keyboard.press("Escape")
        pg.wait_for_timeout(600)
        pg.get_by_role("button", name="Settings", exact=False).first.click(force=True)
        pg.wait_for_timeout(1400)
        pg.get_by_text("Gameplay", exact=True).first.click(force=True)
        pg.wait_for_timeout(800)
        kmh = pg.get_by_role("button", name="km/h", exact=True)
        if kmh.count():
            kmh.first.click(force=True)
            pg.wait_for_timeout(700)
        print("units now:", pg.evaluate("() => JSON.parse(localStorage.getItem('kartverse.save.v2')).settings.units"))
        pg.locator(".page-header button").first.click(force=True)
        pg.wait_for_timeout(1500)
        print("hud (kmh):", hud(pg)[-90:])
        pg.screenshot(path=f"{OUT}/B3-hud-kmh.png")

        b.close()

run()
print("--- CONSOLE ---")
for l in logs[-10:]:
    print(l)
