import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, markRaw } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import MessageTimeline from "./MessageTimeline.vue";
vi.mock("virtua/vue", () => ({
  Virtualizer: defineComponent({
    name: "Virtualizer",
    props: ["data"],
    setup: (props, { slots, expose }) => {
      expose({
        scrollToIndex: () => {},
        findItemIndex: () => 0,
        getItemOffset: () => 0,
        scrollOffset: 0,
        viewportSize: 100,
        scrollSize: 100,
      });
      return () =>
        h(
          "div",
          (props.data as unknown[]).map((item) => slots.default?.({ item })),
        );
    },
  }),
}));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("正文详情入口", () => {
  it("点击和键盘打开，链接、代码复制和选择文本保持独立", async () => {
    const host = mount(MessageTimeline, {
      props: {
        items: [
          {
            id: "a",
            version: 1,
            kind: "message",
            author: "助手",
            detailLabel: "查看事件详情",
            parts: [
              {
                type: "text",
                text: "正文 [链接](https://example.com)\n\n```js\nconst a = 1;\n```",
              },
            ],
          },
        ],
      },
    });
    await host.get("a").trigger("click");
    await host.get("[data-copy-code]").trigger("click");
    expect(host.emitted("detail")).toBeUndefined();
    vi.spyOn(window, "getSelection").mockReturnValue({
      toString: () => "选中的正文",
    } as Selection);
    await host.get("article").trigger("click");
    expect(host.emitted("detail")).toBeUndefined();
    vi.mocked(window.getSelection).mockReturnValue(null);
    await host.get("article").trigger("click");
    await host.get('[aria-label="查看事件详情"]').trigger("click");
    expect(host.emitted("detail")).toEqual([["a"], ["a"]]);
    expect(host.find("details").exists()).toBe(false);
    host.unmount();
  });
});

it("错误语义着色，通用行操作不打开详情，禁用操作不可触发", async () => {
  const item = {
    id: "error",
    version: 1,
    kind: "status",
    tone: "danger" as const,
    parts: [{ type: "text" as const, text: "请求未完成" }],
    actions: [{ id: "retry", label: "重试", disabled: false }],
  };
  const host = mount(MessageTimeline, { props: { items: [item] } });
  expect(host.get(".wb-message-content").classes()).toContain("text-danger");
  const action = () =>
    host.findAll("button").find((button) => button.text() === "重试")!;
  await action().trigger("click");
  expect(host.emitted("action")).toEqual([["error", "retry"]]);
  expect(host.emitted("detail")).toBeUndefined();
  await host.setProps({
    items: [{ ...item, actions: [{ ...item.actions[0]!, disabled: true }] }],
  });
  await action().trigger("click");
  expect(host.emitted("action")).toHaveLength(1);
  host.unmount();
});

it("活动行只显示标签，正文摘要留在详情且能键盘打开", async () => {
  const w = mount(MessageTimeline, {
    props: {
      items: [
        {
          id: "call",
          version: 1,
          kind: "tool_call",
          author: "工具调用",
          identity: {
            icon: markRaw(defineComponent({ render: () => h("svg") })),
            tone: "muted",
          },
          activity: { label: "shell_run" },
          parts: [{ type: "text", text: "不应在清单展开的工具输出" }],
        },
      ],
    },
  });
  expect(w.text()).toContain("shell_run");
  expect(w.find(".wb-message-content").exists()).toBe(false);
  await w.get('[aria-label="展开：shell_run"]').trigger("click");
  expect(w.find(".wb-message-content").exists()).toBe(true);
  await w.get('[aria-label="收起：shell_run"]').trigger("click");
  expect(w.find(".wb-message-content").exists()).toBe(false);
  expect(w.find("header").exists()).toBe(true);
  await w.get('[aria-label="查看详情：shell_run"]').trigger("click");
  expect(w.emitted("detail")).toEqual([["call"]]);
  w.unmount();
});

