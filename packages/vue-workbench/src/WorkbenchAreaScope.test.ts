import { describe, it, expect } from "vitest";
import {
  defineComponent,
  h,
  onActivated,
  onDeactivated,
  onUnmounted,
  ref,
  watch,
} from "vue";
import { mount } from "@vue/test-utils";
import WorkbenchAreaScope from "./WorkbenchAreaScope.vue";
import { useWorkbenchAreaPresentation } from "./runtime/workbenchAreaContext";
describe("WorkbenchAreaScope区域缓存", () => {
  it("默认保持卸载行为，opt-in按稳定view/area key缓存并有界淘汰", async () => {
    const events: string[] = [];
    const A = defineComponent({
      setup() {
        const draft = ref("");
        onActivated(() => events.push("active"));
        onDeactivated(() => events.push("hidden"));
        onUnmounted(() => events.push("unmount"));
        return () =>
          h("input", {
            value: draft.value,
            onInput: (e: Event) =>
              (draft.value = (e.target as HTMLInputElement).value),
          });
      },
    });
    const B = defineComponent({ render: () => h("p", "B") });
    const host = mount(WorkbenchAreaScope, {
      props: {
        areaId: "mainArea",
        component: A,
        viewId: "A",
        cache: true,
        cacheMax: 2,
      },
    });
    await host.get("input").setValue("未发送");
    await host.setProps({ component: B, viewId: "B" });
    expect(events).toContain("hidden");
    await host.setProps({ component: A, viewId: "A" });
    expect(host.get("input").element.value).toBe("未发送");
    expect(events.filter((e) => e === "active")).toHaveLength(2);
    await host.setProps({ visible: false });
    expect(host.find("input").exists()).toBe(false);
    await host.setProps({ visible: true });
    expect(host.get("input").element.value).toBe("未发送");
    host.unmount();
    const plain = mount(WorkbenchAreaScope, {
      props: { areaId: "mainArea", component: A },
    });
    await plain.setProps({ component: B });
    expect(events).toContain("unmount");
    plain.unmount();
  });
});

it("退场路径和活动状态随缓存区域实例，其他视图不会唤醒它", async () => {
  const first: string[] = [];
  const second: string[] = [];
  function panel(observed: string[]) {
    return defineComponent({
      setup() {
        const area = useWorkbenchAreaPresentation()!;
        watch([area.active, area.leavingPath], ([active, path]) => {
          observed.push(path?.at(-1)?.key ?? (active ? "active" : "inactive"));
        });
        return () => h("div");
      },
    });
  }
  const old = panel(first),
    next = panel(second);
  const w = mount(WorkbenchAreaScope, {
    props: {
      areaId: "mainArea",
      cache: true,
      viewId: "first",
      component: old,
    },
  });
  try {
    await w.setProps({ viewId: "second", component: next });
    await w.setProps({
      leavingPath: [
        { key: "second/detail", title: "next", areaId: "mainArea" },
      ],
    });
    await w.setProps({ visible: false, leavingPath: undefined });
    expect(first).toEqual(["inactive"]);
    expect(second).toEqual(["second/detail", "inactive"]);
    await w.setProps({ visible: true, viewId: "first", component: old });
    expect(first).toEqual(["inactive", "active"]);
  } finally {
    w.unmount();
  }
});
