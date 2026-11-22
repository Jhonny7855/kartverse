import json
import os
from playwright.sync_api import sync_playwright

URL = "http://localhost:5173/"
OUT = "D:/SteamUnlocked Launcher/kartverse/scripts/out"
os.makedirs(OUT, exist_ok=True)
logs = []

def save(page):
    raw = page.evaluate("() => localStorage.getItem('kartverse.save.v2')")
    return json.loads(raw) if raw else None

def hud(page):
    loc = page.locator(".hud")
    return loc.first.inner_text().replace("\n", " | ") if loc.count() else ""

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
        page.wait_for_timeout(900)
        page.get_by_text("Skip intro").click(timeout=8000)
        page.wait_for_timeout(600)

        # Garage paint change
        page.locator(".menu-nav-item").nth(1).click(force=True)
        page.wait_for_timeout(2600)
        s0 = save(page)
        karts0 = (s0 or {}).get("karts") or {}
        print("save exists:", s0 is not None, "kart keys:", list(karts0)[:6])
        swatches = page.locator(".swatch")
        print("swatches:", swatches.count())
        before = karts0.get("balanced", {}).get("bodyColor")
        if swatches.count() > 3:
            swatches.nth(3).click(force=True)
            page.wait_for_timeout(1000)
        s1 = save(page)
        after = ((s1 or {}).get("karts") or {}).get("balanced", {}).get("bodyColor")
        print(f"paint: {before} -> {after} changed={before != after}")
        page.screenshot(path=f"{OUT}/A1-garage-painted.png")

        # Settings units
        page.locator(".page-header button").first.click(force=True)
        page.wait_for_timeout(900)
        page.locator(".menu-nav-item").nth(5).click(force=True)
        page.wait_for_timeout(1500)
        page.screenshot(path=f"{OUT}/A2-settings.png")
        mph = page.get_by_role("button", name="MPH", exact=False)
        if mph.count():
            mph.first.click(force=True)
            page.wait_for_timeout(700)
        print("units now:", ((save(page) or {}).get("settings") or {}).get("units"))

        # Practice mode
        page.locator(".page-header button").first.click(force=True)
        page.wait_for_timeout(900)
        page.locator(".menu-nav-item").nth(0).click(force=True)
        page.wait_for_timeout(1300)
        page.get_by_role("button", name="Practice", exact=False).first.click(force=True)
        page.wait_for_timeout(400)
        page.get_by_role("button", name="Start Race", exact=False).first.click(force=True)
        page.wait_for_timeout(6500)
        if page.get_by_text("GOT IT").count():
            page.get_by_text("GOT IT").click()
        page.wait_for_timeout(700)
        page.evaluate("() => window.__kartverse.debugAutopilot(1800)")
        page.wait_for_timeout(500)
        print("practice:", json.dumps(page.evaluate("() => window.__kartverse.debugState()")))
        print("practice hud:", hud(page)[:200])
        page.screenshot(path=f"{OUT}/A3-practice.png")

        # Race HUD
        page.keyboard.press("Escape")
        page.wait_for_timeout(600)
        page.get_by_role("button", name="Quit to menu", exact=False).first.click(force=True)
        page.wait_for_timeout(1400)
        page.locator(".menu-nav-item").nth(0).click(force=True)
        page.wait_for_timeout(1200)
        page.get_by_role("button", name="Quick Race", exact=False).first.click(force=True)
        page.wait_for_timeout(400)
        page.get_by_role("button", name="Start Race", exact=False).first.click(force=True)
        page.wait_for_timeout(6000)
        if page.get_by_text("GOT IT").count():
            page.get_by_text("GOT IT").click()
        page.wait_for_timeout(600)
        page.evaluate("() => window.__kartverse.debugAutopilot(1500)")
        page.wait_for_timeout(400)
        page.screenshot(path=f"{OUT}/A4-hud-race.png")
        print("race hud:", hud(page)[:260])

        browser.close()

run()
print("--- CONSOLE ---")
for line in logs[-25:]:
    print(line)
