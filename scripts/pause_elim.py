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
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.on("console", lambda m: logs.append(f"[{m.type}] {m.text}"))
        page.on("pageerror", lambda e: logs.append(f"[pageerror] {e}"))
        page.goto(URL, wait_until="domcontentloaded")
        page.wait_for_timeout(900)
        page.get_by_text("Skip intro").click(timeout=8000)
        page.wait_for_timeout(600)

        # Elimination: drive enough sim time to trigger eliminations
        page.locator(".menu-nav-item").nth(0).click(force=True)
        page.wait_for_timeout(1200)
        page.get_by_role("button", name="Elimination", exact=False).first.click(force=True)
        page.wait_for_timeout(400)
        page.get_by_role("button", name="Start Race", exact=False).first.click(force=True)
        page.wait_for_timeout(6000)
        if page.get_by_text("GOT IT").count():
            page.get_by_text("GOT IT").click()
        page.wait_for_timeout(600)
        for i in range(20):
            page.evaluate("() => window.__kartverse.debugAutopilot(1200)")
            st = state(page)
            print(f"elim t={st['elapsed']:.1f} pos={st['position']} state={st['state']}")
            if st["state"] == "finished":
                break
        page.wait_for_timeout(1200)
        page.screenshot(path=f"{OUT}/97-elim-end.png")
        print("results shown:", page.get_by_role("button", name="Race again", exact=False).count() > 0)

        # Pause test during actual racing
        page.get_by_role("button", name="Menu", exact=False).first.click(force=True)
        page.wait_for_timeout(1500)
        page.locator(".menu-nav-item").nth(0).click(force=True)
        page.wait_for_timeout(1200)
        page.get_by_role("button", name="Quick Race", exact=False).first.click(force=True)
        page.wait_for_timeout(400)
        page.get_by_role("button", name="Start Race", exact=False).first.click(force=True)
        page.wait_for_timeout(6000)
        if page.get_by_text("GOT IT").count():
            page.get_by_text("GOT IT").click()
        page.wait_for_timeout(600)
        page.evaluate("() => window.__kartverse.debugAutopilot(600)")
        page.wait_for_timeout(300)
        a = state(page)["elapsed"]
        page.keyboard.press("Escape")
        page.wait_for_timeout(700)
        b = state(page)["elapsed"]
        page.wait_for_timeout(1500)
        c = state(page)["elapsed"]
        print(f"pause: racing={a:.2f} atPause={b:.2f} after1.5s={c:.2f} frozen={b == c}")
        page.get_by_role("button", name="Resume", exact=False).first.click(force=True)
        page.wait_for_timeout(1800)
        d = state(page)["elapsed"]
        print(f"resume advanced: {d > c} ({c:.2f} -> {d:.2f})")

        browser.close()

run()
print("--- CONSOLE ---")
for line in logs[-12:]:
    print(line)
