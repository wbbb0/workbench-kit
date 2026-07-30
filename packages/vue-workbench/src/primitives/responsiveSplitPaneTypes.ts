export type ResponsiveSplitPaneCompactMode = "stacked" | "tabs";
export type ResponsiveSplitPaneOrientation = "horizontal" | "vertical";

export type ResponsiveSplitPaneItem = {
  /** Stable slot, active-pane, and persisted-size identity. */
  id: string;
  /** Visible compact-tab label and fallback separator name. */
  label?: string;
  /** Optional tab tooltip and preferred separator name. */
  title?: string;
  /** Prevents compact-tab activation without hiding desktop or stacked content. */
  tabDisabled?: boolean;
  /** Preferred size in pixels on the normal layout axis. */
  defaultSize?: number;
  /** Preferred size in pixels for vertical stacked compact layout. */
  defaultCompactSize?: number;
  minSize?: number;
  maxSize?: number;
  /** Shared priority when a directional priority is not provided. */
  sizePriority?: number;
  /** Higher values receive automatically available space first. */
  growPriority?: number;
  /** Higher values are protected from automatic compression longer. */
  shrinkPriority?: number;
  /** Relative automatic-growth weight. Zero does not disable sash resizing. */
  grow?: number;
};

export type ResponsiveSplitPaneSlotScope = {
  pane: ResponsiveSplitPaneItem;
  compact: boolean;
  stacked: boolean;
  active: boolean;
};
