import { useScopedDialog } from "./useScopedDialog";
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

it("作用域窗口替换、关闭恢复焦点，组件卸载清理当前窗口", async () => {
  let dialog!: ReturnType<typeof useScopedDialog>;
  const Owner = defineComponent({
    setup() {
      dialog = useScopedDialog({ showCloseButton: true });
      return () => h("button", { id: "opener" }, "open");
    },
  });
  const root = mount(WorkbenchRuntimeRoot, {
    attachTo: document.body,
    props: { view: defineWorkbenchView({ id: "scope", title: "Scope", areas: { mainArea: Owner } }) },
    slots: { default: () => h(Owner) },
  });
  try {
    const opener = root.get<HTMLButtonElement>("#opener").element;
    opener.focus();
    const old = dialog.open({ title: "first", size: "md" });
    const next = dialog.open({ title: "second", size: "md" });
    expect(await old).toBeUndefined();
    await nextTick();
    expect(root.findAll('[role="dialog"]')).toHaveLength(1);
    await root.get('[aria-label="关闭"]').trigger("click");
    expect((await next)?.reason).toBe("close");
    expect(document.activeElement).toBe(opener);
    const pending = dialog.open({ title: "closing", size: "md" });
    root.unmount();
    expect(await pending).toBeUndefined();
  } finally {
    if (root.exists()) root.unmount();
  }
});
