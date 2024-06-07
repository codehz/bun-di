import "@abraham/reflection";
import { AsyncInitializer, DefaultContainer, Token, inject, singleton } from ".";

const TEST = new Token<string>("test");

@singleton()
class Input {
  constructor(@inject(TEST) public value: string) {}
  async [AsyncInitializer]() {
    await Bun.sleep(100);
  }
}

@singleton()
class Test {
  constructor(public input: Input) {
  }
}

DefaultContainer.set(TEST, "test");
const test = await DefaultContainer.resolve(Test);
console.log(test);
