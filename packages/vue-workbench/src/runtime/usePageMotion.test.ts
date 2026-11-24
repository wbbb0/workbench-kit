import { computed, defineComponent, h, ref } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, expect, it, vi } from "vitest";
import { pageMotionDirection, usePageSurfaceMotion } from "./usePageMotion";
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
it("前进与返回共用两面，打断后只保留最新离开页", async () => {
  const stack = ref([{ key: "root" }]);
  const root = document.createElement("div");
  const detail = document.createElement("div");
  const cancel = vi.fn();
  const animate = vi.fn(
    () =>
      ({
        cancel,
        finished: new Promise<void>(() => {}),
      }) as unknown as Animation,
  );
  const previous = Object.getOwnPropertyDescriptor(
    Element.prototype,
    "animate",
  );
  Object.defineProperty(Element.prototype, "animate", {
    configurable: true,
    value: animate,
  });
  let motion!: ReturnType<typeof usePageSurfaceMotion<{ key: string }>>;
  let reduced = false;
  vi.spyOn(window, "matchMedia").mockImplementation(
    () =>
      ({
        get matches() {
          return reduced;
        },
      }) as MediaQueryList,
  );
  const w = mount(
    defineComponent({
      setup() {
        motion = usePageSurfaceMotion(
          computed(() => ({
            pages: stack.value,
            layoutKey: "mobile",
            enabled: true,
          })),
          () => [root, detail],
        );
        return () => h("div");
      },
    }),
  );
  try {
    stack.value = [{ key: "root" }, { key: "a" }];
    await flushPromises();
    expect(animate).toHaveBeenCalledTimes(2);
    expect(motion.transition.value).toMatchObject({
      from: { key: "root" },
      direction: "forward",
    });
    stack.value = [{ key: "root" }];
    await flushPromises();
    expect(cancel).toHaveBeenCalledTimes(2);
    expect(motion.transition.value).toMatchObject({
      from: { key: "a" },
      direction: "back",
    });
    reduced = true;
    stack.value = [{ key: "root" }, { key: "b" }];
    await flushPromises();
    expect(cancel).toHaveBeenCalledTimes(4);
    expect(animate).toHaveBeenCalledTimes(4);
    expect(motion.transition.value).toBeUndefined();
  } finally {
    w.unmount();
    if (previous) Object.defineProperty(Element.prototype, "animate", previous);
    else Reflect.deleteProperty(Element.prototype, "animate");
  }
});
