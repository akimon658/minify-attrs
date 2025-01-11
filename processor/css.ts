// @ts-types="@types/css-tree"
import { generate, parse, walk } from "css-tree"
import { type AttrCount, type AttrMap, type Processor } from "./processor.ts"

export default class CSSProcessor implements Processor {
  applyAttrMap(attrMap: AttrMap, file: string): string {
    const ast = parse(file)

    walk(ast, {
      visit: "ClassSelector",
      enter: (node) => node.name = attrMap.class[node.name],
    })

    walk(ast, {
      visit: "IdSelector",
      enter: (node) => node.name = attrMap.id[node.name],
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
  }
}
