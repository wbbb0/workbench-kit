import { computed, defineComponent, h, ref } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, expect, it, vi } from "vitest";
import { pageMotionDirection, usePageMotion } from "./usePageMotion";
const at = (...keys: string[]) => ({ viewId: "test", keys });
afterEach(() => vi.restoreAllMocks());
it("所有深度使用同一祖先关系，字段、同级和跨视图变化不暗示层级", () => {
  expect(pageMotionDirection(at("root"), at("root", "a"))).toBe("forward");
  expect(pageMotionDirection(at("root", "a"), at("root", "a", "b"))).toBe(
    "forward",
  );
  expect(pageMotionDirection(at("root", "a", "b"), at("root", "a"))).toBe(
    "back",
  );
  expect(pageMotionDirection(at("root", "a"), at("root", "b"))).toBeUndefined();
  expect(pageMotionDirection(at("root", "a"), at("root", "a"))).toBeUndefined();
  expect(
    pageMotionDirection(at("root"), { viewId: "other", keys: ["root", "a"] }),
  ).toBeUndefined();
});
it("方向动画不重建区域，连续返回取消旧动画，减少动态效果时跳过", async () => {
  const location = ref(at("root"));
  const cancel = vi.fn();
  const animate = vi.fn(
    (
      _frames: Keyframe[] | PropertyIndexedKeyframes | null,
      _options?: number | KeyframeAnimationOptions,
    ) => ({ cancel }) as unknown as Animation,
  );
  const surface = document.createElement("div");
  surface.animate = animate;
  let reduced = false,
    setups = 0;
  vi.spyOn(window, "matchMedia").mockImplementation(
    () => ({ matches: reduced }) as MediaQueryList,
  );
  const child = defineComponent({
    setup() {
      setups++;
      return () => h("input");
    },
  });
  const w = mount(
    defineComponent({
      setup() {
        usePageMotion(
          computed(() => location.value),
          () => surface,
        );
        return () => h(child);
      },
    }),
  );
  try {
    location.value = at("root", "a");
    await flushPromises();
    expect(animate.mock.calls[0]?.[1]).toMatchObject({
      duration: 220,
      id: "workbench-page-forward",
    });
    location.value = at("root");
    await flushPromises();
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(animate.mock.calls[1]?.[1]).toMatchObject({
      id: "workbench-page-back",
    });
    reduced = true;
    location.value = at("root", "a");
    await flushPromises();
    expect(animate).toHaveBeenCalledTimes(2);
    expect(setups).toBe(1);
  } finally {
    w.unmount();
  }
});
