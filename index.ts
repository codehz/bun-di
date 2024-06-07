/// <reference types="@abraham/reflection" />

export class Token<T = any> {
  private declare __shape?: T;
  constructor(public name: string, public defaultValue?: T) {}
}

export const AsyncInitializer = Symbol("AsyncInitializer");

export type Class<T = any> = new (...args: any[]) => T;
export type ClassOrToken<T = any> = Class<T> | Token<T>;

export class ResolveError extends Error {
  constructor(public target: ClassOrToken) {
    super(
      typeof target === "function"
        ? `Could not resolve ${target.name}`
        : `Could not resolve TOKEN ${target.name}!`
    );
  }
}

const overrides: WeakMap<Class, [index: number, value: ClassOrToken][]> =
  new WeakMap();
function addOverride(target: Class, index: number, value: ClassOrToken) {
  if (!overrides.has(target)) {
    overrides.set(target, []);
  }
  overrides.get(target)!.push([index, value]);
}

export class Container {
  constructor(public name: string) {}
  cache: WeakMap<Class, ClassOrToken[]> = new WeakMap();
  singletons: Set<ClassOrToken> = new Set();
  injectables: Set<ClassOrToken> = new Set();

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

  getDependencies(input: Class): ClassOrToken[] {
    if (this.cache.has(input)) {
      return this.cache.get(input)!;
    }
    const dependencies =
      (Reflect.getMetadata("design:paramtypes", input) as any) ?? [];
    const override = overrides.get(input);
    if (override) {
      for (const [index, value] of override) {
        dependencies[index] = value;
      }
      overrides.delete(input);
    }
    this.cache.set(input, dependencies);
    return dependencies;
  }

  generateGraph(
    target: Class,
    result = new Set<string>(),
    visited = new Set<Class>()
  ): string[] {
    if (visited.has(target)) return [];
    visited.add(target);
    try {
      const params = this.getDependencies(target);
      for (const param of params) {
        result.add(
          `${JSON.stringify(target.name)} -> ${JSON.stringify(param.name)}`
        );
        if (typeof param === "function") {
          this.generateGraph(param, result, visited);
        }
      }
    } catch {}
    return [...result];
  }

  async resolve<T>(target: ClassOrToken<T>, scope: Scope): Promise<T> {
    switch (target) {
      case Scope:
        return scope as any;
      case Container:
        return this as any;
    }
    if (scope.values.has(target)) {
      return scope.values.get(target);
    }
    if (typeof target === "function") {
      if (this.singletons.has(target)) {
        const params = this.getDependencies(target);
        const result = new (target as any)(
          ...(await Array.fromAsync(
            params.map((param) => this.resolve<any>(param as any, scope))
          ))
        );
        if (AsyncInitializer in result) {
          await result[AsyncInitializer]();
        }
        scope.values.set(target, result);
        return result;
      }
      if (this.injectables.has(target)) {
        const params = this.getDependencies(target);
        const result = new (target as any)(
          ...(await Array.fromAsync(
            params.map((param) => this.resolve<any>(param as any, scope))
          ))
        );
        if (AsyncInitializer in result) {
          await result[AsyncInitializer]();
        }
        return result;
      }
    }
    if (target instanceof Token && target.defaultValue != null) {
      scope.values.set(target, target.defaultValue);
      return target.defaultValue;
    }
    if (scope.parent) {
      return await scope.parent.container.resolve(target, scope.parent);
    }
    throw new ResolveError(target);
  }
}

export class Scope {
  constructor(public container: Container, public parent?: Scope) {}
  values: Map<ClassOrToken, any> = new Map();

  set(key: ClassOrToken, value: any) {
    this.values.set(key, value);
  }

  async resolve<T>(target: ClassOrToken<T>): Promise<T> {
    return await this.container.resolve(target, this);
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

export const RootContainer = new Container("root");
export const RootScope = new Scope(RootContainer);

export function singleton(container = RootContainer): ClassDecorator {
  return (target: any) => {
    container.registerSingleton(target);
    return target;
  };
}

export function inject<T>(value: Token<T>): ParameterDecorator {
  return (
    target: Object,
    _key: string | symbol | undefined,
    parameterIndex: number
  ) => {
    addOverride(target as Class, parameterIndex, value);
  };
}
