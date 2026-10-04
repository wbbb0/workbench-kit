import { shallowRef, onBeforeUnmount } from "vue";
import type { FileUploadEntry } from "../operations.js";

/** 拒绝路径穿越和绝对路径，统一浏览器目录选择的相对路径。 */
export function normalizeUploadPath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  if (normalized.includes("\0") || normalized.startsWith("/") || /^[a-z]:/i.test(normalized) || normalized.split("/").some(part => part === "..")) throw new Error("Invalid relative upload path");
  const result = normalized.split("/").filter(part => part && part !== ".").join("/");
  if (!result) throw new Error("Empty upload path");
  return result;
}
export function filesToUploadEntries(files: Iterable<File>): FileUploadEntry[] {
  return Array.from(files, file => ({ kind: "file" as const, file, relativePath: normalizeUploadPath(file.webkitRelativePath || file.name) }));
}
interface DirectoryHandle { kind: "directory"; name: string; values(): AsyncIterable<DirectoryHandle | FileHandle> }
interface FileHandle { kind: "file"; name: string; getFile(): Promise<File> }
async function collectDirectory(handle: DirectoryHandle, prefix = ""): Promise<FileUploadEntry[]> {
  const relativePath = normalizeUploadPath(`${prefix}${handle.name}`);
  const result: FileUploadEntry[] = [{ relativePath, kind: "directory" }];
  for await (const child of handle.values()) {
    if (child.kind === "directory") result.push(...await collectDirectory(child, `${relativePath}/`));
    else result.push({ relativePath: normalizeUploadPath(`${relativePath}/${child.name}`), kind: "file", file: await child.getFile() });
  }
  return result;
}
export function useFilePicker() {
  const entries = shallowRef<FileUploadEntry[]>([]);
  let activeInput: HTMLInputElement | undefined;
  let generation = 0;
  let settle: ((entries: FileUploadEntry[]) => void) | undefined;
  function cleanup() { generation++; activeInput?.remove(); activeInput = undefined; settle?.([]); settle = undefined; }
  function pick(options: { directory?: boolean; multiple?: boolean; accept?: string } = {}): Promise<FileUploadEntry[]> {
    cleanup();
    if (typeof document === "undefined") return Promise.resolve([]);
    const session = generation;
    const directoryPicker = (window as Window & { showDirectoryPicker?: () => Promise<DirectoryHandle> }).showDirectoryPicker;
    if (options.directory && directoryPicker) return directoryPicker.call(window).then(handle => collectDirectory(handle)).then(picked => { if (session !== generation) return []; entries.value = picked; return picked; }).catch(error => { if (session !== generation) return []; if (error instanceof DOMException && error.name === "AbortError") return []; throw error; });
    return new Promise((resolve, reject) => {
      settle = resolve;
      const input = document.createElement("input");
      activeInput = input;
      input.type = "file";
      input.multiple = options.multiple ?? true;
      input.accept = options.accept ?? "";
      if (options.directory) input.setAttribute("webkitdirectory", "");
      input.hidden = true;
      document.body.appendChild(input);
      input.addEventListener("change", () => {
        if (session !== generation) return;
        try {
          const picked = filesToUploadEntries(input.files ?? []);
          entries.value = picked; settle = undefined; resolve(picked);
        } catch (error) { settle = undefined; reject(error); }
        finally { cleanup(); }
      }, { once: true });
      input.addEventListener("cancel", () => { if (session === generation) cleanup(); }, { once: true });
      input.click();
    });
  }
  onBeforeUnmount(cleanup);
  return { entries, pick, clear: () => { entries.value = []; } };
}
