import json, os
from playwright.sync_api import sync_playwright

URL = "http://localhost:5173/"
OUT = "D:/SteamUnlocked Launcher/kartverse/scripts/out"
logs = []

ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"]
IPHONE_UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
)


def run():
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", headless=True, args=ARGS)

        # Phone profile: landscape, touch enabled, mobile UA.
        ctx = b.new_context(
            viewport={"width": 844, "height": 390},
            device_scale_factor=2,
            is_mobile=True,
            has_touch=True,
            user_agent=IPHONE_UA,
        )
        pg = ctx.new_page()
        pg.on("pageerror", lambda e: logs.append(f"[pageerror] {e}"))
        pg.goto(URL, wait_until="domcontentloaded")
        pg.wait_for_timeout(900)
        pg.get_by_text("Skip intro").click(timeout=8000)
        pg.wait_for_timeout(700)

        # A phone must default to Mobile without being told.
        default_on_phone = pg.evaluate(
            "() => JSON.parse(localStorage.getItem('kartverse.save.v2') || '{}').settings?.playMode"
        )
        if default_on_phone is None:
            default_on_phone = pg.evaluate("() => window.__kartverse?.settings?.playMode")

        pg.locator(".menu-nav-item").nth(0).click(force=True)
        pg.wait_for_timeout(1200)
        pg.get_by_role("button", name="Quick Race", exact=False).first.click(force=True)
        pg.wait_for_timeout(400)
        pg.get_by_role("button", name="Start Race", exact=False).first.click(force=True)
        pg.wait_for_function("() => window.__kartverse && window.__kartverse.race", timeout=90000)
        pg.wait_for_selector(".playmode-card", timeout=20000)
        guide_default = pg.evaluate("() => window.__kartverse.settings.playMode")
        pg.locator(".modal .btn-primary").click()
        pg.wait_for_function("() => window.__kartverse.race.state === 'racing'", timeout=90000)
        pg.wait_for_timeout(800)

        pads = pg.locator(".touch-pad").count()
        actions = pg.locator(".touch-action").count()

        # Pads must sit inside the viewport and not collide with each other.
        boxes = pg.evaluate("""() => {
          const pick = (sel) => Array.from(document.querySelectorAll(sel)).map((el) => {
            const r = el.getBoundingClientRect();
            return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
          });
          return { steer: pick('.touch-pad'), actions: pick('.touch-action'), vw: innerWidth, vh: innerHeight };
        }""")
        in_view = all(
            0 <= r["x"] and r["x"] + r["w"] <= boxes["vw"] and 0 <= r["y"] and r["y"] + r["h"] <= boxes["vh"]
            for r in boxes["steer"] + boxes["actions"]
        )
        pg.screenshot(path=f"{OUT}/P5-phone-landscape.png")

        # Portrait check.
        pg.set_viewport_size({"width": 390, "height": 844})
        pg.wait_for_timeout(900)
        portrait = pg.evaluate("""() => {
          const pads = Array.from(document.querySelectorAll('.touch-pad, .touch-action'));
          const vw = innerWidth, vh = innerHeight;
          return {
            vw, vh,
            allInside: pads.every((el) => {
              const r = el.getBoundingClientRect();
              return r.x >= -1 && r.y >= -1 && r.x + r.width <= vw + 1 && r.y + r.height <= vh + 1;
            }),
            count: pads.length,
          };
        }""")
        pg.screenshot(path=f"{OUT}/P6-phone-portrait.png")

        # Now force Desktop on the phone: pads must disappear.
        pg.evaluate("() => window.__kartverse.setPaused(true)")
        pg.wait_for_timeout(400)
        pg.get_by_role("button", name="SETTINGS", exact=False).click()
        pg.wait_for_timeout(800)
        pg.get_by_role("button", name="Controls", exact=False).first.click()
        pg.wait_for_timeout(500)
        pg.locator(".segmented-item", has_text="Desktop").first.click()
        pg.wait_for_timeout(500)
        pg.get_by_role("button", name="Menu", exact=False).first.click()
        pg.wait_for_timeout(1200)
        pads_desktop_on_phone = pg.locator(".touch-pad").count()
        pg.screenshot(path=f"{OUT}/P7-phone-desktop-mode.png")

        report = {
            "phone_default_mode": default_on_phone,
            "phone_guide_default": guide_default,
            "pads": pads,
            "actions": actions,
            "all_controls_in_view_landscape": in_view,
            "landscape_boxes": boxes,
            "portrait": portrait,
            "pads_when_desktop_on_phone": pads_desktop_on_phone,
        }
        report["PASS"] = (
            pads >= 2
            and actions >= 4
            and in_view
            and portrait["allInside"]
            and pads_desktop_on_phone == 0
        )
        print("MOBILE:", json.dumps(report, indent=2))
        ctx.close()
        b.close()


run()
print("--- CONSOLE ---")
for l in logs[-10:]:
    print(l)
