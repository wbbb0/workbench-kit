import { describe, it, expect, vi } from "vitest";
import { shallowRef } from "vue";
import type { VListHandle } from "virtua/vue";
import type { MessageItem } from "./types";
import { useMessageViewport } from "./useMessageViewport";
const row = (id: string): MessageItem => ({
  id,
  version: 1,
  kind: "message",
  parts: [{ type: "text", text: id }],
});
describe("正向消息阅读锚点", () => {
  it("prepend历史和动态高度变化后按稳定row ID恢复偏移，隐藏时不滚动", async () => {
    let rows = [row("A"), row("B"), row("C")],
      enabled = true;
    const scrollToIndex = vi.fn();
    const list = shallowRef({
      scrollOffset: 130,
      scrollSize: 1200,
      viewportSize: 400,
      findItemIndex: () => 1,
      getItemOffset: () => 100,
      scrollToIndex,
    } as unknown as VListHandle);
    const changed = vi.fn();
    const viewport = useMessageViewport(
      list,
      () => rows,
      () => enabled,
      changed,
    );
    viewport.capture();
    expect(viewport.previousAnchor.value).toEqual({
      id: "B",
      offset: 30,
      bottom: false,
    });
    rows = [row("older"), ...rows];
    await viewport.restore(viewport.previousAnchor.value);
    expect(scrollToIndex).toHaveBeenLastCalledWith(2, { offset: 30 });
    // Expanding code/images changes measured heights, but the same fact + offset remains the anchor.
    list.value = { ...list.value, getItemOffset: () => 400 } as VListHandle;
    await viewport.restore(viewport.previousAnchor.value);
    expect(scrollToIndex).toHaveBeenLastCalledWith(2, { offset: 30 });
    enabled = false;
    scrollToIndex.mockClear();
    await viewport.restore();
    expect(scrollToIndex).not.toHaveBeenCalled();
  });
  it("近底部跟随最新，状态patch不改变事实顺序", async () => {
    const scrollToIndex = vi.fn();
    const rows = [row("A"), row("B")];
    const list = shallowRef({
      scrollOffset: 700,
      scrollSize: 1000,
      viewportSize: 300,
      findItemIndex: () => 1,
      getItemOffset: () => 600,
      scrollToIndex,
    } as unknown as VListHandle);
    const viewport = useMessageViewport(
      list,
      () => rows,
      () => true,
      () => {},
    );
    viewport.capture();
    expect(viewport.following.value).toBe(true);
    await viewport.restore(viewport.previousAnchor.value);
    expect(scrollToIndex).toHaveBeenLastCalledWith(1, { align: "end" });
  });
});

function scrollFixture(offset = 700) {
  const view = {
    scrollOffset: offset,
    scrollSize: 1000,
    viewportSize: 300,
    findItemIndex: () => 1,
    getItemOffset: () => 600,
    scrollToIndex: vi.fn(),
  };
  const viewport = useMessageViewport(
    shallowRef(view as unknown as VListHandle),
    () => [row("A"), row("B")],
    () => true,
    () => {},
  );
  return { view, viewport };
}

it("离开底部少量距离也退出跟随，实际回到底部才恢复", async () => {
  const { view, viewport } = scrollFixture();
  viewport.capture();
  expect(viewport.following.value).toBe(true);
  view.scrollOffset -= 40;
  viewport.capture();
  expect(viewport.following.value).toBe(false);
  await viewport.restore(viewport.previousAnchor.value);
  expect(view.scrollToIndex).toHaveBeenLastCalledWith(1, { offset: 60 });
  view.scrollOffset = 699.5;
  viewport.capture();
  expect(viewport.following.value).toBe(true);
});

it("用户滚动取代尚未执行的恢复，旧请求不能重新贴底", async () => {
  const { view, viewport } = scrollFixture();
  viewport.capture();
  const pending = viewport.restore(viewport.previousAnchor.value);
  view.scrollOffset -= 40;
  viewport.capture();
  await pending;
  expect(view.scrollToIndex).not.toHaveBeenCalled();
  expect(viewport.previousAnchor.value).toEqual({
    id: "B",
    offset: 60,
    bottom: false,
  });
  expect(viewport.restoring.value).toBe(false);
});

it("连续恢复只执行最新的阅读位置", async () => {
  const { view, viewport } = scrollFixture();
  await Promise.all([
    viewport.restore(),
    viewport.restore({ id: "A", offset: 12, bottom: false }),
  ]);
  expect(view.scrollToIndex).toHaveBeenCalledExactlyOnceWith(0, { offset: 12 });
  expect(viewport.restoring.value).toBe(false);
});
