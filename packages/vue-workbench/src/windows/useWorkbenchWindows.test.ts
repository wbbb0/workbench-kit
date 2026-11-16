import { defineComponent, h, nextTick } from "vue";
import { mount } from "@vue/test-utils";
import { expect, it } from "vitest";
import { defineWorkbenchView } from "../types";
import WorkbenchRuntimeRoot from "../WorkbenchRuntimeRoot.vue";
import { useWorkbenchWindows, type WorkbenchWindowManager } from "./useWorkbenchWindows";

it("并存的 runtime 各自显示和关闭自己的窗口", async () => {
  const services: WorkbenchWindowManager[] = [];
  const Consumer = defineComponent({ setup() {
    services.push(useWorkbenchWindows());
    return () => h("span");
  } });
  function mountRoot(id: string) {
    return mount(WorkbenchRuntimeRoot, {
      props: { view: defineWorkbenchView({ id, title: id, areas: { mainArea: Consumer } }) },
      slots: { default: () => h(Consumer) },
    });
  }
  const first = mountRoot("first"), second = mountRoot("second");
  try {
    services[0]!.openDialogSync({ id: "a", title: "第一个窗口", size: "md" });
    services[1]!.openDialogSync({ id: "b", title: "第二个窗口", size: "md" });
    await nextTick();
    expect(first.get('[role="dialog"]').attributes("aria-label")).toBe("第一个窗口");
    expect(second.get('[role="dialog"]').attributes("aria-label")).toBe("第二个窗口");
    await first.get('[aria-label="关闭"]').trigger("click");
    expect(first.find('[role="dialog"]').exists()).toBe(false);
    expect(second.find('[role="dialog"]').exists()).toBe(true);
  } finally { second.unmount(); first.unmount(); }
});
