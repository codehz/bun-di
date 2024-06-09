export class LinkTag {
  constructor(public name: string) {}
}

type Destructor = () => Promise<void> | void;

const links = new WeakMap<LinkTag, Destructor[]>();
const destructors = new Map<WeakKey, Destructor>();

export function registerDestructor(key: WeakKey, destructor: Destructor) {
  destructors.set(key, destructor);
}

export function addLink(key: LinkTag, value: Destructor) {
  if (!links.has(key)) {
    links.set(key, []);
  }
  links.get(key)!.push(value);
}

export function addLinkByKey(key: LinkTag, token: WeakKey) {
  const destructor = destructors.get(token);
  if (destructor) addLink(key, destructor);
}

export async function destroyLinks(key: LinkTag) {
  const values = links.get(key);
  if (values) {
    links.delete(key);
    await Promise.all(values.map((value) => value()));
  }
}
