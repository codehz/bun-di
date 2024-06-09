import type { Container } from "./container";
import { ResolveError } from "./error";
import {
  addLink,
  addLinkByKey,
  destroyLinks,
  LinkTag,
  registerDestructor,
} from "./internal";
import {
  Token,
  type Class,
  type ClassOrToken,
  type ScopeResolveOptions,
} from "./types";
import { AsyncInitializer, LinkSource } from "./symbols";
import { getDependencies } from "./utils";

async function disposePromise(obj: Promise<any>) {
  if (Bun.peek.status(obj) === "fulfilled") {
    const instance = Bun.peek(obj);
    await dispose(instance);
  } else {
    console.warn("Skiped disposing promise", obj);
  }
}

async function dispose(obj: any) {
  if (Symbol.asyncDispose in obj) {
    await obj[Symbol.asyncDispose]();
  } else if (Symbol.dispose in obj) {
    obj[Symbol.dispose]();
  }
}

export class Scope {
  constructor(public container: Container, public parent?: Scope) {}
  #singletons = new Map<ClassOrToken, Promise<any>>();
  #refcounteds = new Map<ClassOrToken, [value: Promise<any>, rc: number]>();
  #injectables = new Set<Promise<any>>();

  set<T>(key: ClassOrToken<T>, value: T) {
    this.#singletons.set(key, Promise.resolve(value));
  }

  async #createInstance<T = any>(
    target: Class<T>,
    signal: AbortSignal,
    tag: LinkTag
  ): Promise<T> {
    const params = getDependencies(target);
    const instance = new (target as any)(
      ...(await Promise.all(
        params.map((param) => {
          switch (param) {
            case this.constructor:
              return this as any;
            case this.container.constructor:
              return this.container as any;
            case AbortSignal:
              return signal;
            default:
              return this.resolve<any>(param as any, { [LinkSource]: tag });
          }
        })
      ))
    );
    if (AsyncInitializer in instance) {
      await instance[AsyncInitializer]();
    }
    return instance;
  }

  async resolve<T>(
    target: ClassOrToken<T>,
    options: ScopeResolveOptions = {}
  ): Promise<T> {
    let { signal, [LinkSource]: parent } = options;
    signal?.throwIfAborted();
    if (this.#singletons.has(target)) {
      return this.#singletons.get(target)!;
    } else if (this.#refcounteds.has(target)) {
      const result = this.#refcounteds.get(target)!;
      result[1]++;
      if (parent) addLinkByKey(parent, result[0]);
      return result[0];
    }
    if (target instanceof Token) {
      if (target.defaultValue != null) {
        this.#singletons.set(target, Promise.resolve(target.defaultValue));
        return Promise.resolve(target.defaultValue);
      }
    } else {
      const type = this.container.resolve(target);
      if (type) {
        const controller = new AbortController();
        try {
          // It is posible to use AbortSignal.any, but the api is broken in Bun
          signal?.addEventListener("abort", (e) => {
            controller.abort((e.target as AbortSignal).reason);
          });
          signal ??= controller.signal;
          const tag = new LinkTag(target.name);
          if (type === "singleton") {
            const result = this.#createInstance(target, signal, tag);
            signal.addEventListener("abort", async () => {
              this.#singletons.delete(target);
              await disposePromise(result);
              await destroyLinks(tag);
            });
            this.#singletons.set(target, result);
            return await result;
          } else if (type === "refcounted") {
            const destroy = async () => {
              const refcounted = this.#refcounteds.get(target);
              if (refcounted && --refcounted[1] <= 0) {
                this.#refcounteds.delete(target);
                await disposePromise(result);
                await destroyLinks(tag);
              }
            };
            const result = this.#createInstance(target, signal, tag);
            if (parent) addLink(parent, destroy);
            registerDestructor(result, destroy);
            signal.addEventListener("abort", destroy);
            this.#refcounteds.set(target, [result, 1]);
            return await result;
          } else {
            const destroy = async () => {
              if (this.#injectables.delete(result)) {
                await disposePromise(result);
                await destroyLinks(tag);
              }
            };
            const result = this.#createInstance(target, signal, tag);
            if (parent) addLink(parent, destroy);
            signal.addEventListener("abort", destroy);
            this.#injectables.add(result);
            return await result;
          }
        } catch (e) {
          controller.abort(e);
          throw new ResolveError(target, e);
        }
      }
    }
    if (this.parent)
      try {
        return await this.parent.resolve(target, options);
      } catch (e) {
        throw new ResolveError(target, e);
      }
    throw new ResolveError(target);
  }

  async [Symbol.asyncDispose]() {
    for (const value of this.#singletons.values()) {
      await dispose(await value);
    }
    this.#singletons.clear();
    for (const [value] of this.#refcounteds.values()) {
      await dispose(await value);
    }
    this.#refcounteds.clear();
    for (const value of this.#injectables.values()) {
      await dispose(await value);
    }
    this.#injectables.clear();
  }
}
