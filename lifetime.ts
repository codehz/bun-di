type Destructor = () => Promise<void> | void;

export class Lifetime {
  #destructors: Destructor[];
  constructor(initial: Destructor) {
    this.#destructors = [initial];
  }

  addDestructor(destructor: Destructor) {
    this.#destructors.push(destructor);
  }

  /** @internal */
  async destruct() {
    for (const destructor of this.#destructors) {
      await destructor();
    }
  }
  /** @internal */
  registerAbortSignal(signal: AbortSignal) {
    signal.addEventListener("abort", () => this.destruct());
  }
}

/** @internal */
export class RefcountedLifetime extends Lifetime {
  #refcount = 1;
  constructor(initial: Destructor) {
    super(initial);
  }
  addRef() {
    ++this.#refcount;
  }
  destruct(): Promise<void> {
    if (--this.#refcount === 0) {
      return super.destruct();
    }
    return Promise.resolve();
  }
}
