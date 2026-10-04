import type { Component } from "vue";
import type { WorkbenchButtonVariant } from "./buttonTypes.js";

export type WorkbenchToolbarAction = {
  id: string;
  label: string;
  icon?: Component;
  disabled?: boolean;
  title?: string;
  /** 较大的值优先保留在工具栏，菜单和工具栏均保持原始顺序。 */
  priority?: number;
  variant?: WorkbenchButtonVariant;
};

/** 保留高优先级操作，预留溢出菜单按钮的宽度。 */
export function fitToolbarActions(actions: readonly WorkbenchToolbarAction[], widths: readonly number[], available: number, moreWidth: number, gap = 4): Set<string> {
  const total = widths.reduce((sum, width) => sum + width, 0) + Math.max(0, actions.length - 1) * gap;
  if (total <= available) return new Set(actions.map(action => action.id));
  let remaining = Math.max(0, available - moreWidth);
  const visible = new Set<string>();
  const ranked = actions.map((action, index) => ({ action, index })).sort((a, b) => (b.action.priority ?? 0) - (a.action.priority ?? 0) || a.index - b.index);
  for (const { action, index } of ranked) {
    const width = (widths[index] ?? 0) + gap;
    if (width <= remaining) {
      visible.add(action.id);
      remaining -= width;
    }
  }
  return visible;
}
