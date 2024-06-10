import type { Class, ClassOrToken } from "./types";

export class DependencyError extends Error {
  constructor(
    public target: ClassOrToken,
    parent: Class | undefined,
    cause?: unknown
  ) {
    super(
      (typeof target === "function"
        ? `Could not resolve ${target.name}`
        : `Could not resolve TOKEN ${target.name}!`) +
        (parent ? ` from ${parent.name}` : ``),
      { cause }
    );
  }
}
