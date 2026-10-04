import { readonly, shallowRef } from "vue";
import type { FileClipboardSnapshot, FileLocation, FileOperationRequest, FileOperationSource } from "../operations.js";

/** 每次调用独立，消费者可在工作区级提供共享实例。来源和条目均保存快照。 */
export function useFileClipboard() {
  const snapshot = shallowRef<FileClipboardSnapshot | null>(null);
  function set(mode: "copy" | "cut", source: FileOperationSource) {
    snapshot.value = { mode, location: { ...source.location }, entries: source.entries.map(entry => ({ ...entry })) };
  }
  function clear() { snapshot.value = null; }
  function pasteRequest(target: FileLocation): FileOperationRequest | null {
    const current = snapshot.value;
    if (!current?.entries.length) return null;
    return { kind: current.mode === "cut" ? "move" : "copy", source: { location: { ...current.location }, entries: current.entries.map(entry => ({ ...entry })) }, target: { ...target } };
  }
  return { snapshot: readonly(snapshot), copy: (source: FileOperationSource) => set("copy", source), cut: (source: FileOperationSource) => set("cut", source), clear, pasteRequest };
}
