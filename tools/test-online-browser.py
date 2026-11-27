"""Teste de duas sessões reais. Requer Playwright e o jogo em localhost:8000."""
import asyncio
import os

from playwright.async_api import async_playwright


async def copy_code(page):
    await page.wait_for_function("document.querySelector('#online-output').value.length > 0")
    return await page.locator("#online-output").input_value()


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            executable_path=os.getenv("CHROME_BIN"),
            args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader",
                  "--disable-renderer-backgrounding", "--disable-background-timer-throttling"],
        )
        # Cada página tem armazenamento independente, como em dois computadores.
        host = await browser.new_page(viewport={"width": 800, "height": 520})
        guest = await browser.new_page(viewport={"width": 800, "height": 520}, has_touch=True)
        for page in (host, guest):
            await page.add_init_script("""localStorage.setItem('voxel-sandbox/game-settings/v1',
                JSON.stringify({renderDistance: 2, graphics: '0.5', volume: 0}))""")
            await page.goto("http://localhost:8000/?debug&sw=0" + ("&touch=1" if page == guest else ""))
            await page.locator("#online-open").click()

        await host.locator("#online-host").click()
        await guest.locator("#online-join").click()
        await guest.locator("#online-input").fill(await copy_code(host))
        await guest.locator("#online-next").click()
        await host.locator("#online-input").fill(await copy_code(guest))
        await host.locator("#online-next").click()
        for page in (host, guest):
            await page.wait_for_function("window.dbg?.peerPosition()", timeout=120000)
        assert await host.evaluate("ACTIVE_WORLD.seed") == await guest.evaluate("ACTIVE_WORLD.seed")

        coords = await guest.evaluate("dbg.position().map(Math.floor)")
        coords[1] = min(61, coords[1] + 3)
        for sender, receiver, block in [(host, guest, 3), (guest, host, 1), (guest, host, 0)]:
            assert await sender.evaluate("([b, pos]) => dbg.setBlock(b, ...pos)", [block, coords])
            await receiver.wait_for_function("([b, pos]) => dbg.blockAt(...pos) === b", arg=[block, coords])

        await guest.locator("#btn-play").tap()
        await guest.locator('[data-touch="chat"]').tap()
        await guest.locator("#chat-input").fill("Oi, colega!")
        await guest.locator("#chat-input").press("Enter")
        await host.get_by_text("Colega: Oi, colega!", exact=True).wait_for()

        await host.locator("#btn-worlds").click()
        await guest.locator("#online-ended").wait_for()
        await host.locator("#btn-open-worlds").click()
        await host.get_by_text("Dupla ·", exact=False).first.wait_for()
        await guest.locator("#online-leave").click()
        await guest.locator("#btn-open-worlds").click()
        assert await guest.get_by_text("Dupla ·", exact=False).count() == 0
        pixels = await host.evaluate("""async () => {
            const { testWaterRender } = await import('/tools/test-water-render.mjs');
            return testWaterRender();
        }""")
        assert pixels["motion"] > 48 and pixels["depth"] > 48, pixels
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
