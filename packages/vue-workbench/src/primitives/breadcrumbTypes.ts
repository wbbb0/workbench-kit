export type WorkbenchBreadcrumbItem = {
  label: string;
  href?: string;
  /** 受控导航回调；提供时优先于 href 的默认跳转。 */
  onSelect?: () => void;
};
