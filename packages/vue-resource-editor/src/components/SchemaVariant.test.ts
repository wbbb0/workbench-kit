import { flushPromises, mount } from "@vue/test-utils";
import { expect, it } from "vitest";
import SchemaNode from "./SchemaNode.vue";
import { projectSchemaVariant } from "../schemaVariant";
import type { UiNode } from "../types";
const text: UiNode = { kind: "field", schema: { kind: "string", optional: true, hasDefault: false } };
const group = (children: Record<string, UiNode>): UiNode => ({ kind: "group", schema: { kind: "object", optional: false, hasDefault: false }, children: Object.fromEntries(Object.entries(children).map(([key, node]) => [key, { field: { schema: node.schema }, node }])) });
const variant = (type: string, extra: string) => group({ type: { kind: "field", schema: { kind: "literal", value: type, optional: false, hasDefault: true, defaultValue: type } }, address: text, secret: text, entries: { kind: "record", schema: { kind: "record", optional: false, hasDefault: true, defaultValue: {} }, key: text, value: group({ name: text }) }, [extra]: text });
const node: UiNode = { kind: "union", schema: { kind: "union", discriminator: "type", optional: false, hasDefault: false }, options: [variant("first", "firstOnly"), variant("second", "secondOnly")] };
it("切换分支保留连接与嵌套清单，去掉不再适用的字段，不修改原对象", async () => {
  const original = { type: "first", address: "endpoint", secret: "secret", firstOnly: "old", entries: { a: { name: "model", obsolete: true } } };
  const wrapper = mount(SchemaNode, { props: { node, modelValue: original } });
  await wrapper.find("select").setValue("1");
  expect(wrapper.emitted("update:modelValue")?.[0]?.[0]).toEqual({ type: "second", address: "endpoint", secret: "secret", entries: { a: { name: "model" } } });
  expect(original.firstOnly).toBe("old");
  wrapper.unmount();
});
it("外部加载或恢复时跟随判别字段，而不是保留上一次下拉框选择", async () => {
  const wrapper = mount(SchemaNode, { props: { node, modelValue: { type: "second" } } });
  expect((wrapper.find("select").element as HTMLSelectElement).value).toBe("1");
  await wrapper.setProps({ modelValue: { type: "first" } });
  expect((wrapper.find("select").element as HTMLSelectElement).value).toBe("0");
  wrapper.unmount();
});
it("保留高级 passthrough 对象的自定义数据", () => {
  const target: UiNode = { kind: "group", schema: { kind: "object", unknownKeys: "passthrough", optional: false, hasDefault: false }, children: {} };
  expect(projectSchemaVariant(target, { custom: { value: 7 } })).toEqual({ custom: { value: 7 } });
});

it("未声明 discriminator 的普通 union 保留原有清空行为", async () => {
  const ordinary: UiNode = { ...node, schema: { kind: "union", optional: false, hasDefault: false } };
  const wrapper = mount(SchemaNode, { props: { node: ordinary, modelValue: { type: "first", address: "endpoint" } } });
  await wrapper.find("select").setValue("1");
  expect(wrapper.emitted("update:modelValue")?.[0]?.[0]).toBeNull();
  wrapper.unmount();
});

it("只读与禁用状态不允许切换", async () => {
  for (const mode of ["readOnly", "disabled"]) {
    const wrapper = mount(SchemaNode, { props: { node, modelValue: { type: "second" }, [mode]: true } });
    expect((wrapper.find("select").element as HTMLSelectElement).disabled).toBe(true);
    await wrapper.find("select").trigger("change");
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
    wrapper.unmount();
  }
});

it("支持 Vue 响应式对象且不会共享嵌套引用", async () => {
  const { reactive } = await import("vue");
  const value = reactive({ type: "first", entries: { a: { name: "模型" } } });
  const result = projectSchemaVariant(node.options[1]!, value) as any;
  result.entries.a.name = "修改";
  expect(value.entries.a.name).toBe("模型");
});

it("record 中的 union 项仍提供重命名和删除操作，并保留异步 guard", async () => {
  const { vi } = await import("vitest");
  const guard = vi.fn(async () => false);
  const record: UiNode = { kind: "record", schema: { kind: "record", optional: false, hasDefault: false }, key: text, value: node };
  const wrapper = mount(SchemaNode, { props: { node: record, modelValue: { sample: { type: "first" } }, beforeRecordMutation: guard } });
  expect(wrapper.find('button[title="重命名"]').exists()).toBe(true);
  const remove = wrapper.find('button[title="删除"]');
  expect(remove.exists()).toBe(true);
  await remove.trigger("click");
  expect(guard).toHaveBeenCalled();
  expect(wrapper.emitted("update:modelValue")).toBeUndefined();
  wrapper.unmount();
});

it("新增判别 union 条目带上类型，普通条目仍以 null 初始化", async () => {
  for (const discriminated of [true, false]) {
    const item = discriminated ? node : { ...node, schema: { kind: "union", optional: false, hasDefault: false } };
    const record: UiNode = { kind: "record", schema: { kind: "record", optional: false, hasDefault: false }, key: text, value: item };
    const wrapper = mount(SchemaNode, { props: { node: record, modelValue: {} } });
    const add = wrapper.findAll("button").find(b => b.text().includes("添加"))!;
    await add.trigger("click");
    const result = wrapper.emitted("update:modelValue")?.[0]?.[0] as any;
    expect(result.key_1).toEqual(discriminated ? { type: "first", entries: {} } : null);
    wrapper.unmount();
  }
});

it("record 新增也经过 beforeRecordMutation：guard 返回 false 时不插入", async () => {
  const { vi } = await import("vitest");
  const guard = vi.fn(async () => false);
  const record: UiNode = { kind: "record", schema: { kind: "record", optional: false, hasDefault: false }, key: text, value: text };
  const wrapper = mount(SchemaNode, { props: { node: record, modelValue: { a: "x" }, beforeRecordMutation: guard } });
  const add = wrapper.findAll("button").find(b => b.text().includes("添加"))!;
  await add.trigger("click");
  await flushPromises();
  expect(guard).toHaveBeenCalledWith({ kind: "add", path: [] });
  expect(wrapper.emitted("update:modelValue")).toBeUndefined();
  wrapper.unmount();
});

it("record 新增 guard 返回 true 时仍按默认插入空条目", async () => {
  const { vi } = await import("vitest");
  const guard = vi.fn(async () => true);
  const record: UiNode = { kind: "record", schema: { kind: "record", optional: false, hasDefault: false }, key: text, value: text };
  const wrapper = mount(SchemaNode, { props: { node: record, modelValue: { a: "x" }, beforeRecordMutation: guard } });
  const add = wrapper.findAll("button").find(b => b.text().includes("添加"))!;
  await add.trigger("click");
  await flushPromises();
  expect(guard).toHaveBeenCalledWith({ kind: "add", path: [] });
  const result = wrapper.emitted("update:modelValue")?.[0]?.[0] as any;
  expect(result.key_2).toEqual(null);
  wrapper.unmount();
});