it("只观察视口和总内容，折叠后自由阅读不主动校正位置", async () => {
  let resize!: ResizeObserverCallback;
  const observe = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: ResizeObserverCallback) {
        resize = callback;
      }
      observe = observe;
      disconnect() {}
    },
  );
  const schedule = vi.fn(() => 42);
  const cancel = vi.fn();
  vi.stubGlobal("requestAnimationFrame", schedule);
  vi.stubGlobal("cancelAnimationFrame", cancel);
  const host = mount(MessageTimeline, {
    props: {
      items: [
        {
          id: "last",
          version: 1,
          kind: "model_call",
          activity: { label: "调用" },
          parts: [],
        },
      ],
    },
  });
  await flushPromises();
  expect(observe.mock.calls.map(([element]) => element)).toEqual([
    host.get(".overflow-y-auto").element,
    host.findComponent({ name: "Virtualizer" }).element,
  ]);
  // 贴底时容器变高仍跟随；滚动会取消尚未执行的跟随。
  resize([], {} as ResizeObserver);
  expect(schedule).toHaveBeenCalledTimes(1);
  host.findComponent({ name: "Virtualizer" }).vm.$emit("scroll");
  expect(cancel).toHaveBeenCalledWith(42);
  schedule.mockClear();
  await host.get("[aria-expanded]").trigger("click");
  resize([], {} as ResizeObserver);
  expect(schedule).not.toHaveBeenCalled();
  // 行的增删完全由虚拟列表负责，不会新增尺寸观察目标。
  await host.setProps({ items: [] });
  await flushPromises();
  expect(observe).toHaveBeenCalledTimes(2);
  host.unmount();
});

it("按正文顺序渲染资源引用，点击引用只发出资源事件", async () => {
  const host = mount(MessageTimeline, { props: { items: [{
    id: "attachment-message",
    version: 1,
    kind: "message",
    parts: [
      { type: "text", text: "前文" },
      { type: "reference", id: "folder", label: "资料", icon: "directory" },
      { type: "text", text: "后文" },
    ],
  }] } });
  expect(host.get(".wb-message-content").text()).toMatch(/前文[\s\S]*资料[\s\S]*后文/);
  const reference = host.findAll("button").find(button => button.text() === "资料")!;
  await reference.trigger("click");
  expect(host.emitted("reference")).toEqual([["folder"]]);
  expect(host.emitted("detail")).toBeUndefined();
  host.unmount();
});

it("应用可自定义消息正文，作者与投递状态由时间线继续显示", () => {
  const host = mount(MessageTimeline, {
    props: { items: [{
      id: "qq", version: 1, kind: "message", author: "平台成员",
      parts: [{ type: "text", text: "默认正文" }],
      state: { label: "待投递", tone: "warning" },
    }] },
    slots: { content: ({ item }: { item: { id: string } }) => h("div", { "data-content": item.id }, "扩展正文") },
  });
  expect(host.get('[data-content="qq"]').text()).toBe("扩展正文");
  expect(host.text()).toContain("平台成员");
  expect(host.text()).toContain("待投递");
  expect(host.text()).not.toContain("默认正文");
  host.unmount();
});

it("标题按钮模式只从信息按钮打开详情，折叠标题与正文保持独立", async () => {
  const host = mount(MessageTimeline, { props: {
    detailTrigger: "button",
    items: [
      { id: "m", version: 1, kind: "message", author: "作者", parts: [{ type: "text", text: "可选择的正文" }] },
      { id: "c", version: 1, kind: "call", activity: { label: "工具" }, parts: [{ type: "text", text: "摘要" }] },
      { id: "p", version: 0, kind: "preview", detail: false, parts: [] },
    ],
  } });
  const [message, call, preview] = host.findAll("article");
  await message!.get("header span").trigger("click");
  await message!.get(".wb-message-content p").trigger("click");
  await call!.get("[aria-expanded]").trigger("click");
  await call!.get(".wb-message-content p").trigger("click");
  expect(host.emitted("detail")).toBeUndefined();
  expect(preview!.find("button").exists()).toBe(false);
  await message!.get("header button").trigger("click");
  await call!.get('[aria-label="查看详情：工具"]').trigger("click");
  expect(host.emitted("detail")).toEqual([["m"], ["c"]]);
  expect(call!.get("[aria-expanded]").attributes("aria-expanded")).toBe("true");
  host.unmount();
});
