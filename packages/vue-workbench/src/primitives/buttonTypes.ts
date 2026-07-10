import type { Component } from "vue";

export type WorkbenchButtonVariant = "primary" | "secondary" | "danger" | "ghost";

export type WorkbenchButtonColors = {
  text?: string;
  background?: string;
  border?: string;
  hoverText?: string;
  hoverBackground?: string;
  hoverBorder?: string;
  activeText?: string;
  activeBackground?: string;
  activeBorder?: string;
  disabledText?: string;
  disabledBackground?: string;
  disabledBorder?: string;
};

export type WorkbenchButtonAction = {
  id: string;
  label: string;
  icon?: Component;
  title?: string;
  disabled?: boolean;
};
