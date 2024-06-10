import { RootContainer } from "./root";
import type { Class } from "./types";
import type { Token } from "./token";
import { addOverride } from "./utils";

export function singleton(container = RootContainer): ClassDecorator {
  return (target: any) => {
    container.registerSingleton(target);
    return target;
  };
}

export function refcounted(container = RootContainer): ClassDecorator {
  return (target: any) => {
    container.registerRefcounted(target);
    return target;
  };
}

export function injectable(container = RootContainer): ClassDecorator {
  return (target: any) => {
    container.registerInjectable(target);
    return target;
  };
}

export function inject<T>(value: Token<T>): ParameterDecorator {
  return (
    target: Object,
    _key: string | symbol | undefined,
    parameterIndex: number
  ) => {
    addOverride(target as Class, parameterIndex, value);
  };
}
