declare module 'inngest' {
  export class Inngest {
    constructor(config: { id: string })
    createFunction: (...args: any[]) => any
    send: (...args: any[]) => any
  }
}

declare module 'inngest/next' {
  export const serve: (...args: any[]) => any
}
