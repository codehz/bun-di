/// <reference types="@abraham/reflection" />

export class Token<T = any> {
  private declare __shape?: T;
  symbol: Symbol;
  constructor(tag?: string) {
    this.symbol = Symbol(tag);
  }
}

export const AsyncInitializer = Symbol("AsyncInitializer");

export type Class<T = any> = new (...args: any[]) => T;
export type ClassOrToken<T = any> = Class<T> | Token<T>;

export class Container {
  constructor(public parent?: Container) {}
  cache: WeakMap<Class, ClassOrToken[]> = new WeakMap();
  overrides: Map<Class, [index: number, value: ClassOrToken][]> = new Map();
  singletons: Set<ClassOrToken> = new Set();
  injectables: Set<ClassOrToken> = new Set();
  values: Map<ClassOrToken, any> = new Map();

  registerSingleton(target: Class, params?: ClassOrToken[]): void;
  registerSingleton(target: Token, params: ClassOrToken[]): void;
  registerSingleton(target: ClassOrToken, params?: ClassOrToken[]) {
    if (params) {
      this.cache.set(target as Class, params);
    }
    this.singletons.add(target);
  }
  registerInjectable(target: Class, params?: ClassOrToken[]): void;
  registerInjectable(target: Token, params: ClassOrToken[]): void;
  registerInjectable(target: ClassOrToken, params?: ClassOrToken[]) {
    if (params) {
      this.cache.set(target as Class, params);
    }
    this.injectables.add(target);
  }
  addOverride(target: Class, index: number, value: ClassOrToken) {
    if (!this.overrides.has(target)) {
      this.overrides.set(target, []);
    }
    this.overrides.get(target)!.push([index, value]);
  }

  set(key: ClassOrToken, value: any) {
    this.values.set(key, value);
  }

  #getParams(input: Class): ClassOrToken[] {
    if (this.cache.has(input)) {
      return this.cache.get(input)!;
    }
    const params =
      (Reflect.getMetadata("design:paramtypes", input) as any) ?? [];
    const overrides = this.overrides.get(input);
    if (overrides) {
      for (const [index, override] of overrides) {
        params[index] = override;
      }
      this.overrides.delete(input);
    }
    this.cache.set(input, params);
    return params;
  }

  async resolve<T>(target: ClassOrToken<T>): Promise<T> {
    if (this.values.has(target)) {
      return this.values.get(target);
    }
    if (typeof target === "function") {
      if (this.singletons.has(target)) {
        const params = this.#getParams(target);
        const result = new (target as any)(
          ...(await Array.fromAsync(
            params.map((param) => this.resolve<any>(param as any))
          ))
        );
        if (AsyncInitializer in result) {
          await result[AsyncInitializer]();
        }
        this.values.set(target, result);
        return result;
      }
      if (this.injectables.has(target)) {
        const params = this.#getParams(target);
        const result = new (target as any)(
          ...(await Array.fromAsync(
            params.map((param) => this.resolve<any>(param as any))
          ))
        );
        if (AsyncInitializer in result) {
          await result[AsyncInitializer]();
        }
        return result;
      }
    }
    if (this.parent) return this.parent.resolve(target);
    if (target instanceof Token) {
      throw new Error(`Could not resolve TOKEN "${target.symbol.description}"`);
    }
    throw new Error(`Could not resolve ${target}`);
  }

  async [Symbol.asyncDispose]() {
    for (const value of this.values.values()) {
      if (Symbol.asyncDispose in value) {
        await value[Symbol.asyncDispose]();
      }
    }
    this.values.clear();
  }
}

export const DefaultContainer = new Container();

export function singleton(container = DefaultContainer): ClassDecorator {
  return (target: any) => {
    container.registerSingleton(target);
    return target;
  };
}

export function inject(
  value: ClassOrToken,
  container = DefaultContainer
): ParameterDecorator {
  return (
    target: Object,
    propertyKey: string | symbol | undefined,
    parameterIndex: number
  ) => {
    container.addOverride(target as Class, parameterIndex, value);
  };
}
