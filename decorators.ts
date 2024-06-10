import { RootContainer } from "./root";
import type { Token } from "./token";
import type { Class } from "./types";
import { addHint, addOverride } from "./utils";

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

export function inject<T>(value: Token<T>, hint?: any): ParameterDecorator {
  return (
    target: Object,
    _key: string | symbol | undefined,
    parameterIndex: number
  ) => {
    addOverride(target as Class, parameterIndex, value);
    if (hint) addHint(target as Class, parameterIndex, hint);
  };
}

export function hint(hint?: any): ParameterDecorator {
  return (
    target: Object,
    _key: string | symbol | undefined,
    parameterIndex: number
  ) => {
    addHint(target as Class, parameterIndex, hint);
  };
}
