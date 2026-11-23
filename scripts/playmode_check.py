import json, os
from playwright.sync_api import sync_playwright

URL = "http://localhost:5173/"
OUT = "D:/SteamUnlocked Launcher/kartverse/scripts/out"
os.makedirs(OUT, exist_ok=True)
logs = []

ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"]


def enter_race(pg):
    pg.goto(URL, wait_until="domcontentloaded")
    pg.wait_for_timeout(900)
    pg.get_by_text("Skip intro").click(timeout=8000)
    pg.wait_for_timeout(700)
    pg.locator(".menu-nav-item").nth(0).click(force=True)
    pg.wait_for_timeout(1200)
    pg.get_by_role("button", name="Quick Race", exact=False).first.click(force=True)
    pg.wait_for_timeout(400)
    pg.get_by_role("button", name="Start Race", exact=False).first.click(force=True)
    pg.wait_for_function("() => window.__kartverse && window.__kartverse.race", timeout=90000)


def run():
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", headless=True, args=ARGS)
        pg = b.new_page(viewport={"width": 1440, "height": 900})
        pg.on("pageerror", lambda e: logs.append(f"[pageerror] {e}"))
        pg.on("console", lambda m: logs.append(f"[{m.type}] {m.text}") if m.type == "error" else None)
        enter_race(pg)

        # Pre-race guide should offer both options.
        pg.wait_for_selector(".playmode-card", timeout=20000)
        cards = pg.locator(".playmode-card").all_text_contents()
        pg.screenshot(path=f"{OUT}/P0-playmode-guide.png")

        # Default on a desktop viewport must be Desktop and pads hidden.
        default_mode = pg.evaluate("() => window.__kartverse.settings.playMode")
        pads_before = pg.locator(".touch-controls").count()

        # Switch to Mobile from the guide.
        pg.locator(".playmode-card", has_text="Mobile").click()
        pg.wait_for_timeout(400)
        mode_after = pg.evaluate("() => window.__kartverse.settings.playMode")
        touch_rows = pg.locator(".keycap", has_text="DRIFT").count()
        pg.screenshot(path=f"{OUT}/P1-guide-mobile.png")
        pg.locator(".modal .btn-primary").click()
        pg.wait_for_function("() => window.__kartverse.race.state === 'racing'", timeout=90000)
        pg.wait_for_timeout(600)

        pads_mobile = pg.locator(".touch-pad").count()
        actions_mobile = pg.locator(".touch-action").count()
        body_mobile = pg.evaluate("() => document.body.classList.contains('play-mobile')")
        pg.screenshot(path=f"{OUT}/P2-race-mobile-pads.png")

        # Pads must wire into the engine input. Assert on the input channel directly:
        # SwiftShader renders at ~3 fps, so speed deltas are too small to be a signal.
        throttle = pg.locator('.touch-action[aria-label="Accelerate"]')
        throttle.dispatch_event("pointerdown", {"pointerId": 1, "isPrimary": True})
        pg.wait_for_timeout(500)
        throttle_input = pg.evaluate("() => window.__kartverse.input.getInput().throttle")
        speed_during = pg.evaluate("() => window.__kartverse.race.player.speed")
        throttle.dispatch_event("pointerup", {"pointerId": 1, "isPrimary": True})
        pg.wait_for_timeout(400)
        throttle_released = pg.evaluate("() => window.__kartverse.input.getInput().throttle")

        right = pg.locator('.touch-pad[aria-label="Steer right"]')
        right.dispatch_event("pointerdown", {"pointerId": 2, "isPrimary": True})
        pg.wait_for_timeout(900)
        steer_right = pg.evaluate("() => window.__kartverse.input.getInput().steer")
        right.dispatch_event("pointerup", {"pointerId": 2, "isPrimary": True})
        pg.wait_for_timeout(400)
        steer_released = pg.evaluate("() => window.__kartverse.input.getInput().steer")

        left = pg.locator('.touch-pad[aria-label="Steer left"]')
        left.dispatch_event("pointerdown", {"pointerId": 3, "isPrimary": True})
        pg.wait_for_timeout(900)
        steer_left = pg.evaluate("() => window.__kartverse.input.getInput().steer")
        left.dispatch_event("pointerup", {"pointerId": 3, "isPrimary": True})
        pg.wait_for_timeout(300)

        drift_btn = pg.locator('.touch-action[aria-label="Drift"]')
        drift_btn.dispatch_event("pointerdown", {"pointerId": 4, "isPrimary": True})
        pg.wait_for_timeout(400)
        drift_input = pg.evaluate("() => window.__kartverse.input.getInput().drift")
        drift_btn.dispatch_event("pointerup", {"pointerId": 4, "isPrimary": True})
        pg.wait_for_timeout(300)

        boost_btn = pg.locator('.touch-action[aria-label="Boost"]')
        boost_btn.dispatch_event("pointerdown", {"pointerId": 5, "isPrimary": True})
        pg.wait_for_timeout(400)
        boost_input = pg.evaluate("() => window.__kartverse.input.getInput().boost")
        boost_btn.dispatch_event("pointerup", {"pointerId": 5, "isPrimary": True})
        pg.wait_for_timeout(300)

        brake_btn = pg.locator('.touch-action[aria-label="Brake"]')
        brake_btn.dispatch_event("pointerdown", {"pointerId": 6, "isPrimary": True})
        pg.wait_for_timeout(400)
        brake_input = pg.evaluate("() => window.__kartverse.input.getInput().brake")
        brake_btn.dispatch_event("pointerup", {"pointerId": 6, "isPrimary": True})
        pg.wait_for_timeout(300)
        pg.screenshot(path=f"{OUT}/P3-race-driving.png")

        # Settings must expose the same two options and persist the choice.
        pg.evaluate("() => window.__kartverse.setPaused(true)")
        pg.wait_for_timeout(300)
        pg.get_by_role("button", name="SETTINGS", exact=False).click()
        pg.wait_for_timeout(700)
        if pg.get_by_role("button", name="Controls", exact=False).count():
            pg.get_by_role("button", name="Controls", exact=False).first.click()
        pg.wait_for_timeout(500)
        settings_modes = pg.locator(".segmented-item", has_text="Mobile").count()
        pg.screenshot(path=f"{OUT}/P4-settings-playmode.png")
        pg.locator(".segmented-item", has_text="Desktop").first.click()
        pg.wait_for_timeout(500)
        saved = pg.evaluate("() => JSON.parse(localStorage.getItem('kartverse.save.v2')).settings.playMode")

        # Back to the race: pads must be gone on desktop.
        pg.get_by_role("button", name="Menu", exact=False).first.click()
        pg.wait_for_timeout(1200)
        pads_desktop = pg.locator(".touch-pad").count()

        report = {
            "guide_cards": cards,
            "guide_has_two_options": len(cards) == 2,
            "default_mode_desktop_viewport": default_mode,
            "pads_render_before_race": pads_before,
            "mode_after_guide_switch": mode_after,
            "guide_shows_touch_rows": touch_rows >= 1,
            "pads_mobile": pads_mobile,
            "actions_mobile": actions_mobile,
            "body_play_mobile": body_mobile,
            "throttle_input": throttle_input,
            "throttle_released": throttle_released,
            "speed_during": round(speed_during, 2),
            "steer_right_input": round(steer_right, 2),
            "steer_left_input": round(steer_left, 2),
            "steer_released": round(steer_released, 2),
            "drift_input": drift_input,
            "boost_input": boost_input,
            "brake_input": brake_input,
            "settings_has_mobile_option": settings_modes >= 1,
            "persisted_mode": saved,
            "pads_after_desktop": pads_desktop,
        }
        report["PASS"] = (
            report["guide_has_two_options"]
            and default_mode == "desktop"
            and mode_after == "mobile"
            and report["guide_shows_touch_rows"]
            and pads_mobile >= 2
            and actions_mobile >= 4
            and body_mobile
            and throttle_input == 1
            and throttle_released == 0
            and steer_right < -0.2
            and steer_left > 0.2
            and abs(steer_released) < 0.35
            and drift_input is True
            and boost_input is True
            and brake_input == 1
            and report["settings_has_mobile_option"]
            and saved == "desktop"
            and pads_desktop == 0
        )
        print("PLAYMODE:", json.dumps(report, indent=2))
        b.close()


run()
print("--- CONSOLE ---")
for l in logs[-10:]:
    print(l)
