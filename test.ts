import "@abraham/reflection";
import {
  AsyncInitializer,
  Container,
  RootScope,
  Scope,
  Token,
  inject,
  singleton,
} from ".";

const INPUT = new Token<string>("input");
const TEST = new Token<string>("test", "default");

const SubContainer = new Container("sub");

class MyScope extends Scope {
  constructor() {
    super(SubContainer, RootScope);
  }
}

const SubScope1 = new MyScope();
const SubScope2 = new MyScope();

@singleton()
class Input {
  constructor(@inject(INPUT) public value: string) {}
  async [AsyncInitializer]() {
    await Bun.sleep(100);
  }
}

@singleton(SubContainer)
class Test {
  constructor(
    public input: Input,
    @inject(TEST) public value: string,
    public scope: MyScope
  ) {}
}

RootScope.set(INPUT, "test");
SubScope1.set(TEST, "sub1");
const test1 = await SubScope1.resolve(Test);
console.log(test1);
SubScope2.set(TEST, "sub2");
const test2 = await SubScope2.resolve(Test);
console.log(test2);
