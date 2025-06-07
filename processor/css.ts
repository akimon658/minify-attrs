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

  /**
   * Unescapes CSS identifiers by removing backslash escaping.
   * CSS special characters like : [ ] ( ) , \ are escaped with backslashes in CSS
   * but appear unescaped in HTML class/id attributes.
   *
   * @param identifier The CSS identifier to unescape
   * @returns The unescaped identifier
   */
  private unescapeCSSIdentifier(identifier: string): string {
    return identifier.replace(/\\(.)/g, "$1")
  }

  /**
   * Finds the mapped value for a given attribute value.
   * Since countAttributes always stores unescaped values as keys,
   * we should always look up using unescaped values.
   *
   * @param attrMap The attribute mapping object
   * @param value The attribute value to find mapping for
   * @returns The mapped value if found, undefined otherwise
   */
  private findMappedValue(
    attrMap: Record<string, string> | undefined,
    value: string,
  ): string | undefined {
    if (!attrMap) {
      return undefined
    }

    return attrMap[this.unescapeCSSIdentifier(value)]
  }

  applyAttrMap(attrMap: AttrMap, file: string): string {
    const ast = parse(file)

    walk(ast, {
      visit: "ClassSelector",
      enter: (node) => {
        const mappedValue = this.findMappedValue(attrMap.class, node.name)

        if (mappedValue) {
          node.name = mappedValue
        }
      },
    })

    walk(ast, {
      visit: "IdSelector",
      enter: (node) => {
        const mappedValue = this.findMappedValue(attrMap.id, node.name)

        if (mappedValue) {
          node.name = mappedValue
        }
      },
    })

    walk(ast, {
      visit: "AttributeSelector",
      enter: (node) => {
        // Handle class attribute selectors (both quoted strings and unquoted identifiers)
        if (node.name?.name === "class" && node.value) {
          const originalValue = this.getAttrSelectorValue(node)

          if (originalValue) {
            const mappedValue = this.findMappedValue(
              attrMap.class,
              originalValue,
            )

            if (mappedValue) {
              this.setAttrSelectorValue(node, mappedValue)
            }
          }
        }

        // Handle id attribute selectors (both quoted strings and unquoted identifiers)
        if (node.name?.name === "id" && node.value) {
          const originalValue = this.getAttrSelectorValue(node)

          if (originalValue) {
            const mappedValue = this.findMappedValue(attrMap.id, originalValue)

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
                  const valueToCheck = this.unescapeCSSIdentifier(originalValue)

                  for (
                    const [fullId, minifiedId] of Object.entries(attrMap.id)
                  ) {
                    let matches = false

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
      // Always unescape CSS identifiers to match HTML attributes
      const unescapedValue = this.unescapeCSSIdentifier(value)

      if (!attrCount[type]) {
        attrCount[type] = {}
      }

      if (!attrCount[type][unescapedValue]) {
        attrCount[type][unescapedValue] = 0
      }

      attrCount[type][unescapedValue]++
    }

    walk(ast, {
      visit: "ClassSelector",
      enter: (node) => {
        incrementAttrCount("class", node.name)
      },
    })

    walk(ast, {
      visit: "IdSelector",
      enter: (node) => {
        incrementAttrCount("id", node.name)
      },
    })

    walk(ast, {
      visit: "AttributeSelector",
      enter: (node) => {
        // Handle [class~="value"] and [class="value"] patterns (both quoted and unquoted)
        if (node.name?.name === "class" && node.value) {
          const value = this.getAttrSelectorValue(node)

          if (value) {
            incrementAttrCount("class", value)
          }
        }

        // Handle [id*="value"], [id^="value"], [id$="value"] patterns (both quoted and unquoted)
        if (node.name?.name === "id" && node.value) {
          const value = this.getAttrSelectorValue(node)

          if (value) {
            incrementAttrCount("id", value)
          }
        }
      },
    })
  }
}
