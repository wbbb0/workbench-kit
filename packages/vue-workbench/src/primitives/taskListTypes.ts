export type WorkbenchTaskStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export type WorkbenchTaskItem = {
  id: string;
  label: string;
  status: WorkbenchTaskStatus;
  completed?: number;
  total?: number;
  /** 可选已处理的字节数。 */
  bytes?: number;
  error?: string;
  cancellable?: boolean;
  retryable?: boolean;
};
