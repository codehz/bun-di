import "@abraham/reflection";
import {
  AsyncInitializer,
  Container,
  RootScope,
  Scope,
  Token,
  inject,
  injectable,
  refcounted,
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

@refcounted()
class Refcounted {
  constructor(@inject(INPUT) public value: string) {}
  id = crypto.randomUUID();
  async [AsyncInitializer]() {
    await Bun.sleep(100);
    console.log("created refcounted", this.value, this.id);
  }
  async [Symbol.asyncDispose]() {
    await Bun.sleep(100);
    console.log("dispose refcounted", this.value, this.id);
  }
}

@injectable()
class Injectable {
  constructor(@inject(INPUT) public value: string) {}
  id = crypto.randomUUID();
  async [AsyncInitializer]() {
    await Bun.sleep(100);
    console.log("created injectable", this.value, this.id);
  }
  async [Symbol.asyncDispose]() {
    await Bun.sleep(100);
    console.log("dispose injectable", this.value, this.id);
  }
}

@singleton(SubContainer)
class Test {
  constructor(
    public refcounted: Refcounted,
    public injectable: Injectable,
    @inject(TEST) public value: string,
    public scope: MyScope
  ) {}
  async [AsyncInitializer]() {
    await Bun.sleep(100);
    console.log("created test", this.value);
  }
  async [Symbol.asyncDispose]() {
    await Bun.sleep(100);
    console.log("dispose test", this.value);
  }
}

const controller = new AbortController();

RootScope.set(INPUT, "test");
SubScope1.set(TEST, "sub1");
const test1 = await SubScope1.resolve(Test, controller);
// console.log(test1);
SubScope2.set(TEST, "sub2");
const test2 = await SubScope2.resolve(Test, controller);
// console.log(test2);

controller.abort("test");
