import type { Component } from "vue";
import type { WorkbenchSidebarListSource } from "./primitives/sidebarListTypes.js";
import type {
  WorkbenchAreaContentTarget,
  WorkbenchPrimarySidebar,
  WorkbenchPrimarySidebarDescriptor,
} from "./types.js";

export type ResolvedWorkbenchPrimarySidebar =
  | { kind: "empty" }
  | { kind: "component"; component: Component }
  | {
      kind: "list";
      list: WorkbenchSidebarListSource<any>;
      component?: Component;
    };

export function isWorkbenchPrimarySidebarDescriptor(
  value: WorkbenchAreaContentTarget | undefined,
): value is WorkbenchPrimarySidebarDescriptor<any> {
  return (
    typeof value === "object" &&
    value !== null &&
    !("setup" in value) &&
    !("render" in value) &&
    !("template" in value) &&
    ("list" in value || "component" in value)
  );
}

export function resolveWorkbenchPrimarySidebar(
  value: WorkbenchAreaContentTarget | undefined,
): ResolvedWorkbenchPrimarySidebar {
  if (!value) {
    return { kind: "empty" };
  }
  if (!isWorkbenchPrimarySidebarDescriptor(value)) {
    return { kind: "component", component: value };
  }
  if (value.list) {
    return {
      kind: "list",
      list: value.list,
      ...(value.component ? { component: value.component } : {}),
    };
  }
  if (value.component) {
    return { kind: "component", component: value.component };
  }
  return { kind: "empty" };
}

export function hasWorkbenchPrimarySidebar(
  value: WorkbenchPrimarySidebar<any> | undefined,
): boolean {
  return resolveWorkbenchPrimarySidebar(value).kind !== "empty";
}

const listSetupKeys = new WeakMap<Function, number>();
let nextListSetupKey = 1;

export function resolveWorkbenchSidebarListKey(
  list: WorkbenchSidebarListSource<any>,
): string {
  if (typeof list !== "function") {
    return "object";
  }
  let key = listSetupKeys.get(list);
  if (key === undefined) {
    key = nextListSetupKey++;
    listSetupKeys.set(list, key);
  }
  return `fn:${key}`;
}
