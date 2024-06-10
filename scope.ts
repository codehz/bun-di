import type { Container } from "./container";
import { DependencyError } from "./error";
import {
  addLink,
  addLinkByKey,
  addRefcountedCount,
  bindAbortSignal,
  destoryLifetime,
  destroyLinks,
  LinkTag,
  registerLifetime,
} from "./internal";
import { Lifetime, RefcountedLifetime } from "./lifetime";
import { AsyncInitializer, ParentInfo } from "./symbols";
import { Token } from "./token";
import {
  ResolveMetadata,
  type Class,
  type ClassOrToken,
  type ParentMetadata,
  type ScopeResolveOptions,
} from "./types";
import { getDependencies, getHint } from "./utils";

async function disposePromise(obj: Promise<any>) {
  if (Bun.peek.status(obj) === "fulfilled") {
    const instance = Bun.peek(obj);
    await dispose(instance);
  } else {
    console.warn("Skiped disposing", obj);
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
  constructor(
    public container: Container,
    public parent?: Scope
  ) {}
  #singletons = new Map<ClassOrToken, Promise<any>>();
  #refcounteds = new Map<ClassOrToken, Promise<any>>();
  #injectables = new Set<Promise<any>>();

  set<T>(key: ClassOrToken<T>, value: T) {
    this.#singletons.set(key, Promise.resolve(value));
  }

  async #createInstance<T = any>(
    target: Class<T>,
    lifetime: Lifetime,
    tag: LinkTag,
    parent: ParentMetadata | undefined
  ): Promise<T> {
    const params = getDependencies(target);
    const instance = new (target as any)(
      ...(await Promise.all(
        params.map((param, idx) => {
          switch (param) {
            case this.constructor:
              return this as any;
            case this.container.constructor:
              return this.container as any;
            case Lifetime:
              return lifetime;
            case ResolveMetadata: {
              const metadata = new ResolveMetadata();
              metadata.parent = parent?.class;
              metadata.hint = parent?.hint;
              return metadata;
            }
            default:
              return this.resolve<any>(param as any, {
                [ParentInfo]: {
                  tag,
                  class: target,
                  hint: getHint(target, idx),
                },
              });
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
    let { signal, [ParentInfo]: parent } = options;
    signal?.throwIfAborted();
    if (this.#singletons.has(target)) {
      return this.#singletons.get(target)!;
    } else if (this.#refcounteds.has(target)) {
      const result = this.#refcounteds.get(target)!;
      if (parent) addLinkByKey(parent.tag, result);
      else if (signal) bindAbortSignal(result, signal);
      else throw new Error("No signal provided for refcounted instance");
      addRefcountedCount(result);
      return result;
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
            const lifetime = new Lifetime(async () => {
              if (this.#singletons.delete(target)) {
                await disposePromise(result);
                await destroyLinks(tag);
              }
            });
            const result = this.#createInstance(target, lifetime, tag, parent);
            registerLifetime(result, lifetime);
            lifetime.registerAbortSignal(signal);
            this.#singletons.set(target, result);
            return await result;
          } else if (type === "refcounted") {
            const lifetime = new RefcountedLifetime(async () => {
              if (this.#refcounteds.delete(target)) {
                await disposePromise(result);
                await destroyLinks(tag);
              }
            });
            const result = this.#createInstance(target, lifetime, tag, parent);
            if (parent) addLink(parent.tag, lifetime);
            registerLifetime(result, lifetime);
            lifetime.registerAbortSignal(signal);
            this.#refcounteds.set(target, result);
            return await result;
          } else {
            const lifetime = new RefcountedLifetime(async () => {
              if (this.#injectables.delete(result)) {
                await disposePromise(result);
                await destroyLinks(tag);
              }
            });
            const result = this.#createInstance(target, lifetime, tag, parent);
            if (parent) addLink(parent.tag, lifetime);
            lifetime.registerAbortSignal(signal);
            this.#injectables.add(result);
            return await result;
          }
        } catch (e) {
          controller.abort(e);
          throw new DependencyError(target, parent?.class, e);
        }
      }
    }
    if (this.parent)
      try {
        return await this.parent.resolve(target, options);
      } catch (e) {
        throw new DependencyError(target, parent?.class, e);
      }
    throw new DependencyError(target, parent?.class);
  }

  async [Symbol.asyncDispose]() {
    for (const value of [...this.#singletons.values()].reverse()) {
      await destoryLifetime(value);
    }
    this.#singletons.clear();
  }
}
