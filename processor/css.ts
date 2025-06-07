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
        // Handle class attribute selectors (both quoted strings and unquoted identifiers)
        if (node.name?.name === "class" && node.value) {
          let originalValue: string

          if (node.value.type === "String") {
            originalValue = node.value.value
            if (attrMap.class && attrMap.class[originalValue]) {
              node.value.value = attrMap.class[originalValue]
            }
          } else if (node.value.type === "Identifier") {
            originalValue = node.value.name
            if (attrMap.class && attrMap.class[originalValue]) {
              node.value.name = attrMap.class[originalValue]
            }
          }
        }

        // Handle id attribute selectors (both quoted strings and unquoted identifiers)
        if (node.name?.name === "id" && node.value) {
          let originalValue: string | undefined

          if (node.value.type === "String") {
            originalValue = node.value.value
          } else if (node.value.type === "Identifier") {
            originalValue = node.value.name
          }

          if (originalValue) {
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
                  for (
                    const [fullId, minifiedId] of Object.entries(attrMap.id)
                  ) {
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

                        break

                      default:
                        console.warn(`Unexpected matcher type: ${matcherType}`)
                    }

                    if (matches) {
                      // For partial matching, we should replace with the minified full value
                      // since the HTML id will be completely replaced
                      if (node.value.type === "String") {
                        node.value.value = minifiedId
                      } else if (node.value.type === "Identifier") {
                        node.value.name = minifiedId
                      }
                      // Change the matcher to exact match since we're now using the full minified value
                      node.matcher = "="
                      break
                    }
                  }
                }
              } else if (attrMap.id && attrMap.id[originalValue]) {
                // For exact matching (= or ~=), use direct replacement
                if (node.value.type === "String") {
                  node.value.value = attrMap.id[originalValue]
                } else if (node.value.type === "Identifier") {
                  node.value.name = attrMap.id[originalValue]
                }
              }
            } else if (attrMap.id && attrMap.id[originalValue]) {
              // Default case (exact matching)
              if (node.value.type === "String") {
                node.value.value = attrMap.id[originalValue]
              } else if (node.value.type === "Identifier") {
                node.value.name = attrMap.id[originalValue]
              }
            }
          }
        }
      },
    })

    return generate(ast)
  }

  countAttributes(attrCount: AttrCount, file: string): void {
    const ast = parse(file)
    const incrementAttrCount = (type: "class" | "id", value: string) => {
      if (!attrCount[type]) {
        attrCount[type] = {}
      }

      if (!attrCount[type][value]) {
        attrCount[type][value] = 0
      }

      attrCount[type][value]++
    }

    walk(ast, {
      visit: "ClassSelector",
      enter: (node) => incrementAttrCount("class", node.name),
    })

    walk(ast, {
      visit: "IdSelector",
      enter: (node) => incrementAttrCount("id", node.name),
    })

    walk(ast, {
      visit: "AttributeSelector",
      enter: (node) => {
        // Handle [class~="value"] and [class="value"] patterns (both quoted and unquoted)
        if (node.name?.name === "class" && node.value) {
          if (node.value.type === "String") {
            incrementAttrCount("class", node.value.value)
          } else if (node.value.type === "Identifier") {
            incrementAttrCount("class", node.value.name)
          }
        }

        // Handle [id*="value"], [id^="value"], [id$="value"] patterns (both quoted and unquoted)
        if (node.name?.name === "id" && node.value) {
          if (node.value.type === "String") {
            incrementAttrCount("id", node.value.value)
          } else if (node.value.type === "Identifier") {
            incrementAttrCount("id", node.value.name)
          }
        }
      },
    })
  }
}
