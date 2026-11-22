import json
import os
from playwright.sync_api import sync_playwright

URL = "http://localhost:5173/"
OUT = "D:/SteamUnlocked Launcher/kartverse/scripts/out"
os.makedirs(OUT, exist_ok=True)
logs = []

def save(page):
    return page.evaluate("() => JSON.parse(localStorage.getItem('kartverse.save.v2') || '{}')")

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

        # Race Setup -> Time Trial
        page.locator(".menu-nav-item").nth(0).click(force=True)
        page.wait_for_timeout(1500)
        page.get_by_role("button", name="Time Trial", exact=False).first.click(force=True)
        page.wait_for_timeout(600)
        page.get_by_role("button", name="Start Race", exact=False).first.click(force=True)
        page.wait_for_timeout(6500)
        if page.get_by_text("GOT IT").count():
            page.get_by_text("GOT IT").click()
        page.wait_for_timeout(800)
        print("tt start:", json.dumps(page.evaluate("() => window.__kartverse.debugState()")))

        for i in range(30):
            page.evaluate("() => window.__kartverse.debugAutopilot(1200)")
            st = page.evaluate("() => window.__kartverse.debugState()")
            if st.get("finished"):
                print("finished at batch", i, json.dumps(st))
                break

        page.wait_for_timeout(1500)
        page.screenshot(path=f"{OUT}/70-tt-results.png")
        s = save(page)
        print("records:", json.dumps(s.get("records")))
        ghosts = s.get("ghosts") or {}
        for tid, g in ghosts.items():
            print(f"ghost {tid}: time={g.get('time')} frames={len(g.get('frames') or [])}")

        # Back to menu, then check records screen shows the lap
        page.get_by_role("button", name="Menu", exact=False).first.click(force=True)
        page.wait_for_timeout(1500)
        page.locator(".menu-nav-item").nth(4).click(force=True)
        page.wait_for_timeout(1600)
        page.screenshot(path=f"{OUT}/71-records-filled.png")
        print("records screen text:", page.locator(".leaderboard, .page-body").first.inner_text()[:300].replace("\n", " | "))

        # Re-run time trial to verify ghost loads
        page.locator(".page-header button").first.click(force=True)
        page.wait_for_timeout(1000)
        page.locator(".menu-nav-item").nth(0).click(force=True)
        page.wait_for_timeout(1200)
        page.get_by_role("button", name="Time Trial", exact=False).first.click(force=True)
        page.wait_for_timeout(500)
        page.get_by_role("button", name="Start Race", exact=False).first.click(force=True)
        page.wait_for_timeout(6500)
        if page.get_by_text("GOT IT").count():
            page.get_by_text("GOT IT").click()
        page.evaluate("() => window.__kartverse.debugAutopilot(2400)")
        page.wait_for_timeout(600)
        page.screenshot(path=f"{OUT}/72-tt-ghost.png")
        print("ghost run state:", json.dumps(page.evaluate("() => window.__kartverse.debugState()")))

        browser.close()

run()
print("--- CONSOLE ---")
for line in logs[-20:]:
    print(line)
