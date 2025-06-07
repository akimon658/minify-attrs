import { walkSync } from "@std/fs"
import { dirname, extname, join, relative } from "@std/path"
import {
  type AttrCount,
  type AttrMap,
  getProcessor,
} from "./processor/processor.ts"

const firstCharSet = "abcdefghijklmnopqrstuvwxyz_"
const restCharSet = `${firstCharSet}0123456789-`

/**
 * Generates a unique minified name for a given index.
 * Uses a base conversion algorithm to create short, unique identifiers.
 *
 * @param index - The zero-based index to convert to a minified name
 * @returns A minified string (e.g., "a", "b", ..., "aa", "ab", etc.)
 */
const generateMinifiedName = (index: number): string => {
  if (index < firstCharSet.length) {
    // Single character: a, b, c, ..., z, _
    return firstCharSet[index]
  }

  // Multi-character names: aa, ab, ac, ...
  let remaining = index - firstCharSet.length
  let length = 2

  // Step 1: Determine the length of the resulting string
  // Calculate total combinations for current length
  // For length=2: 27 × 38^1 = 1,026 combinations (aa, ab, ..., _-)
  // For length=3: 27 × 38^2 = 38,988 combinations (aaa, aab, ..., _--)
  let totalCombos = firstCharSet.length *
    Math.pow(restCharSet.length, length - 1)

  // Find the appropriate length by skipping over complete sets
  // of shorter combinations until we find the right length
  while (remaining >= totalCombos) {
    remaining -= totalCombos // Skip all combinations of current length
    length++
    totalCombos = firstCharSet.length * Math.pow(restCharSet.length, length - 1)
  }

  // Step 2: Generate the actual string for the determined length
  // Convert remaining index to base-N representation where N varies by position

  // First character: choose from firstCharSet (27 options)
  const firstCharIndex = Math.floor(
    remaining / Math.pow(restCharSet.length, length - 1),
  )
  let result = firstCharSet[firstCharIndex]

  // Update remaining to exclude the first character's contribution
  remaining = remaining % Math.pow(restCharSet.length, length - 1)

  // Remaining characters: choose from restCharSet (38 options each)
  // Work backwards from the rightmost position to leftmost
  for (let position = length - 2; position >= 0; position--) {
    const charIndex = Math.floor(
      remaining / Math.pow(restCharSet.length, position),
    )
    result += restCharSet[charIndex]
    remaining = remaining % Math.pow(restCharSet.length, position)
  }

  return result
}

export const minify = (
  inputDir: string,
  outputDir: string = inputDir,
): void => {
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
      attrMap[attr][valuesFreq[i][0]] = generateMinifiedName(i)
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
