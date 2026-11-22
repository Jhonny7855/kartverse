import json, os
from playwright.sync_api import sync_playwright

URL = "http://localhost:5173/"
OUT = "D:/SteamUnlocked Launcher/kartverse/scripts/out"
os.makedirs(OUT, exist_ok=True)
logs = []

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
        pg.locator(".menu-nav-item").nth(0).click(force=True)
        pg.wait_for_timeout(1200)
        pg.get_by_role("button", name="Quick Race", exact=False).first.click(force=True)
        pg.wait_for_timeout(400)
        pg.get_by_role("button", name="Start Race", exact=False).first.click(force=True)
        pg.wait_for_timeout(6500)
        if pg.get_by_text("GOT IT").count():
            pg.get_by_text("GOT IT").click()
        pg.wait_for_timeout(1000)

        pg.screenshot(path=f"{OUT}/D0-start.png")
        pg.keyboard.down("KeyW")
        pg.wait_for_timeout(2500)
        pg.screenshot(path=f"{OUT}/D1-accel.png")
        pg.wait_for_timeout(2000)
        pg.screenshot(path=f"{OUT}/D2-speed.png")
        pg.keyboard.down("KeyA")
        pg.wait_for_timeout(900)
        pg.screenshot(path=f"{OUT}/D3-turn.png")
        pg.keyboard.up("KeyA")
        pg.keyboard.down("Space")
        pg.wait_for_timeout(1400)
        pg.screenshot(path=f"{OUT}/D4-drift.png")
        pg.keyboard.up("Space")
        pg.keyboard.up("KeyW")
        pg.wait_for_timeout(600)
        pg.screenshot(path=f"{OUT}/D5-coast.png")

        st = pg.evaluate("""() => {
          const e = window.__kartverse, p = e.race.player, cam = e.camera;
          return { speed: p.speed, camDist: Math.hypot(cam.position.x-p.position.x, cam.position.z-p.position.z),
                   camY: cam.position.y, lap: e.race.playerLap(), drift: p.driftCharge, boosting: p.boosting };
        }""")
        print("state:", json.dumps(st))
        b.close()

run()
print("--- CONSOLE ---")
for l in logs[-8:]:
    print(l)
