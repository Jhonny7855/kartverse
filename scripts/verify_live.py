import json
from playwright.sync_api import sync_playwright

URL = "https://jhonny7855.github.io/kartverse/"
ARGS = ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--no-sandbox"]

def run():
    logs = []
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", headless=True, args=ARGS)
        pg = b.new_page(viewport={"width":1280,"height":720})
        pg.on("console", lambda m: logs.append(f"[{m.type}] {m.text}"))
        pg.on("pageerror", lambda e: logs.append(f"[pageerror] {e}"))
        pg.on("requestfailed", lambda r: logs.append(f"[failed] {r.url} {r.failure}"))
        resp = pg.goto(URL, wait_until="domcontentloaded", timeout=60000)
        print("status:", resp.status)
        pg.wait_for_timeout(2500)

        skip = pg.get_by_text("Skip intro")
        print("skip intro present:", skip.count())
        if skip.count():
            # The boot sequence auto-advances, so the button can detach mid-click.
            try:
                skip.click(timeout=6000)
            except Exception as exc:
                print("skip click skipped:", type(exc).__name__)
        pg.wait_for_timeout(1200)
        print("nav items:", pg.locator(".menu-nav-item").count())
        pg.screenshot(path="scripts/out/live_menu.png")

        pg.locator(".menu-nav-item").nth(0).click(force=True)
        pg.wait_for_timeout(1400)
        pg.get_by_role("button", name="Quick Race", exact=False).first.click(force=True)
        pg.wait_for_timeout(400)
        pg.get_by_role("button", name="Start Race", exact=False).first.click(force=True)
        pg.wait_for_timeout(7000)
        if pg.get_by_text("GOT IT").count():
            pg.get_by_text("GOT IT").click()
        pg.wait_for_timeout(1500)

        st = pg.evaluate("() => window.__kartverse ? window.__kartverse.debugState() : null")
        print("live state:", json.dumps(st))
        pg.screenshot(path="scripts/out/live_race.png")
        b.close()

    print("--- CONSOLE ---")
    for line in logs[-15:]:
        print(line)

run()
