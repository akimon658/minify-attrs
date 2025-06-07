import { launch } from "@astral/astral"
import { assertEquals } from "@std/assert"
import { join, toFileUrl } from "@std/path"
import { minify } from "./main.ts"

Deno.test("Visual regression tests", async (t) => {
  minify("tests", "dist")

  const browser = await launch()
  const screenshot = async (htmlPath: string) => {
    const page = await browser.newPage(
      toFileUrl(join(Deno.cwd(), htmlPath)).toString(),
    )
    const screenshot = await page.screenshot()
    await page.close()
    return screenshot
  }

  await t.step("Basic HTML and CSS", async () => {
    const want = await screenshot(join("tests", "basic.html"))
    const got = await screenshot(join("dist", "basic.html"))

    assertEquals(want, got)
  })

  await t.step("Where selector with classes", async () => {
    const want = await screenshot(join("tests", "where.html"))
    const got = await screenshot(join("dist", "where.html"))

    assertEquals(want, got)
  })

  await t.step("Advanced where selector with complex cases", async () => {
    const want = await screenshot(join("tests", "advanced-where.html"))
    const got = await screenshot(join("dist", "advanced-where.html"))

    assertEquals(want, got)
  })

  await t.step("Attribute selectors in where clauses", async () => {
    const want = await screenshot(join("tests", "attribute-selector.html"))
    const got = await screenshot(join("dist", "attribute-selector.html"))

    assertEquals(want, got)
  })

  await t.step(
    "Multiple classes with multi-character minified values",
    async () => {
      const want = await screenshot(join("tests", "many-classes.html"))
      const got = await screenshot(join("dist", "many-classes.html"))

      assertEquals(want, got)
    },
  )

  await browser.close()
})
