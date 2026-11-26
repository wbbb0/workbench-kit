import type { Component, ComputedRef, Ref } from "vue";

export type WorkbenchSidebarListItem = {
  id?: string | number;
  title: string;
  subtitle?: string | null;
  meta?: string | number | null;
  selected?: boolean;
  disabled?: boolean;
  icon?: Component;
  iconClass?: string;
  disclosure?: boolean;
  ariaCurrent?: "page" | "step" | "location" | "date" | "time" | "true" | boolean;
  dense?: boolean;
  multiline?: boolean;
  divided?: boolean;
  navigate?: boolean;
  attrs?: Record<string, unknown>;
};

export type WorkbenchSidebarListConfig<TItem = WorkbenchSidebarListItem> = {
  title?: string;
  ariaLabel?: string;
  role?: "navigation" | "region" | "list";
  items: readonly TItem[];
  loading?: boolean;
  emptyMessage?: string;
  showHeader?: boolean;
  divided?: boolean;
  dense?: boolean;
  multiline?: boolean;
  navigate?: boolean;
  itemKey?: (item: TItem, index: number) => string | number;
  onSelect?: (item: TItem, index: number) => void;
};

export type WorkbenchSidebarListSetup<TItem = WorkbenchSidebarListItem> = () =>
  | WorkbenchSidebarListConfig<TItem>
  | Ref<WorkbenchSidebarListConfig<TItem>>
  | ComputedRef<WorkbenchSidebarListConfig<TItem>>;

export type WorkbenchSidebarListSource<TItem = WorkbenchSidebarListItem> =
  | WorkbenchSidebarListConfig<TItem>
  | WorkbenchSidebarListSetup<TItem>;
