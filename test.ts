import "@abraham/reflection";
import {
  AsyncInitializer,
  Container,
  ResolveMetadata,
  RootScope,
  Scope,
  Token,
  hint,
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

@injectable()
class Logger {
  name: string;
  constructor({ parent = Object, hint }: ResolveMetadata) {
    this.name = hint ?? parent.name;
  }

  log(tmp: string, ...params: any[]) {
    console.log(`[${this.name}] ${tmp}`, ...params);
  }
}

@refcounted()
class Refcounted {
  constructor(
    @inject(INPUT) public value: string,
    private logger: Logger
  ) {}
  id = crypto.randomUUID();
  async [AsyncInitializer]() {
    await Bun.sleep(100);
    this.logger.log("created refcounted", this.value, this.id);
  }
  async [Symbol.asyncDispose]() {
    await Bun.sleep(100);
    this.logger.log("dispose refcounted", this.value, this.id);
  }
}

@injectable()
class Injectable {
  constructor(
    @inject(INPUT) public value: string,
    private logger: Logger
  ) {}
  id = crypto.randomUUID();
  async [AsyncInitializer]() {
    await Bun.sleep(100);
    this.logger.log("created injectable", this.value, this.id);
  }
  async [Symbol.asyncDispose]() {
    await Bun.sleep(100);
    this.logger.log("dispose injectable", this.value, this.id);
  }
}

@singleton(SubContainer)
class Test {
  constructor(
    public refcounted: Refcounted,
    public injectable: Injectable,
    @inject(TEST) public value: string,
    public scope: MyScope,
    @hint("root") private logger: Logger
  ) {}
  async [AsyncInitializer]() {
    await Bun.sleep(100);
    this.logger.log("created test", this.value);
  }
  async [Symbol.asyncDispose]() {
    await Bun.sleep(100);
    this.logger.log("dispose test", this.value);
  }
}

await using SubScope1 = new MyScope();
await using SubScope2 = new MyScope();

RootScope.set(INPUT, "test");
SubScope1.set(TEST, "sub1");
await SubScope1.resolve(Test);
SubScope2.set(TEST, "sub2");
await SubScope2.resolve(Test);
