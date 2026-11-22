import json
import os
from playwright.sync_api import sync_playwright

URL = "http://localhost:5173/"
OUT = "D:/SteamUnlocked Launcher/kartverse/scripts/out"
os.makedirs(OUT, exist_ok=True)
logs = []

def gp(page):
    return page.evaluate("() => (JSON.parse(localStorage.getItem('kartverse.save.v2')||'{}')).grandPrix")

def finished(page):
    return page.evaluate("() => window.__kartverse ? window.__kartverse.debugState().finished : false")

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True, args=[
            "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
            "--disable-gpu-sandbox", "--no-sandbox",
        ])
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.on("console", lambda m: logs.append(f"[{m.type}] {m.text}"))
        page.on("pageerror", lambda e: logs.append(f"[pageerror] {e}"))
        page.goto(URL, wait_until="domcontentloaded")
        page.wait_for_timeout(900)
        page.get_by_text("Skip intro").click(timeout=8000)
        page.wait_for_timeout(600)
        page.locator(".menu-nav-item").nth(0).click(force=True)
        page.wait_for_timeout(1200)
        page.get_by_role("button", name="Grand Prix", exact=False).first.click(force=True)
        page.wait_for_timeout(400)
        page.get_by_role("button", name="Start Race", exact=False).first.click(force=True)

        for round_i in range(4):
            page.wait_for_timeout(6000)
            if page.get_by_text("GOT IT").count():
                page.get_by_text("GOT IT").click()
            page.wait_for_timeout(600)
            for _ in range(24):
                page.evaluate("() => window.__kartverse.debugAutopilot(1200)")
                if finished(page):
                    break
            page.wait_for_timeout(1200)
            g = gp(page)
            print(f"round {round_i + 1} done -> round={g['round']} finished={g['finished']} top={g['standings'][0]['name']}:{g['standings'][0]['points']}")
            page.screenshot(path=f"{OUT}/90-gp-r{round_i + 1}.png")
            btns = [b.inner_text() for b in page.locator(".modal-actions button").all()]
            print("  buttons:", btns)
            if g["finished"]:
                break
            page.get_by_role("button", name="Next Round", exact=False).first.click(force=True)

        page.wait_for_timeout(1500)
        page.screenshot(path=f"{OUT}/91-gp-final.png")
        print("final gp:", json.dumps(gp(page))[:200])

        # Championship button -> career
        page.get_by_role("button", name="Championship", exact=False).first.click(force=True)
        page.wait_for_timeout(1800)
        print("career visible:", page.get_by_text("CAREER", exact=False).count() > 0 or page.get_by_text("Career", exact=False).count() > 0)
        page.screenshot(path=f"{OUT}/92-career-after-gp.png")

        browser.close()

run()
print("--- CONSOLE ---")
for line in logs[-20:]:
    print(line)
