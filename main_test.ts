import { launch } from "@astral/astral"
import { assertEquals } from "@std/assert"
import { encodeHex } from "@std/encoding"
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
  const assertImageEquals = async (want: Uint8Array, got: Uint8Array) => {
    const wantHash = await crypto.subtle.digest("SHA-256", want)
    const gotHash = await crypto.subtle.digest("SHA-256", got)

    assertEquals(encodeHex(wantHash), encodeHex(gotHash))
  }

  await t.step("Basic HTML and CSS", async () => {
    const want = await screenshot(join("tests", "basic.html"))
    const got = await screenshot(join("dist", "basic.html"))

    await assertImageEquals(want, got)
  })

  await t.step("Where selector with classes", async () => {
    const want = await screenshot(join("tests", "where.html"))
    const got = await screenshot(join("dist", "where.html"))

    await assertImageEquals(want, got)
  })

  await t.step("Advanced where selector with complex cases", async () => {
    const want = await screenshot(join("tests", "advanced-where.html"))
    const got = await screenshot(join("dist", "advanced-where.html"))

    await assertImageEquals(want, got)
  })

  await t.step("Attribute selectors in where clauses", async () => {
    const want = await screenshot(join("tests", "attribute-selector.html"))
    const got = await screenshot(join("dist", "attribute-selector.html"))

    await assertImageEquals(want, got)
  })

  await t.step("Unquoted attribute selectors", async () => {
    const want = await screenshot(
      join("tests", "attribute-selector-unquoted.html"),
    )
    const got = await screenshot(
      join("dist", "attribute-selector-unquoted.html"),
    )

    await assertImageEquals(want, got)
  })

  await t.step(
    "Multiple classes with multi-character minified values",
    async () => {
      const want = await screenshot(join("tests", "many-classes.html"))
      const got = await screenshot(join("dist", "many-classes.html"))

      await assertImageEquals(want, got)
    },
  )

  await browser.close()
})
