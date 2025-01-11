import { walkSync } from "@std/fs"
import { dirname, extname, join, relative } from "@std/path"
import {
  type AttrCount,
  type AttrMap,
  getProcessor,
} from "./processor/processor.ts"

const validChars =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_"

export function minify(inputDir: string, outputDir: string = inputDir): void {
  const attrCount: AttrCount = {}

  for (const entry of walkSync(inputDir)) {
    const processor = getProcessor(extname(entry.path))

    if (!processor) {
      continue
    }

    const file = Deno.readTextFileSync(entry.path)

    processor.countAttributes(attrCount, file)
  }

  const attrMap: AttrMap = {}

  for (const attr in attrCount) {
    attrMap[attr] = {}

    const valuesFreq = Object.entries(attrCount[attr]).sort((a, b) =>
      b[1] - a[1]
    )

    for (let i = 0; i < valuesFreq.length; i++) {
      let iLocal = i
      let minifiedValue = ""

      while (iLocal >= validChars.length) {
        minifiedValue += validChars[iLocal % validChars.length]
        iLocal = Math.floor(iLocal / validChars.length)
      }

      minifiedValue += validChars[iLocal]
      attrMap[attr][valuesFreq[i][0]] = minifiedValue
    }
  }

  for (const entry of walkSync(inputDir)) {
    const processor = getProcessor(extname(entry.path))

    if (!processor) {
      continue
    }

    const file = Deno.readTextFileSync(entry.path)
    const outputPath = join(outputDir, relative(inputDir, entry.path))

    try {
      Deno.mkdirSync(dirname(outputPath), { recursive: true })
    } catch (e) {
      if (!(e instanceof Deno.errors.AlreadyExists)) {
        throw e
      }
    }

    Deno.writeTextFileSync(
      outputPath,
      processor.applyAttrMap(attrMap, file),
    )
  }
}

if (import.meta.main) {
  minify(Deno.args[0], Deno.args[1])
}
