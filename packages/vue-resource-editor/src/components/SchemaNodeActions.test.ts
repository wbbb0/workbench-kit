import { mount } from "@vue/test-utils";
import { expect, it, vi } from "vitest";
import SchemaNode from "./SchemaNode.vue";
import type { UiNode, EditorNodeActions } from "../types";
const field: UiNode = { kind: "field", schema: { kind: "string", optional: true, hasDefault: false } };
const group: UiNode = { kind: "group", schema: { kind: "object", optional: false, hasDefault: false }, children: { name: { field: { schema: field.schema }, node: field } } };
const record: UiNode = { kind: "record", schema: { kind: "record", optional: false, hasDefault: false }, key: field, value: group };
it("递归节点操作获得精确路径与当前草稿，保留内置操作且不改值", async () => {
  const clicked = vi.fn();
  const nodeActions: EditorNodeActions = context => context.path.join(".") === "one" ? [{ key: "probe", icon: "play", title: "测试", label: "测试能力", onClick: () => clicked(context.value) }] : [];
  const value = { one: { name: "draft" } };
  const wrapper = mount(SchemaNode, { props: { node: record, modelValue: value, nodeActions } });
  const button = wrapper.find('button[title="测试"]');
  expect(button.text()).toContain("测试能力");
  expect(wrapper.find('button[title="重命名"]').exists()).toBe(true);
  await button.trigger("click");
  expect(clicked).toHaveBeenCalledWith(value.one);
  expect(wrapper.emitted("update:modelValue")).toBeUndefined();
  wrapper.unmount();
});
it("禁用或只读节点不能执行注入操作，未注入时行为不变", async () => {
  for (const disabled of [true, false]) {
    const clicked = vi.fn();
    const wrapper = mount(SchemaNode, { props: { node: group, modelValue: {}, disabled, readOnly: !disabled, nodeActions: () => [{ key: "probe", icon: "play", title: "测试", onClick: clicked }] } });
    expect((wrapper.find('button[title="测试"]').element as HTMLButtonElement).disabled).toBe(true);
    await wrapper.find('button[title="测试"]').trigger("click");
    expect(clicked).not.toHaveBeenCalled();
    wrapper.unmount();
  }
  const wrapper = mount(SchemaNode, { props: { node: record, modelValue: { one: {} } } });
  expect(wrapper.find('button[title="测试"]').exists()).toBe(false);
  wrapper.unmount();
});
