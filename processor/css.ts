// @ts-types="@types/css-tree"
import { generate, parse, walk } from "css-tree"
import type { AttrCount, AttrMap, Processor } from "./processor.ts"

export default class CSSProcessor implements Processor {
  applyAttrMap(attrMap: AttrMap, file: string): string {
    const ast = parse(file)

    walk(ast, {
      visit: "ClassSelector",
      enter: (node) => {
        if (attrMap.class && attrMap.class[node.name]) {
          node.name = attrMap.class[node.name]
        }
      },
    })

    walk(ast, {
      visit: "IdSelector",
      enter: (node) => {
        if (attrMap.id && attrMap.id[node.name]) {
          node.name = attrMap.id[node.name]
        }
      },
    })

    walk(ast, {
      visit: "AttributeSelector",
      enter: (node) => {
        if (node.name?.name === "class" && node.value?.type === "String") {
          const originalValue = node.value.value

          if (attrMap.class && attrMap.class[originalValue]) {
            node.value.value = attrMap.class[originalValue]
          }
        }

        if (node.name?.name === "id" && node.value?.type === "String") {
          const originalValue = node.value.value

          // For partial matching operators, we need to find the actual HTML id values
          // that contain this substring and use the appropriate minified replacement
          if (node.matcher) {
            const matcherType = node.matcher

            if (
              matcherType === "*=" ||
              matcherType === "^=" ||
              matcherType === "$="
            ) {
              // Find matching id values in the attrMap
              if (attrMap.id) {
                for (const [fullId, minifiedId] of Object.entries(attrMap.id)) {
                  let matches = false

                  switch (matcherType) {
                    case "*=":
                      if (fullId.includes(originalValue)) {
                        matches = true
                      }

                      break

                    case "^=":
                      if (fullId.startsWith(originalValue)) {
                        matches = true
                      }

                      break

                    case "$=":
                      if (fullId.endsWith(originalValue)) {
                        matches = true
                      }
                  }

                  if (matches) {
                    // For partial matching, we should replace with the minified full value
                    // since the HTML id will be completely replaced
                    node.value.value = minifiedId
                    // Change the matcher to exact match since we're now using the full minified value
                    node.matcher = "="
                    break
                  }
                }
              }
            } else if (attrMap.id && attrMap.id[originalValue]) {
              // For exact matching (= or ~=), use direct replacement
              node.value.value = attrMap.id[originalValue]
            }
          } else if (attrMap.id && attrMap.id[originalValue]) {
            // Default case (exact matching)
            node.value.value = attrMap.id[originalValue]
          }
        }
      },
    })

    return generate(ast)
  }

  countAttributes(attrCount: AttrCount, file: string): void {
    const ast = parse(file)

    walk(ast, {
      visit: "ClassSelector",
      enter: (node) => {
        if (!attrCount.class) {
          attrCount.class = {}
        }

        if (!attrCount.class[node.name]) {
          attrCount.class[node.name] = 0
        }

        attrCount.class[node.name]++
      },
    })

    walk(ast, {
      visit: "IdSelector",
      enter: (node) => {
        if (!attrCount.id) {
          attrCount.id = {}
        }

        if (!attrCount.id[node.name]) {
          attrCount.id[node.name] = 0
        }

        attrCount.id[node.name]++
      },
    })

    walk(ast, {
      visit: "AttributeSelector",
      enter: (node) => {
        // Handle [class~="value"] and [class="value"] patterns
        if (node.name?.name === "class" && node.value?.type === "String") {
          if (!attrCount.class) {
            attrCount.class = {}
          }

          const value = node.value.value
          if (!attrCount.class[value]) {
            attrCount.class[value] = 0
          }

          attrCount.class[value]++
        }

        // Handle [id*="value"], [id^="value"], [id$="value"] patterns
        if (node.name?.name === "id" && node.value?.type === "String") {
          if (!attrCount.id) {
            attrCount.id = {}
          }

          const value = node.value.value
          if (!attrCount.id[value]) {
            attrCount.id[value] = 0
          }

          attrCount.id[value]++
        }
      },
    })
  }
}
