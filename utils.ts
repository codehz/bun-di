import type { Class, ClassOrToken } from "./types";

const cache = new WeakMap<Class, ClassOrToken[]>();
const overrides = new WeakMap<Class, [index: number, value: ClassOrToken][]>();

/** @internal */
export function addOverride(target: Class, index: number, value: ClassOrToken) {
  if (!overrides.has(target)) {
    overrides.set(target, []);
  }
  overrides.get(target)!.push([index, value]);
}

export function getDependencies(input: Class): ClassOrToken[] {
  if (cache.has(input)) {
    return cache.get(input)!;
  }
  const dependencies =
    (Reflect.getOwnMetadata("design:paramtypes", input) as any) ?? [];
  const override = overrides.get(input);
  if (override) {
    for (const [index, value] of override) {
      dependencies[index] = value;
    }
    overrides.delete(input);
  }
  cache.set(input, dependencies);
  return dependencies;
}


export function generateGraph(
  target: Class,
  result = new Set<string>(),
  visited = new Set<Class>()
): string[] {
  if (visited.has(target)) return [];
  visited.add(target);
  try {
    const params = getDependencies(target);
    for (const param of params) {
      result.add(
        `${JSON.stringify(target.name)} -> ${JSON.stringify(param.name)}`
      );
      if (typeof param === "function") {
        generateGraph(param, result, visited);
      }
    }
  } catch {}
  return [...result];
}