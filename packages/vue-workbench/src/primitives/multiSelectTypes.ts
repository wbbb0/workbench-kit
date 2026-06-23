export type WorkbenchMultiSelectOption =
  | string
  | {
      value: string;
      label?: string;
      description?: string;
      disabled?: boolean;
    };

