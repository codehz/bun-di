import type { Class, ContainerResolveResult } from "./types";

export class Container {
  constructor(public name: string) {}
  #singletons: Set<Class> = new Set();
  #refcounteds: Set<Class> = new Set();
  #injectables: Set<Class> = new Set();

  registerSingleton(target: Class) {
    this.#singletons.add(target);
  }
  registerRefcounted(target: Class) {
    this.#refcounteds.add(target);
  }
  registerInjectable(target: Class) {
    this.#injectables.add(target);
  }

  resolve(target: Class): ContainerResolveResult | null {
    if (this.#singletons.has(target)) return "singleton";
    if (this.#refcounteds.has(target)) return "refcounted";
    if (this.#injectables.has(target)) return "injectable";
    return null;
  }
}
