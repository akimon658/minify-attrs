import { walkSync } from "@std/fs"
import { dirname, extname, join, relative } from "@std/path"
import {
  type AttrCount,
  type AttrMap,
  getProcessor,
} from "./processor/processor.ts"

const firstCharSet = "abcdefghijklmnopqrstuvwxyz_"
const restCharSet = `${firstCharSet}0123456789-`

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

      if (iLocal < firstCharSet.length) {
        minifiedValue = firstCharSet[iLocal]
      } else {
        iLocal -= firstCharSet.length

        const firstChar = firstCharSet[iLocal % firstCharSet.length]

        iLocal = Math.floor(iLocal / firstCharSet.length)
        minifiedValue = firstChar

        while (iLocal > 0) {
          minifiedValue += restCharSet[iLocal % restCharSet.length]
          iLocal = Math.floor(iLocal / restCharSet.length)
        }
      }

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
