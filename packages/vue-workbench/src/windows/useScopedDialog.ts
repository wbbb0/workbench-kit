import { nextTick, onBeforeUnmount, onDeactivated, useId } from "vue";
import type { WorkbenchDialogDefinition } from "./types.js";
import { useWorkbenchWindows } from "./useWorkbenchWindows.js";

/** 页面只拥有窗口生命周期；渲染、操作和尺寸全部交给 kit。 */
export function useScopedDialog(
  defaults: Partial<WorkbenchDialogDefinition> = {},
) {
  const windows = useWorkbenchWindows();
  const ownerId = useId();
  let sequence = 0;
  let current: { id: string; opener?: HTMLElement } | undefined;
  let revision = 0;
  function close() {
    revision++;
    const entry = current;
    current = undefined;
    if (!entry) return;
    windows.close(entry.id, { reason: "dismiss", values: {} });
  }
  async function open(definition: WorkbenchDialogDefinition) {
    close();
    const version = revision;
    const entry = {
      id: ownerId + "-dialog-" + ++sequence,
      opener:
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : undefined,
    };
    current = entry;
    const result = await windows.openDialog({
      ...defaults,
      ...definition,
      id: entry.id,
    });
    if (current !== entry) return;
    current = undefined;
    await nextTick();
    if (revision !== version) return;
    if (entry.opener?.isConnected) entry.opener.focus();
    return result;
  }
  onDeactivated(() => close());
  onBeforeUnmount(() => close());
  return {
    open,
    close,
    get isOpen() {
      return !!current;
    },
  };
}
