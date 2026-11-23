import json, math, os
from playwright.sync_api import sync_playwright

URL = "http://localhost:5173/"
OUT = "D:/SteamUnlocked Launcher/kartverse/scripts/out"
os.makedirs(OUT, exist_ok=True)
logs = []


def run():
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", headless=True, args=[
            "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"])
        pg = b.new_page(viewport={"width": 1440, "height": 900})
        pg.on("pageerror", lambda e: logs.append(f"[pageerror] {e}"))
        pg.goto(URL, wait_until="domcontentloaded")
        pg.wait_for_timeout(900)
        pg.get_by_text("Skip intro").click(timeout=8000)
        pg.wait_for_timeout(700)
        pg.locator(".menu-nav-item").nth(0).click(force=True)
        pg.wait_for_timeout(1200)
        pg.get_by_role("button", name="Quick Race", exact=False).first.click(force=True)
        pg.wait_for_timeout(400)
        pg.get_by_role("button", name="Start Race", exact=False).first.click(force=True)
        pg.wait_for_function("() => window.__kartverse && window.__kartverse.race", timeout=60000)
        if pg.get_by_text("GOT IT").count():
            pg.get_by_text("GOT IT").click()
        pg.wait_for_function("() => window.__kartverse.race.state === 'racing'", timeout=90000)
        pg.evaluate("() => window.__kartverse.debugAutopilot(900)")
        pg.wait_for_timeout(400)

        # 1. Key mapping: real keydowns read back through InputManager.
        mapping = {}
        for key, label in (("ArrowRight", "right"), ("KeyD", "d"), ("ArrowLeft", "left"), ("KeyA", "a")):
            pg.keyboard.down(key)
            pg.wait_for_timeout(450)
            mapping[f"steer_{label}"] = round(pg.evaluate("() => window.__kartverse.input.getInput().steer"), 2)
            pg.keyboard.up(key)
            pg.wait_for_timeout(400)
        mapping["right_is_negative"] = mapping["steer_right"] < -0.2 and mapping["steer_d"] < -0.2
        mapping["left_is_positive"] = mapping["steer_left"] > 0.2 and mapping["steer_a"] > 0.2

        # 2. Physics sign: feed pure steer inputs into the sim, no rendering and no
        # throttle, so the kart pivots in place and cannot touch a wall.
        physics = pg.evaluate("""() => {
          const e = window.__kartverse, race = e.race, p = race.player;
          const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
          const run = (steer) => {
            const s = e.spline.sampleAtDistance(0.15 * e.spline.totalLength);
            p.position.copy(s.position);
            p.heading = Math.atan2(s.tangent.x, s.tangent.z);
            p.velocity.set(0, 0, 0); p.signedSpeed = 0; p.speed = 0;
            p.angularVelocity = 0; p.steer = 0; p.drifting = false; p.driftAngle = 0;
            const h0 = p.heading;
            for (let i = 0; i < 120; i++) {
              race.update(1 / 120, { throttle: 0, brake: 0, steer, drift: false, boost: false });
            }
            return { delta: wrap(p.heading - h0) };
          };
          return { right: run(-1), left: run(1) };
        }""")
        physics["right_turns_right"] = physics["right"]["delta"] < -0.02
        physics["left_turns_left"] = physics["left"]["delta"] > 0.02

        # 3. Touch path, allowed to settle through the input smoother.
        touch = pg.evaluate("""() => {
          const e = window.__kartverse;
          const settle = () => { for (let i = 0; i < 30; i++) e.input.getInput(); };
          e.setTouch({ steer: 1 });
          settle();
          const left = e.input.getInput().steer;
          e.setTouch({ steer: -1 });
          settle();
          const right = e.input.getInput().steer;
          e.setTouch({ steer: 0 });
          settle();
          return { touch_left_positive: left > 0.2, touch_right_negative: right < -0.2 };
        }""")

        # 4. Visual confirmation: on-track screenshot with a live right-hand input.
        pg.keyboard.down("KeyW")
        pg.keyboard.down("ArrowRight")
        pg.wait_for_timeout(900)
        pg.screenshot(path=f"{OUT}/S3-steer-right.png")
        pg.keyboard.up("ArrowRight")
        pg.keyboard.up("KeyW")

        result = {"mapping": mapping, "physics": physics, "touch": touch}
        ok = (
            mapping["right_is_negative"] and mapping["left_is_positive"]
            and physics["right_turns_right"] and physics["left_turns_left"]
            and touch["touch_left_positive"] and touch["touch_right_negative"]
        )
        result["PASS"] = ok
        print("STEER:", json.dumps(result, indent=2))
        b.close()


run()
print("--- CONSOLE ---")
for l in logs[-8:]:
    print(l)
