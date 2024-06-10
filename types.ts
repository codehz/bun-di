import type { LinkTag } from "./internal";
import type { LinkSource } from "./symbols";
import type { Token } from "./token";

export type Class<T = any> = new (...args: any[]) => T;
export type ClassOrToken<T = any> = Class<T> | Token<T>;

export type ScopeResolveOptions = {
  signal?: AbortSignal;
  /** @internal */
  [LinkSource]?: LinkTag;
};

export type ContainerResolveResult = "singleton" | "refcounted" | "injectable";
