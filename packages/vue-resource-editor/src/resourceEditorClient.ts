import { shallowRef, watch } from "vue";
import type { ResourceEditorClient, EditorOptionsResult } from "./types.js";

const activeResourceEditorClient = shallowRef<ResourceEditorClient | null>(null);

/** 注册当前应用的资源编辑 client。通常在 app 启动时调用一次。 */
export function configureResourceEditorClient(client: ResourceEditorClient | null): void {
  activeResourceEditorClient.value = client;
  invalidateResourceEditorOptions();
}

/** 获取当前注册的资源编辑 client。未注册时返回 null。 */
export function useResourceEditorClient(): ResourceEditorClient | null {
  return activeResourceEditorClient.value;
}

/** Refresh dynamic catalogs after saving or explicitly reloading resources. */
export function invalidateResourceEditorOptions(): void {
  optionsCache.clear();
  optionsRevision.value += 1;
}

const optionsRevision = shallowRef(0);
const optionsCache = new Map<string, Promise<EditorOptionsResult>>();

/** Share in-flight catalog loads, discard obsolete responses, and refresh mounted fields together. */
export function useResourceEditorOptions(key: () => string | undefined) {
  const data = shallowRef<EditorOptionsResult | null>(null);
  const error = shallowRef(false);
  watch([key, optionsRevision], async ([optionKey], _previous, onCleanup) => {
    let active = true;
    onCleanup(() => { active = false; });
    data.value = null;
    error.value = false;
    if (!optionKey) return;
    const client = useResourceEditorClient();
    if (!client?.options) { error.value = true; return; }
    let request = optionsCache.get(optionKey);
    if (!request) {
      request = Promise.resolve().then(() => client.options!(optionKey));
      optionsCache.set(optionKey, request);
    }
    try {
      const result = await request;
      if (active) data.value = result;
    } catch {
      if (optionsCache.get(optionKey) === request) optionsCache.delete(optionKey);
      if (active) error.value = true;
    }
  }, { immediate: true });
  return { data, error };
}
