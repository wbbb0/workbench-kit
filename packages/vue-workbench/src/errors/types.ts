/** Transport-independent error information. Applications normalize their own failures. */
export type WorkbenchErrorInfo = {
  code?: string;
  message: string;
  title?: string;
  hint?: string;
  requestId?: string;
  details?: string;
  retryable?: boolean;
};

export type WorkbenchErrorOptions = {
  /** Optional grouping key. Repeated errors in this group focus the existing window. */
  id?: string;
  title?: string;
  /** Called only after the user explicitly chooses retry. */
  retry?: () => void | Promise<void>;
};

export function formatWorkbenchError(info: WorkbenchErrorInfo): string {
  return [
    info.title,
    info.message,
    info.hint,
    info.code ? `Code: ${info.code}` : undefined,
    info.requestId ? `Request ID: ${info.requestId}` : undefined,
    info.details
  ].filter((part): part is string => !!part).join("\n\n");
}
