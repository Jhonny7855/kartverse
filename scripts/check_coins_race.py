import json, os
from playwright.sync_api import sync_playwright

URL = "http://localhost:5173/"
OUT = "D:/SteamUnlocked Launcher/kartverse/scripts/out"
os.makedirs(OUT, exist_ok=True)
logs = []


def run():
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", headless=True, args=[
            "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"])
        pg = b.new_page(viewport={"width": 1100, "height": 700})
        pg.on("pageerror", lambda e: logs.append(f"[pageerror] {e}"))
        pg.goto(URL, wait_until="domcontentloaded")
        pg.wait_for_timeout(900)
        try:
            pg.get_by_text("Skip intro").click(timeout=6000)
        except Exception:
            pass
        pg.wait_for_timeout(700)
        pg.locator(".menu-nav-item").nth(0).click(force=True)
        pg.wait_for_timeout(1200)
        pg.get_by_role("button", name="Quick Race", exact=False).first.click(force=True)
        pg.wait_for_timeout(400)
        pg.get_by_role("button", name="Start Race", exact=False).first.click(force=True)
        pg.wait_for_timeout(6000)
        if pg.get_by_text("GOT IT").count():
            pg.get_by_text("GOT IT").click()
        pg.wait_for_function("() => window.__kartverse && window.__kartverse.race && window.__kartverse.race.state === 'racing'", timeout=120000)

        lap_state = pg.evaluate("""() => {
          const e = window.__kartverse;
          return { lap: e.race.player.lap, coins: e.race.coins.filter(c => c.collected).length };
        }""")
        print("start:", json.dumps(lap_state))

        # Drive one full lap, then confirm coins respawn for the next lap.
        pg.evaluate("() => window.__kartverse.debugAutopilot(4200)")
        mid = pg.evaluate("""() => {
          const e = window.__kartverse, p = e.race.player;
          return { lap: p.lap, coins: p.coins, collected: e.race.coins.filter(c => c.collected).length,
                   total: e.race.coins.length, filled: document.querySelector('.hud-coins-value')?.textContent ?? null };
        }""")
        print("after lap:", json.dumps(mid))

        # Finish the race.
        for _ in range(6):
            done = pg.evaluate("""() => {
              const e = window.__kartverse;
              if (e.debugState().finished) return true;
              e.debugAutopilot(3000);
              return e.debugState().finished;
            }""")
            if done:
                break
        pg.wait_for_timeout(1800)

        results = pg.evaluate("""() => {
          const modal = document.querySelector('.modal-xl');
          if (!modal) return { modal: false };
          const stats = [...modal.querySelectorAll('.result-stat')].map(n => ({
            label: n.querySelector('.result-stat-label')?.textContent,
            value: n.querySelector('.result-stat-value')?.textContent,
          }));
          const chips = [...modal.querySelectorAll('.reward-chip')].map(n => n.textContent.trim());
          return { modal: true, stats, chips,
                   title: modal.querySelector('.modal-title')?.textContent };
        }""")
        print("results:", json.dumps(results))
        pg.screenshot(path=f"{OUT}/coins_results.png", clip={"x": 60, "y": 60, "width": 980, "height": 560})
        b.close()


run()
print("--- CONSOLE ---")
for l in logs[-10:]:
    print(l)
