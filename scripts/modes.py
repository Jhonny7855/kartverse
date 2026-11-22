import json
import os
from playwright.sync_api import sync_playwright

URL = "http://localhost:5173/"
OUT = "D:/SteamUnlocked Launcher/kartverse/scripts/out"
os.makedirs(OUT, exist_ok=True)
logs = []

def state(page):
    return page.evaluate("() => window.__kartverse ? window.__kartverse.debugState() : null")

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

        # ---- Grand Prix flow ----
        page.locator(".menu-nav-item").nth(0).click(force=True)
        page.wait_for_timeout(1400)
        page.get_by_role("button", name="Grand Prix", exact=False).first.click(force=True)
        page.wait_for_timeout(500)
        page.get_by_role("button", name="Start Race", exact=False).first.click(force=True)
        page.wait_for_timeout(6000)
        if page.get_by_text("GOT IT").count():
            page.get_by_text("GOT IT").click()
        page.wait_for_timeout(900)
        print("gp round1:", json.dumps(state(page)))
        page.screenshot(path=f"{OUT}/80-gp-race.png")

        for i in range(20):
            page.evaluate("() => window.__kartverse.debugAutopilot(1200)")
            if state(page).get("finished"):
                break
        page.wait_for_timeout(1400)
        page.screenshot(path=f"{OUT}/81-gp-results.png")
        btns = [b.inner_text() for b in page.locator(".modal-actions button").all()]
        print("gp results buttons:", btns)

        # advance to next round
        page.get_by_role("button", name="Next Round", exact=False).first.click(force=True)
        page.wait_for_timeout(6500)
        if page.get_by_text("GOT IT").count():
            page.get_by_text("GOT IT").click()
        page.wait_for_timeout(800)
        print("gp round2:", json.dumps(state(page)))
        page.screenshot(path=f"{OUT}/82-gp-round2.png")

        # ---- pause menu ----
        page.keyboard.press("Escape")
        page.wait_for_timeout(700)
        page.screenshot(path=f"{OUT}/83-pause.png")
        print("pause has Resume:", page.get_by_role("button", name="Resume", exact=False).count() > 0)
        page.get_by_role("button", name="Resume", exact=False).first.click(force=True)
        page.wait_for_timeout(500)

        # ---- quit to menu ----
        page.keyboard.press("Escape")
        page.wait_for_timeout(600)
        page.get_by_role("button", name="Quit to menu", exact=False).first.click(force=True)
        page.wait_for_timeout(1500)
        print("back at menu:", page.locator(".menu-nav-item").count())

        # ---- elimination ----
        page.locator(".menu-nav-item").nth(0).click(force=True)
        page.wait_for_timeout(1200)
        page.get_by_role("button", name="Elimination", exact=False).first.click(force=True)
        page.wait_for_timeout(400)
        page.get_by_role("button", name="Start Race", exact=False).first.click(force=True)
        page.wait_for_timeout(6000)
        if page.get_by_text("GOT IT").count():
            page.get_by_text("GOT IT").click()
        page.wait_for_timeout(600)
        print("elim start:", json.dumps(state(page)))
        page.evaluate("() => window.__kartverse.debugAutopilot(3600)")
        page.wait_for_timeout(400)
        page.screenshot(path=f"{OUT}/84-elim.png")
        print("elim mid:", json.dumps(state(page)))

        browser.close()

run()
print("--- CONSOLE ---")
for line in logs[-25:]:
    print(line)
