import type { LinkTag } from "./internal";
import type { ParentInfo } from "./symbols";
import type { Token } from "./token";

export type Class<T = any> = new (...args: any[]) => T;
export type ClassOrToken<T = any> = Class<T> | Token<T>;

export type ScopeResolveOptions = {
  signal?: AbortSignal;
  /** @internal */
  [ParentInfo]?: ParentMetadata;
};

export type ParentMetadata = {
  tag: LinkTag;
  class: Class;
  hint?: any;
};

export type ContainerResolveResult = "singleton" | "refcounted" | "injectable";

export class ResolveMetadata {
  parent?: Class;
  hint?: any;
}
