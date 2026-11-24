import type { ComputedRef, InjectionKey } from "vue";

export interface WorkbenchColumnPage {
  key: string;
  title: string;
}

export const mobilePageColumns: InjectionKey<ComputedRef<boolean>> =
  Symbol("mobilePageColumns");

export function pageColumnCapacity(width: number, minimum: number) {
  return Math.max(1, Math.floor((width + 1) / (minimum + 1)));
}
