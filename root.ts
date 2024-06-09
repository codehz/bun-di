import { Container } from "./container";
import { Scope } from "./scope";

export const RootContainer = new Container("root");
export const RootScope = new Scope(RootContainer);
