import { nextTick, ref, shallowRef, type Ref } from "vue";
import type { VListHandle } from "virtua/vue";
import type { MessageItem, ReadingAnchor } from "./types";
/** Stable facts, rather than pixel-only offsets, own reading position across height changes. */
export function useMessageViewport(
  list: Ref<VListHandle | undefined>,
  items: () => readonly MessageItem[],
  active: () => boolean,
  onAnchor: (anchor: ReadingAnchor) => void,
) {
  const following = ref(true);
  const previousAnchor = shallowRef<ReadingAnchor>();
  const restoring = ref(false);
  function capture() {
    const view = list.value;
    if (!view || !items().length) return;
    const index = view.findItemIndex(view.scrollOffset),
      row = items()[index];
    if (!row) return;
    const anchor = {
      id: row.id,
      offset: view.scrollOffset - view.getItemOffset(index),
      bottom: view.scrollSize - view.viewportSize - view.scrollOffset < 96,
    };
    following.value = anchor.bottom;
    previousAnchor.value = anchor;
    onAnchor(anchor);
  }
  async function restore(anchor?: ReadingAnchor) {
    await nextTick();
    const view = list.value;
    if (!view || !active()) return;
    restoring.value = true;
    following.value = anchor?.bottom ?? true;
    previousAnchor.value = anchor;
    if (!anchor || anchor.bottom)
      view.scrollToIndex(Math.max(0, items().length - 1), { align: "end" });
    else {
      const index = items().findIndex((row) => row.id === anchor.id);
      if (index >= 0) view.scrollToIndex(index, { offset: anchor.offset });
    }
    await nextTick();
    restoring.value = false;
  }
  return { following, previousAnchor, restoring, capture, restore };
}
