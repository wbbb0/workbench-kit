import { describe, it, expect } from "vitest";
import {
  defineComponent,
  h,
  onActivated,
  onDeactivated,
  onUnmounted,
  ref,
} from "vue";
import { mount } from "@vue/test-utils";
import WorkbenchAreaScope from "./WorkbenchAreaScope.vue";
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
