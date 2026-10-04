import type { LocalFileItem } from "./types.js";

/** 可直接由业务条目映射，额外业务字段可保留。 */
export interface FileWorkspaceEntry extends Pick<LocalFileItem, "path" | "name" | "kind"> {
  sizeBytes?: number;
  updatedAtMs?: number;
  typeLabel?: string;
  /** 业务可用于不可访问或不可打开条目；共享包不推导权限。 */
  disabledReason?: string;
}
export interface FileLocation { rootId: string; path: string }
export interface FileLocationRoot { id: string; label: string; disabled?: boolean; disabledReason?: string }
export interface FileDirectoryEntry { name: string; path: string; disabled?: boolean; disabledReason?: string }
export interface FileLocationClient {
  listDirectories(location: FileLocation, options?: { signal?: AbortSignal; cursor?: string }): Promise<{ entries: FileDirectoryEntry[]; nextCursor?: string }>;
}
export type FileOperationKind = "upload" | "copy" | "move" | "delete";
export type FileConflictResolution = "skip" | "keep-both" | "replace";
export interface FileUploadEntry { relativePath: string; kind: "file" | "directory"; file?: File }
export interface FileOperationSource { location: FileLocation; entries: FileWorkspaceEntry[] }
export interface FileOperationRequest {
  kind: FileOperationKind;
  source?: FileOperationSource;
  target?: FileLocation;
  uploads?: FileUploadEntry[];
  conflictResolution?: FileConflictResolution;
}
export interface FileOperationConflict { id: string; incoming: FileWorkspaceEntry; existing: FileWorkspaceEntry; allowedResolutions?: FileConflictResolution[] }
export interface FileOperationTask {
  id: string; label: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  completed?: number; total?: number; bytes?: number; error?: string;
  cancellable?: boolean; retryable?: boolean;
}
/** 独立于只读 FileWorkspaceClient；权限、执行和后端协议全部由业务注入。 */
export interface FileOperationsAdapter {
  execute(request: FileOperationRequest, options?: { signal?: AbortSignal; onProgress?: (task: FileOperationTask) => void }): Promise<FileOperationTask>;
  cancel?(taskId: string): Promise<void>;
  retry?(taskId: string): Promise<FileOperationTask>;
}
export interface FileClipboardSnapshot extends FileOperationSource { mode: "copy" | "cut" }
