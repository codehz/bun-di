import type { ClassOrToken } from "./types";

export class ResolveError extends Error {
  constructor(public target: ClassOrToken, cause?: unknown) {
    super(
      typeof target === "function"
        ? `Could not resolve ${target.name}`
        : `Could not resolve TOKEN ${target.name}!`,
      { cause }
    );
  }
}
