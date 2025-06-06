import { launch } from "@astral/astral"
import { assertEquals } from "@std/assert"
import { join, toFileUrl } from "@std/path"
import { minify } from "./main.ts"

async function screenshot(htmlPath: string): Promise<Uint8Array> {
  const browser = await launch()

  const page = await browser.newPage(
    toFileUrl(join(Deno.cwd(), htmlPath)).toString(),
  )
  const screenshot = await page.screenshot()

  await browser.close()

  return screenshot
}

Deno.test("Basic HTML and CSS", async () => {
  minify("tests", "dist")

  const want = await screenshot(join("tests", "basic.html"))
  const got = await screenshot(join("dist", "basic.html"))

  assertEquals(want, got)
})
