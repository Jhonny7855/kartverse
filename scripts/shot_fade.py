from playwright.sync_api import sync_playwright

URL = "http://localhost:5173/"
ARGS = ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--no-sandbox"]

def run():
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", headless=True, args=ARGS)
        pg = b.new_page(viewport={"width":1280,"height":720})
        pg.goto(URL, wait_until="domcontentloaded")
        pg.wait_for_timeout(900)
        pg.get_by_text("Skip intro").click(timeout=8000)
        pg.wait_for_timeout(600)
        pg.locator(".menu-nav-item").nth(0).click(force=True)
        pg.wait_for_timeout(1200)
        pg.get_by_role("button", name="Quick Race", exact=False).first.click(force=True)
        pg.wait_for_timeout(400)
        pg.get_by_role("button", name="Start Race", exact=False).first.click(force=True)
        pg.wait_for_timeout(6200)
        if pg.get_by_text("GOT IT").count():
            pg.get_by_text("GOT IT").click()
        pg.wait_for_timeout(1500)
        pg.screenshot(path="scripts/out/fade_grid.png")
        pg.evaluate("window.__kartverse.debugAutopilot(300)")
        pg.wait_for_timeout(2600)
        pg.screenshot(path="scripts/out/fade_racing.png")
        b.close()

run()
