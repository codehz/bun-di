import type { LinkTag } from "./internal";
import type { LinkSource } from "./symbols";

export class Token<T = any> {
  constructor(public name: string, public defaultValue?: T) {}
}

export type Class<T = any> = new (...args: any[]) => T;
export type ClassOrToken<T = any> = Class<T> | Token<T>;

export type ScopeResolveOptions = {
  signal?: AbortSignal;
  /** @internal */
  [LinkSource]?: LinkTag;
};

export type ContainerResolveResult = "singleton" | "refcounted" | "injectable";
