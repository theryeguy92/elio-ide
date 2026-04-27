declare module 'ansi-to-html' {
  interface Options {
    fg?: string
    bg?: string
    newline?: boolean
    escapeXML?: boolean
    stream?: boolean
  }
  class Convert {
    constructor(options?: Options)
    toHtml(input: string): string
  }
  export = Convert
}
