import CSSProcessor from "./css.ts"
import HTMLProcessor from "./html.ts"

export type AttrCount = {
  [attribute: string]: {
    [value: string]: number
  }
}

export type AttrMap = {
  [attribute: string]: {
    [value: string]: string
  }
}

export interface Processor {
  applyAttrMap(attrMap: AttrMap, file: string): string
  countAttributes(attrCount: AttrCount, file: string): void
}

export const attrsToMinify = ["class", "id"]

export function getProcessor(extension: string): Processor | null {
  switch (extension) {
    case ".html":
      return new HTMLProcessor()
    case ".css":
      return new CSSProcessor()
    default:
      return null
  }
}
