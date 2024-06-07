import "@abraham/reflection";
import { DefaultContainer, Token, inject, singleton } from ".";

const TEST = new Token<string>("test");

@singleton()
class Input {
  constructor(@inject(TEST) public value: string) {}
}

@singleton()
class Test {
  constructor(public input: Input) {
  }
}

DefaultContainer.set(TEST, "test");
const test = DefaultContainer.resolve(Test);
console.log(test);
