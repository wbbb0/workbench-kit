import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import MessageComposer from "./MessageComposer.vue";
import MessageContent from "./MessageContent.vue";
describe("通用消息组件", () => {
  it("Enter发送但不截断中文输入法组合或Shift换行", async () => {
    const host = mount(MessageComposer, { props: { modelValue: "中文" } });
    await host
      .get("textarea")
      .trigger("keydown", { key: "Enter", isComposing: true });
    await host
      .get("textarea")
      .trigger("keydown", { key: "Enter", shiftKey: true });
    expect(host.emitted("submit")).toBeUndefined();
    await host.get("textarea").trigger("keydown", { key: "Enter" });
    expect(host.emitted("submit")).toHaveLength(1);
    host.unmount();
  });
  it("用户聚焦前已全选时保留全选范围，不将替换输入变成追加", async () => {
    const host = mount(MessageComposer, {
      props: {
        modelValue: "已有未发送草稿",
        selectionStart: 3,
        selectionEnd: 3,
      },
    });
    await host.vm.$nextTick();
    const textarea = host.get("textarea");
    textarea.element.setSelectionRange(0, textarea.element.value.length);
    await textarea.trigger("focus");
    expect(textarea.element.selectionStart).toBe(0);
    expect(textarea.element.selectionEnd).toBe(textarea.element.value.length);
    await textarea.setValue("替换后的消息");
    expect(host.emitted("update:modelValue")?.at(-1)).toEqual(["替换后的消息"]);
    host.unmount();
  });
  it("Markdown正文、表格和高亮代码安全呈现且不执行原始HTML", () => {
    const host = mount(MessageContent, {
      props: {
        parts: [
          {
            type: "text",
            text: "<script>alert(1)</script>\n\n|A|B|\n|-|-|\n|1|2|\n\n```js\nconst x = 1;\n```",
          },
        ],
      },
    });
    expect(host.find("script").exists()).toBe(false);
    expect(host.find("table").exists()).toBe(true);
    expect(host.find("pre code").exists()).toBe(true);
    expect(host.html()).toContain("hljs-keyword");
    host.unmount();
  });
  it("HTTP环境缺少clipboard时选中代码供用户复制，不抛异常", async () => {
    const descriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    const host = mount(MessageContent, {
      attachTo: document.body,
      props: {
        parts: [{ type: "code", text: "const lan = true;", language: "js" }],
      },
    });
    try {
      await host.get("[data-copy-code]").trigger("click");
      expect(window.getSelection()?.toString()).toContain("const lan = true;");
    } finally {
      host.unmount();
      if (descriptor) Object.defineProperty(navigator, "clipboard", descriptor);
      else delete (navigator as unknown as { clipboard?: unknown }).clipboard;
    }
  });
});
