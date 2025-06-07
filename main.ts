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
      let minifiedValue = ""

      if (i < firstCharSet.length) {
        // Single character: a, b, c, ..., z, _
        minifiedValue = firstCharSet[i]
      } else {
        // Multi-character: aa, ab, ac, ...
        let remaining = i - firstCharSet.length

        // Generate multi-character names
        let length = 2
        // Calculate total combinations for current length
        // For length=2: 27 × 38^1 = 1,026 combinations (aa, ab, ..., _-)
        // For length=3: 27 × 38^2 = 38,988 combinations (aaa, aab, ..., _--)
        let totalCombos = firstCharSet.length *
          Math.pow(restCharSet.length, length - 1)

        // Find the appropriate length by skipping over complete sets
        // of shorter combinations until we find the right length
        while (remaining >= totalCombos) {
          remaining -= totalCombos
          length++
          totalCombos = firstCharSet.length *
            Math.pow(restCharSet.length, length - 1)
        }

        // Generate the name for this length
        const firstCharIndex = Math.floor(
          remaining / Math.pow(restCharSet.length, length - 1),
        )
        minifiedValue = firstCharSet[firstCharIndex]

        remaining = remaining % Math.pow(restCharSet.length, length - 1)

        for (let j = length - 2; j >= 0; j--) {
          const charIndex = Math.floor(
            remaining / Math.pow(restCharSet.length, j),
          )
          minifiedValue += restCharSet[charIndex]
          remaining = remaining % Math.pow(restCharSet.length, j)
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
