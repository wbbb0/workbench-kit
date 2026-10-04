import { ref, onBeforeUnmount } from "vue";
import type { FileOperationSource, FileUploadEntry } from "../operations.js";
import { filesToUploadEntries, normalizeUploadPath } from "./useFilePicker.js";
export const FILE_WORKSPACE_DRAG_TYPE = "application/x-workbench-file-entries";
interface BrowserEntry { name: string; isFile: boolean; isDirectory: boolean; file?: (success: (file: File) => void, error: (error: DOMException) => void) => void; createReader?: () => { readEntries: (success: (entries: BrowserEntry[]) => void, error: (error: DOMException) => void) => void } }
async function walk(entry: BrowserEntry, prefix = ""): Promise<FileUploadEntry[]> {
  const relativePath = normalizeUploadPath(`${prefix}${entry.name}`);
  if (entry.isFile && entry.file) return [{ relativePath, kind: "file", file: await new Promise<File>((resolve, reject) => entry.file!(resolve, reject)) }];
  if (!entry.isDirectory || !entry.createReader) return [];
  const reader = entry.createReader();
  const result: FileUploadEntry[] = [{ relativePath, kind: "directory" }];
  while (true) {
    const children = await new Promise<BrowserEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
    if (!children.length) break;
    for (const child of children) result.push(...await walk(child, `${relativePath}/`));
  }
  return result;
}
export type FileDropPayload = { type: "internal"; source: FileOperationSource } | { type: "external"; entries: FileUploadEntry[] };
export async function readFileDrop(data: DataTransfer): Promise<FileDropPayload> {
  if (Array.from(data.types).includes(FILE_WORKSPACE_DRAG_TYPE)) {
    const source = JSON.parse(data.getData(FILE_WORKSPACE_DRAG_TYPE)) as FileOperationSource;
    if (!source?.location || typeof source.location.rootId !== "string" || typeof source.location.path !== "string" || !Array.isArray(source.entries) || !source.entries.every(entry => typeof entry?.path === "string" && typeof entry.name === "string" && ["file", "directory"].includes(entry.kind))) throw new Error("Invalid file drag payload");
    return { type: "internal", source };
  }
  // DataTransfer 离开同步 drop 事件后可能进入保护模式；先取完整快照再 await。
  const fallbackFiles = Array.from(data.files ?? []);
  const roots = Array.from(data.items ?? []).filter(item => item.kind === "file").map(item => ({
    entry: item.webkitGetAsEntry?.() as unknown as BrowserEntry | null,
    file: item.getAsFile()
  }));
  const entries: FileUploadEntry[] = [];
  for (const root of roots) {
    if (root.entry) entries.push(...await walk(root.entry));
    else if (root.file) entries.push(...filesToUploadEntries([root.file]));
  }
  return { type: "external", entries: entries.length ? entries : filesToUploadEntries(fallbackFiles) };
}
export function writeFileDrag(data: DataTransfer, source: FileOperationSource) {
  data.setData(FILE_WORKSPACE_DRAG_TYPE, JSON.stringify(source));
  data.effectAllowed = "copyMove";
}
export function useFileDrop(options: { onDrop: (payload: FileDropPayload, event: DragEvent) => void | Promise<void>; onError?: (error: unknown) => void; disabled?: () => boolean; dropEffect?: (event: DragEvent, internal: boolean) => "copy" | "move" | "none" }) {
  const active = ref(false);
  let depth = 0;
  let generation = 0;
  function accepts(event: DragEvent) { return !options.disabled?.() && !!event.dataTransfer && Array.from(event.dataTransfer.types).some(type => type === "Files" || type === FILE_WORKSPACE_DRAG_TYPE); }
  function onDragenter(event: DragEvent) { if (accepts(event)) { event.preventDefault(); depth++; active.value = true; } }
  function onDragleave() { depth = Math.max(0, depth - 1); active.value = depth > 0; }
  function onDragover(event: DragEvent) {
    if (!event.dataTransfer) return;
    if (!accepts(event)) { event.dataTransfer.dropEffect = "none"; return; }
    event.preventDefault();
    const internal = Array.from(event.dataTransfer.types).includes(FILE_WORKSPACE_DRAG_TYPE);
    event.dataTransfer.dropEffect = options.dropEffect?.(event, internal) ?? "copy";
  }
  async function onDrop(event: DragEvent) {
    depth = 0; active.value = false;
    if (!accepts(event) || !event.dataTransfer) return;
    event.preventDefault();
    const internal = Array.from(event.dataTransfer.types).includes(FILE_WORKSPACE_DRAG_TYPE);
    if (options.dropEffect?.(event, internal) === "none") return;
    const session = ++generation;
    try {
      const payload = await readFileDrop(event.dataTransfer);
      if (session !== generation || options.disabled?.() || options.dropEffect?.(event, internal) === "none") return;
      await options.onDrop(payload, event);
    } catch (error) { if (session === generation) options.onError?.(error); }
  }
  function cancel() { generation++; depth = 0; active.value = false; }
  onBeforeUnmount(cancel);
  return { active, onDragenter, onDragleave, onDragover, onDrop, cancel };
}
