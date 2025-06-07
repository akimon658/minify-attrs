// @ts-types="@types/css-tree"
import type { AttributeSelector } from "css-tree"
import { generate, parse, walk } from "css-tree"
import type { AttrCount, AttrMap, Processor } from "./processor.ts"

export default class CSSProcessor implements Processor {
  private getAttrSelectorValue(node: AttributeSelector) {
    switch (node.value?.type) {
      case "String":
        return node.value.value

      case "Identifier":
        return node.value.name

      default:
        console.warn(
          `Unexpected value type in attribute selector: ${node.value}`,
        )

        return undefined
    }
  }

  private setAttrSelectorValue(node: AttributeSelector, value: string): void {
    switch (node.value?.type) {
      case "String":
        node.value.value = value
        break

      case "Identifier":
        node.value.name = value
        break

      default:
        console.warn(
          `Unexpected value type in attribute selector: ${node.value}`,
        )
    }
  }

  applyAttrMap(attrMap: AttrMap, file: string): string {
    const ast = parse(file)

    walk(ast, {
      visit: "ClassSelector",
      enter: (node) => {
        if (attrMap.class) {
          // Try direct mapping first
          if (attrMap.class[node.name]) {
            node.name = attrMap.class[node.name]
          } else {
            // Try to find a mapping by unescaping CSS identifiers
            // CSS special characters like : [ ] ( ) , are escaped with backslashes in CSS
            // but appear unescaped in HTML class attributes
            const unescapedName = node.name.replace(/\\(.)/g, "$1")
            if (attrMap.class[unescapedName]) {
              node.name = attrMap.class[unescapedName]
            }
          }
        }
      },
    })

    walk(ast, {
      visit: "IdSelector",
      enter: (node) => {
        if (attrMap.id) {
          // Try direct mapping first
          if (attrMap.id[node.name]) {
            node.name = attrMap.id[node.name]
          } else {
            // Try to find a mapping by unescaping CSS identifiers
            const unescapedName = node.name.replace(/\\(.)/g, "$1")
            if (attrMap.id[unescapedName]) {
              node.name = attrMap.id[unescapedName]
            }
          }
        }
      },
    })

    walk(ast, {
      visit: "AttributeSelector",
      enter: (node) => {
        // Handle class attribute selectors (both quoted strings and unquoted identifiers)
        if (node.name?.name === "class" && node.value) {
          const originalValue = this.getAttrSelectorValue(node)

          if (originalValue && attrMap.class) {
            // Try direct mapping first
            if (attrMap.class[originalValue]) {
              this.setAttrSelectorValue(node, attrMap.class[originalValue])
            } else {
              // Try to find a mapping by unescaping CSS identifiers
              const unescapedValue = originalValue.replace(/\\(.)/g, "$1")
              if (attrMap.class[unescapedValue]) {
                this.setAttrSelectorValue(node, attrMap.class[unescapedValue])
              }
            }
          }
        }

        // Handle id attribute selectors (both quoted strings and unquoted identifiers)
        if (node.name?.name === "id" && node.value) {
          const originalValue = this.getAttrSelectorValue(node)

          if (originalValue) {
            // Try to find direct mapping first
            let mappedValue = attrMap.id?.[originalValue]

            // If not found, try unescaped version
            if (!mappedValue) {
              const unescapedValue = originalValue.replace(/\\(.)/g, "$1")
              mappedValue = attrMap.id?.[unescapedValue]
            }

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
                    const valueToCheck = originalValue.replace(/\\(.)/g, "$1")

                    switch (matcherType) {
                      case "*=":
                        if (fullId.includes(valueToCheck)) {
                          matches = true
                        }

                        break

                      case "^=":
                        if (fullId.startsWith(valueToCheck)) {
                          matches = true
                        }

                        break

                      case "$=":
                        if (fullId.endsWith(valueToCheck)) {
                          matches = true
                        }

                        break

                      default:
                        console.warn(`Unexpected matcher type: ${matcherType}`)
                    }

                    if (matches) {
                      // For partial matching, we should replace with the minified full value
                      // since the HTML id will be completely replaced
                      this.setAttrSelectorValue(node, minifiedId)
                      // Change the matcher to exact match since we're now using the full minified value
                      node.matcher = "="
                      break
                    }
                  }
                }
              } else if (mappedValue) {
                // For exact matching (= or ~=), use direct replacement
                this.setAttrSelectorValue(node, mappedValue)
              }
            } else if (mappedValue) {
              // Default case (exact matching)
              this.setAttrSelectorValue(node, mappedValue)
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
      enter: (node) => {
        // Count using the unescaped version to match HTML class attributes
        const unescapedName = node.name.replace(/\\(.)/g, "$1")
        incrementAttrCount("class", unescapedName)
      },
    })

    walk(ast, {
      visit: "IdSelector",
      enter: (node) => {
        // Count using the unescaped version to match HTML id attributes
        const unescapedName = node.name.replace(/\\(.)/g, "$1")
        incrementAttrCount("id", unescapedName)
      },
    })

    walk(ast, {
      visit: "AttributeSelector",
      enter: (node) => {
        // Handle [class~="value"] and [class="value"] patterns (both quoted and unquoted)
        if (node.name?.name === "class" && node.value) {
          const value = this.getAttrSelectorValue(node)

          if (value) {
            // Count using the unescaped version to match HTML class attributes
            const unescapedValue = value.replace(/\\(.)/g, "$1")
            incrementAttrCount("class", unescapedValue)
          }
        }

        // Handle [id*="value"], [id^="value"], [id$="value"] patterns (both quoted and unquoted)
        if (node.name?.name === "id" && node.value) {
          const value = this.getAttrSelectorValue(node)

          if (value) {
            // Count using the unescaped version to match HTML id attributes
            const unescapedValue = value.replace(/\\(.)/g, "$1")
            incrementAttrCount("id", unescapedValue)
          }
        }
      },
    })
  }
}
