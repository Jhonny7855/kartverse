import os
from playwright.sync_api import sync_playwright

URL = "http://localhost:5173/"
OUT = "D:/SteamUnlocked Launcher/kartverse/scripts/out"
os.makedirs(OUT, exist_ok=True)

TRACKS = ["NEON CITY", "SUNSET COAST", "FOREST RUSH", "VOLCANO CIRCUIT", "SKYLINE GP", "DESERT STORM"]
SLUGS = ["neon", "coast", "forest", "volcano", "skyline", "desert"]

def run():
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", headless=True, args=[
            "--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--no-sandbox"])
        pg = b.new_page(viewport={"width":1280,"height":720})
        pg.on("pageerror", lambda e: print("[pageerror]", e))
        pg.goto(URL, wait_until="domcontentloaded")
        pg.wait_for_timeout(900)
        pg.get_by_text("Skip intro").click(timeout=8000)
        pg.wait_for_timeout(700)

        for name, slug in zip(TRACKS, SLUGS):
            pg.locator(".menu-nav-item").nth(2).click(force=True)
            pg.wait_for_timeout(1700)
            pg.get_by_text(name, exact=False).first.click(force=True)
            pg.wait_for_timeout(600)
            pg.get_by_role("button", name="RACE HERE", exact=False).first.click(force=True)
            pg.wait_for_timeout(6500)
            if pg.get_by_text("GOT IT").count():
                pg.get_by_text("GOT IT").click()
            pg.wait_for_timeout(2500)
            pg.keyboard.down("KeyW")
            pg.wait_for_timeout(2500)
            pg.screenshot(path=f"{OUT}/V-{slug}.png")
            pg.keyboard.up("KeyW")
            pg.keyboard.press("Escape")
            pg.wait_for_timeout(700)
            if pg.get_by_role("button", name="Quit to menu", exact=False).count():
                pg.get_by_role("button", name="Quit to menu", exact=False).first.click(force=True)
            pg.wait_for_timeout(1300)

        b.close()

run()
