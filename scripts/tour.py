import os
from playwright.sync_api import sync_playwright

URL = "http://localhost:5173/"
OUT = "D:/SteamUnlocked Launcher/kartverse/scripts/out"
os.makedirs(OUT, exist_ok=True)
logs = []

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
        page.wait_for_timeout(800)

        def visit(name, nav_label, shot):
            try:
                page.get_by_role("button", name=nav_label, exact=False).first.click(timeout=6000)
            except Exception as e:
                print(f"{name}: NAV FAIL {e}")
                return
            page.wait_for_timeout(2200)
            page.screenshot(path=f"{OUT}/{shot}")
            txt = page.locator("body").inner_text()
            print(f"{name}: {len(txt)} chars")
            back = page.get_by_role("button", name="Menu", exact=False)
            if back.count():
                back.first.click()
                page.wait_for_timeout(900)

        visit("setup", "RACE SETUP", "30-setup.png")
        visit("garage", "GARAGE", "31-garage.png")
        visit("tracks", "TRACKS", "32-tracks.png")
        visit("career", "CAREER", "33-career.png")
        visit("records", "RECORDS", "34-records.png")
        visit("settings", "SETTINGS", "35-settings.png")

        # Garage interaction: change paint then back
        page.get_by_role("button", name="GARAGE", exact=False).first.click()
        page.wait_for_timeout(2000)
        swatches = page.locator(".swatch, .color-swatch, .paint-swatch, button[style*='background']")
        print("swatch candidates:", swatches.count())
        page.screenshot(path=f"{OUT}/36-garage-detail.png")

        browser.close()

run()
print("--- CONSOLE ---")
for line in logs[-25:]:
    print(line)
