import { RefcountedLifetime, type Lifetime } from "./lifetime";

export class LinkTag {
  constructor(public name: string) {}
}

const links = new WeakMap<LinkTag, Lifetime[]>();
const lifetimes = new WeakMap<WeakKey, Lifetime>();

export async function destoryLifetime(key: WeakKey) {
  const lifetime = lifetimes.get(key);
  if (lifetime) await lifetime.destruct();
}

export function registerLifetime(key: WeakKey, destructor: Lifetime) {
  lifetimes.set(key, destructor);
}

export function addLink(key: LinkTag, value: Lifetime) {
  if (!links.has(key)) {
    links.set(key, []);
  }
  links.get(key)!.unshift(value);
}

export function bindAbortSignal(token: WeakKey, signal: AbortSignal) {
  const destructor = lifetimes.get(token);
  if (destructor) signal.addEventListener("abort", () => destructor.destruct());
}

export function addLinkByKey(key: LinkTag, token: WeakKey) {
  const destructor = lifetimes.get(token);
  if (destructor) addLink(key, destructor);
}

export function addRefcountedCount(token: WeakKey) {
  const destructor = lifetimes.get(token);
  if (destructor instanceof RefcountedLifetime) destructor.addRef();
}

export async function destroyLinks(key: LinkTag) {
  const values = links.get(key);
  if (values) {
    links.delete(key);
    await Promise.all(values.map((value) => value.destruct()));
  }
}
