from playwright.sync_api import sync_playwright

URL = "http://localhost:5173/"
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"]
CLIP_W, CLIP_H = 620, 380


def run():
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", headless=True, args=ARGS)
        pg = b.new_page(viewport={"width": 960, "height": 600}, device_scale_factor=1)
        pg.goto(URL, wait_until="domcontentloaded")
        pg.wait_for_timeout(1500)
        try:
            pg.get_by_text("Skip intro").click(force=True, timeout=6000)
        except Exception:
            pass
        pg.wait_for_timeout(800)
        pg.locator(".menu-nav-item").nth(1).click(force=True)
        pg.wait_for_timeout(3000)

        box = pg.locator(".showroom").first.bounding_box()
        cx = box["x"] + box["width"] / 2
        cy = box["y"] + box["height"] / 2 - 15
        clip = {"x": cx - CLIP_W / 2, "y": cy - CLIP_H / 2, "width": CLIP_W, "height": CLIP_H}

        pg.mouse.move(cx, cy)
        for _ in range(12):
            pg.mouse.wheel(0, -120)
            pg.wait_for_timeout(40)
        pg.wait_for_timeout(1000)

        def drag(dx, dy, name):
            pg.mouse.move(cx, cy)
            pg.mouse.down()
            pg.mouse.move(cx + dx, cy + dy, steps=18)
            pg.mouse.up()
            pg.wait_for_timeout(850)
            pg.screenshot(path=f"scripts/out/{name}.png", clip=clip)

        drag(-200, 40, "q_front_q")   # front three-quarter, lower eye
        drag(-200, 0, "q_front")      # front straight-on
        drag(0, -90, "q_top")         # raised look-down

        b.close()


run()
