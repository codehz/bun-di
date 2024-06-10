export class Token<T = any> {
  constructor(public name: string, public defaultValue?: T) {}
}
