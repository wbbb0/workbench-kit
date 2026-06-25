export type WorkbenchDynamicTabItem = {
  id: string;
  label: string;
  title?: string;
  disabled?: boolean;
  closable?: boolean;
  meta?: string | number;
};
