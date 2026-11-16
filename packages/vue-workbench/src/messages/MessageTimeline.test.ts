import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { mount } from "@vue/test-utils";
import MessageTimeline from "./MessageTimeline.vue";
vi.mock("virtua/vue", () => ({
  VList: defineComponent({
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
afterEach(() => vi.restoreAllMocks());
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
    await host.get("header button").trigger("click");
    expect(host.emitted("detail")).toEqual([["a"], ["a"]]);
    expect(host.find("details").exists()).toBe(false);
    host.unmount();
  });
});

it("错误语义着色，通用行操作不打开详情，禁用操作不可触发", async () => {
  const item = { id: 'error', version: 1, kind: 'status', tone: 'danger' as const, parts: [{ type: 'text' as const, text: '请求未完成' }], actions: [{ id: 'retry', label: '重试', disabled: false }] };
  const host = mount(MessageTimeline, { props: { items: [item] } });
  expect(host.get('.wb-message-content').classes()).toContain('text-danger');
  const action = () => host.findAll('button').find(button => button.text() === '重试')!;
  await action().trigger('click');
  expect(host.emitted('action')).toEqual([['error', 'retry']]);
  expect(host.emitted('detail')).toBeUndefined();
  await host.setProps({ items: [{ ...item, actions: [{ ...item.actions[0]!, disabled: true }] }] });
  await action().trigger('click');
  expect(host.emitted('action')).toHaveLength(1);
  host.unmount();
});
