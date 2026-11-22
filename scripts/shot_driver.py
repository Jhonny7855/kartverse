import json
from playwright.sync_api import sync_playwright

URL = "http://localhost:5173/"
ARGS = ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--no-sandbox"]

def run():
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", headless=True, args=ARGS)
        pg = b.new_page(viewport={"width":1440,"height":900})
        pg.goto(URL, wait_until="domcontentloaded")
        pg.wait_for_timeout(1400)
        pg.get_by_text("Skip intro").click(force=True, timeout=15000)
        pg.wait_for_timeout(700)
        pg.locator(".menu-nav-item").nth(1).click(force=True)
        pg.wait_for_timeout(2600)

        # zoom the showroom in on the driver
        host = pg.locator(".showroom").first
        box = host.bounding_box()
        print("showroom box:", box)
        pg.mouse.move(box["x"] + box["width"]/2, box["y"] + box["height"]/2)
        for _ in range(12):
            pg.mouse.wheel(0, -120)
            pg.wait_for_timeout(60)
        pg.wait_for_timeout(900)
        pg.screenshot(path="scripts/out/driver_closeup.png")

        # orbit around to see the driver's other side
        pg.mouse.move(box["x"] + box["width"]/2, box["y"] + box["height"]/2)
        pg.mouse.down()
        pg.mouse.move(box["x"] + box["width"]/2 + 260, box["y"] + box["height"]/2 + 40, steps=18)
        pg.mouse.up()
        pg.wait_for_timeout(1000)
        pg.screenshot(path="scripts/out/driver_side.png")
        b.close()

run()
