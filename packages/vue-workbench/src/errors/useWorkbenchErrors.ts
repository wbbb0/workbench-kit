import { reactive } from "vue";
import { useWorkbenchWindows } from "../windows/useWorkbenchWindows.js";
import type { WorkbenchWindowManager } from "../windows/windowService.js";
import WorkbenchErrorPanel from "./WorkbenchErrorPanel.vue";
import type { WorkbenchErrorInfo, WorkbenchErrorOptions } from "./types.js";

type ErrorIdentity = Pick<WorkbenchErrorInfo, "code" | "message" | "requestId"> & { id?: string };
const errorContextKind = "workbench-error";

function readIdentity(value: string): ErrorIdentity | undefined {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && "message" in parsed && typeof parsed.message === "string"
      ? parsed as ErrorIdentity
      : undefined;
  } catch {
    return undefined;
  }
}

/** Adapter seam for hosts with an explicit window service. */
export function createWorkbenchErrors(windows: WorkbenchWindowManager) {
  function show(info: WorkbenchErrorInfo, options: WorkbenchErrorOptions = {}): string {
    const snapshot = { ...info };
    const identity: ErrorIdentity = { id: options.id, code: snapshot.code, message: snapshot.message, requestId: snapshot.requestId };
    const existing = windows.snapshot().find(window => {
      const context = window.definition.context;
      if (context?.kind !== errorContextKind) return false;
      const previous = readIdentity(context.id);
      if (!previous) return false;
      if (identity.id || previous.id) return !!identity.id && identity.id === previous.id;
      return (identity.code === previous.code && identity.message === previous.message)
        || (!!identity.requestId && identity.requestId === previous.requestId);
    });
    if (existing) {
      windows.focus(existing.id);
      return existing.id;
    }

    const state = reactive({ retryError: "" });
    const retry = options.retry;
    const window = windows.openDialogSync({
      title: options.title ?? snapshot.title ?? "操作未完成",
      size: "auto",
      modal: false,
      movable: true,
      resizable: true,
      showCloseButton: true,
      footer: "close",
      closeLabel: "知道了",
      context: { kind: errorContextKind, id: JSON.stringify(identity) },
      blocks: [{ kind: "component", component: WorkbenchErrorPanel, props: () => ({ info: snapshot, showTitle: false, retryError: state.retryError }) }],
      actions: retry && snapshot.retryable !== false ? [{
        id: "retry",
        label: "重试",
        variant: "primary",
        async run() {
          state.retryError = "";
          try { await retry(); }
          catch (error) {
            state.retryError = typeof error === "string" && error
              ? error
              : error && typeof error === "object" && "message" in error && typeof error.message === "string" && error.message
                ? error.message
                : "请稍后再试。";
            throw error;
          }
        }
      }] : []
    });
    return window.id;
  }
  return { show };
}

export function useWorkbenchErrors() {
  return createWorkbenchErrors(useWorkbenchWindows());
}
