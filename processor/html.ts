import { DOMParser } from "@b-fuze/deno-dom"
import CSSProcessor from "./css.ts"
import {
  type AttrCount,
  type AttrMap,
  attrsToMinify,
  type Processor,
} from "./processor.ts"

export default class HTMLProcessor implements Processor {
  cssProcessor = new CSSProcessor()
  parser = new DOMParser()

  applyAttrMap(attrMap: AttrMap, file: string): string {
    const document = this.parser.parseFromString(file, "text/html")
    const elements = document.querySelectorAll("*")

    for (const element of elements) {
      if (element.tagName === "STYLE") {
        const styleContent = element.textContent

        if (styleContent) {
          element.textContent = this.cssProcessor.applyAttrMap(
            attrMap,
            styleContent,
          )
        }

        continue
      }

      for (const attr of element.attributes) {
        if (!attrsToMinify.includes(attr.name)) {
          continue
        }

        if (!attrMap[attr.name]) {
          continue
        }

        attr.value = attr.value
          .split(" ")
          .map((value) => attrMap[attr.name][value] || value)
          .join(" ")
      }
    }

    return `<!DOCTYPE html>${document.documentElement?.outerHTML || ""}`
  }

  countAttributes(attrCount: AttrCount, file: string): void {
    const document = this.parser.parseFromString(file, "text/html")
    const elements = document.querySelectorAll("*")

    for (const element of elements) {
      if (element.tagName === "STYLE") {
        const styleContent = element.textContent

        if (styleContent) {
          this.cssProcessor.countAttributes(attrCount, styleContent)
        }
        continue
      }

      for (const attr of element.attributes) {
        if (!attrsToMinify.includes(attr.name)) {
          continue
        }

        if (!attrCount[attr.name]) {
          attrCount[attr.name] = {}
        }

        const values = attr.value.split(" ")

        for (const value of values) {
          if (!attrCount[attr.name][value]) {
            attrCount[attr.name][value] = 0
          }

          attrCount[attr.name][value]++
        }
      }
    }
  }
}
