import { computed, ref } from "vue";

/** 受控集合选择；keys 的顺序用于范围选择，业务自行持有 selectedKeys。 */
export function useCollectionSelection(options: { keys: () => readonly string[]; selectedKeys: () => readonly string[]; focusedKey?: () => string | null; onChange: (keys: string[], focusedKey: string | null) => void }) {
  const anchor = ref<string | null>(null);
  const selected = computed(() => new Set(options.selectedKeys()));
  function select(key: string, modifiers: { additive?: boolean; range?: boolean } = {}) {
    const keys = options.keys();
    if (!keys.includes(key)) return;
    if (modifiers.range) {
      const start = keys.indexOf(anchor.value ?? options.focusedKey?.() ?? key);
      const end = keys.indexOf(key);
      const range = keys.slice(Math.min(start < 0 ? end : start, end), Math.max(start < 0 ? end : start, end) + 1);
      options.onChange(modifiers.additive ? [...new Set([...options.selectedKeys(), ...range])] : [...range], key);
      return;
    }
    anchor.value = key;
    const next = modifiers.additive ? new Set(options.selectedKeys()) : new Set<string>();
    if (modifiers.additive && next.has(key)) next.delete(key); else next.add(key);
    options.onChange([...next], key);
  }
  function all() { const keys = [...options.keys()]; const focused = options.focusedKey?.(); options.onChange(keys, focused && keys.includes(focused) ? focused : keys[0] ?? null); }
  function clear() { anchor.value = null; options.onChange([], null); }
  return { selected, anchor, select, all, clear };
}
