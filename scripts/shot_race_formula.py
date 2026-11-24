import json, os
from playwright.sync_api import sync_playwright

URL = "http://localhost:5173/"
OUT = "D:/SteamUnlocked Launcher/kartverse/scripts/out"
os.makedirs(OUT, exist_ok=True)
logs = []


def run():
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", headless=True, args=[
            "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"])
        pg = b.new_page(viewport={"width": 1100, "height": 700})
        pg.on("pageerror", lambda e: logs.append(f"[pageerror] {e}"))
        pg.goto(URL, wait_until="domcontentloaded")
        pg.wait_for_timeout(900)
        try:
            pg.get_by_text("Skip intro").click(timeout=6000)
        except Exception:
            pass
        pg.wait_for_timeout(700)
        pg.locator(".menu-nav-item").nth(0).click(force=True)
        pg.wait_for_timeout(1200)
        pg.get_by_role("button", name="Quick Race", exact=False).first.click(force=True)
        pg.wait_for_timeout(400)
        pg.get_by_role("button", name="Start Race", exact=False).first.click(force=True)
        pg.wait_for_timeout(6000)
        if pg.get_by_text("GOT IT").count():
            pg.get_by_text("GOT IT").click()
        pg.wait_for_function("() => window.__kartverse && window.__kartverse.race && window.__kartverse.race.state === 'racing'", timeout=30000)

        pg.evaluate("() => window.__kartverse.debugAutopilot(900)")
        pg.evaluate("""() => {
          const e = window.__kartverse;
          e.cameraCtl.snap(e.race.player);
          document.querySelectorAll('.hud').forEach(n => n.style.display = 'none');
        }""")
        pg.wait_for_timeout(1500)
        pg.screenshot(path=f"{OUT}/rc_chase.png")

        pg.evaluate("() => { window.__kartverse.cameraCtl.mode = 'close'; }")
        pg.wait_for_timeout(1600)
        pg.screenshot(path=f"{OUT}/rc_close.png")

        pg.evaluate("() => { window.__kartverse.cameraCtl.mode = 'wide'; }")
        pg.wait_for_timeout(1800)
        pg.screenshot(path=f"{OUT}/rc_wide.png")

        st = pg.evaluate("""() => {
          const e = window.__kartverse, p = e.race.player;
          return { speed: +p.speed.toFixed(1), lap: p.lap, state: e.race.state,
                   camDist: +Math.hypot(e.camera.position.x-p.position.x, e.camera.position.z-p.position.z).toFixed(2) };
        }""")
        print("state:", json.dumps(st))
        b.close()


run()
print("--- CONSOLE ---")
for l in logs[-10:]:
    print(l)
