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
  let revision = 0;
  function capture() {
    const view = list.value;
    if (!view || !items().length) return;
    const index = view.findItemIndex(view.scrollOffset),
      row = items()[index];
    if (!row) return;
    // 新的阅读位置取代尚未执行的异步恢复。
    revision++;
    restoring.value = false;
    const anchor = {
      id: row.id,
      offset: view.scrollOffset - view.getItemOffset(index),
      // 只容忍像素取整误差；靠近底部不代表用户仍想跟随。
      bottom: view.scrollSize - view.viewportSize - view.scrollOffset <= 1,
    };
    following.value = anchor.bottom;
    previousAnchor.value = anchor;
    onAnchor(anchor);
  }
  async function restore(anchor?: ReadingAnchor) {
    const current = ++revision;
    await nextTick();
    if (current !== revision) return;
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
    if (current === revision) restoring.value = false;
  }
  return { following, previousAnchor, restoring, capture, restore };
}
