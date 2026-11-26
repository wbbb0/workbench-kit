import { flushPromises, mount } from "@vue/test-utils";
import { expect, it } from "vitest";
import SchemaNode from "./SchemaNode.vue";
import { projectSchemaVariant } from "../schemaVariant";
import type { UiNode, EditorFeatures, SchemaMeta } from "../types";
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

it("开启默认值初始化后普通 union 对象和数组条目具有完整结构，嵌套值不共享引用", async () => {
  const editorFeatures: EditorFeatures = { showReferenceBackdrop: false, unsetMode: "disabled", unsetActionLabel: null, draftEffectiveMode: "draft_only", initializeFromDefaults: true };
  const defaultValue = { name: null, details: { note: null }, entries: [] };
  const objectNode: UiNode = { ...group({ name: text }), schema: { kind: "object", optional: false, hasDefault: true, defaultValue } };
  const nullable: UiNode = { kind: "union", schema: { kind: "union", optional: false, hasDefault: true, defaultValue: null }, options: [objectNode, { kind: "field", schema: { kind: "literal", value: null, optional: false, hasDefault: true, defaultValue: null } }] };
  const wrapper = mount(SchemaNode, { props: { node: nullable, modelValue: null, editorFeatures } });
  await wrapper.find("select").setValue("0");
  const emitted = wrapper.emitted("update:modelValue")?.[0]?.[0] as any;
  expect(emitted).toEqual(defaultValue);
  emitted.details.note = "修改";
  expect(defaultValue.details.note).toBeNull();
  await wrapper.find("select").setValue("1");
  expect(wrapper.emitted("update:modelValue")?.[1]?.[0]).toBeNull();
  wrapper.unmount();
  const array: UiNode = { kind: "array", schema: { kind: "array", optional: false, hasDefault: false }, item: objectNode };
  const list = mount(SchemaNode, { props: { node: array, modelValue: [], editorFeatures } });
  await list.findAll("button").find(button => button.text().includes("添加"))!.trigger("click");
  expect(list.emitted("update:modelValue")?.[0]?.[0]).toEqual([defaultValue]);
  list.unmount();
});


it("未开启初始化时即使声明默认值也保留普通 union 和集合新增的原有清空行为", async () => {
  const objectNode: UiNode = { ...group({ name: text }), schema: { kind: "object", optional: false, hasDefault: true, defaultValue: { name: "默认" } } };
  const nullable: UiNode = { kind: "union", schema: { kind: "union", optional: false, hasDefault: false }, options: [objectNode, { kind: "field", schema: { kind: "literal", value: null, optional: false, hasDefault: false } }] };
  const wrapper = mount(SchemaNode, { props: { node: nullable, modelValue: null } });
  await wrapper.find("select").setValue("0");
  expect(wrapper.emitted("update:modelValue")?.[0]?.[0]).toBeNull();
  wrapper.unmount();
  const array: UiNode = { kind: "array", schema: { kind: "array", optional: false, hasDefault: false }, item: objectNode };
  const list = mount(SchemaNode, { props: { node: array, modelValue: [] } });
  await list.findAll("button").find(button => button.text().includes("添加"))!.trigger("click");
  expect(list.emitted("update:modelValue")?.[0]?.[0]).toEqual([null]);
  list.unmount();
  const discriminated: UiNode = { ...node, schema: { ...node.schema, hasDefault: true, defaultValue: { type: "second", entries: {} } } };
  const record: UiNode = { kind: "record", schema: { kind: "record", optional: false, hasDefault: false }, key: text, value: discriminated };
  const entries = mount(SchemaNode, { props: { node: record, modelValue: {} } });
  await entries.findAll("button").find(button => button.text().includes("添加"))!.trigger("click");
  expect(entries.emitted("update:modelValue")?.[0]?.[0]).toEqual({ key_1: { type: "second", entries: {} } });
  entries.unmount();
});

it("局部覆盖缺少判别字段时使用继承分支，编辑子字段不会切到第一个分支", async () => {
  const wrapper = mount(SchemaNode, { props: {
    node,
    modelValue: { address: "local" },
    effectiveValue: { type: "second", address: "local", secret: "inherited" },
    inherited: { type: "second", secret: "inherited" }
  } });
  expect((wrapper.find("select").element as HTMLSelectElement).value).toBe("1");
  const groupNode = wrapper.findAllComponents(SchemaNode).find(child => child.props("node").kind === "group")!;
  groupNode.vm.$emit("update:modelValue", { address: "edited" });
  expect(wrapper.emitted("update:modelValue")?.at(-1)?.[0]).toEqual({ address: "edited", type: "second" });
  await wrapper.setProps({ effectiveValue: undefined, modelValue: {}, inherited: { type: "second" } });
  expect((wrapper.find("select").element as HTMLSelectElement).value).toBe("1");
  wrapper.unmount();
});

it("切换供应商后实际表单使用目标分支默认值，而不是第一分支的默认对象", () => {
  const literal = (value: string): UiNode => ({ kind: "field", schema: { kind: "literal", value, optional: false, hasDefault: true, defaultValue: value } });
  const settings = group({ baseUrl: text, apiKeyEnv: text, model: text, key: text });
  const union: UiNode = { kind: "union", schema: { kind: "union", discriminator: "provider", optional: false, hasDefault: false }, options: [
    group({ provider: literal("first"), config: group({ endpoint: text }) }),
    group({ provider: literal("second"), config: settings })
  ] };
  const defaults = { baseUrl: "https://example.test/v1", apiKeyEnv: "TEST_API_KEY", model: "test-model" };
  const wrapper = mount(SchemaNode, { props: {
    node: union, path: ["service"], depth: -2,
    modelValue: { provider: "second", config: { key: "test-key" } },
    inherited: { provider: "first", config: {} },
    defaultValue: { provider: "first", config: { endpoint: "old-endpoint" } },
    editorFeatures: { draftEffectiveMode: "merge_reference", showReferenceBackdrop: true, unsetMode: "reference", unsetActionLabel: null,
      variantInheritance: [{ path: ["service"], discriminator: "provider", settingsKey: "config", defaultVariant: "first", defaults: { first: {}, second: defaults } }]
    }
  } });
  const values = wrapper.findAll("textarea").map(input => (input.element as HTMLTextAreaElement).value);
  expect(values).toEqual(expect.arrayContaining([...Object.values(defaults), "test-key"]));
  expect(values).not.toContain("old-endpoint");
  wrapper.unmount();
});

it("buildUiTree 与 SchemaNode 支持 toggleField、variantBy、preview 与 readOnly 秘密脱敏", async () => {
  const { defineBoolean, defineEnum, defineObject, defineString, defineVariantObject } = await import("@workbench-kit/schema");
  const { buildUiTree } = await import("../types");
  const schema = defineObject("根", {
    auth: defineObject(
      "认证",
      {
        enabled: defineBoolean("启用", true),
        username: defineString("用户名"),
        password: defineString("密码", undefined, { secret: true }),
      },
      {
        toggleField: "enabled",
        preview: (p) => p.ref("username"),
      },
    ),
    provider: defineVariantObject(
      "供应商",
      {
        type: defineEnum("供应商类型", ["openai", "vertex"] as const),
        label: defineString("标签"),
      },
      {
        variantBy: "type",
        variants: {
          openai: { title: "OpenAI", fields: { apiKey: defineString("密钥", undefined, { secret: true }) } },
          vertex: { title: "Vertex", fields: { projectId: defineString("项目") } },
        },
      },
    ),
  });
  const tree = buildUiTree(schema);
  const w = mount(SchemaNode, {
    props: {
      node: tree,
      modelValue: {
        auth: { enabled: true, username: "alice", password: "top-secret-password" },
        provider: { type: "openai", label: "主", apiKey: "sk-secret" },
      },
    },
  });
  expect(w.text()).toContain("alice");
  await w.findAll("button").find((b) => b.text().includes("认证"))!.trigger("click");
  await w.findAll("button").find((b) => b.text().includes("供应商"))!.trigger("click");
  await w.get('select[aria-label="供应商类型"]').setValue("vertex");
  expect(w.emitted("update:modelValue")?.at(-1)?.[0]).toEqual({
    auth: { enabled: true, username: "alice", password: "top-secret-password" },
    provider: { type: "vertex", label: "主" },
  });
  await w.setProps({ readOnly: true });
  expect(w.text()).not.toContain("top-secret-password");
  expect(w.text()).not.toContain("sk-secret");
  expect(w.text()).toContain("已设置");
  w.unmount();

  const layeredSchema: SchemaMeta = {
    kind: "object",
    title: "根节点",
    optional: false,
    hasDefault: false,
    fields: {
      service: {
        schema: {
          kind: "object",
          title: "服务",
          optional: false,
          hasDefault: true,
          toggleField: "enabled",
          variantBy: "type",
          fields: {
            enabled: { schema: { kind: "boolean", title: "启用", optional: false, hasDefault: true, defaultValue: true } },
            type: { schema: { kind: "enum", title: "类型", optional: false, hasDefault: false, values: ["a", "b"] } },
            host: { schema: { kind: "string", title: "主机", optional: false, hasDefault: false } },
          },
          variants: {
            a: { title: "A 分支", preview: { ref: ["host"] } },
            b: { title: "B 分支" },
          },
        },
      },
    },
  };
  const layered = mount(SchemaNode, {
    props: {
      node: buildUiTree(layeredSchema),
      modelValue: { service: { host: "10.0.0.1" } },
      effectiveValue: { service: { enabled: false, type: "a", host: "10.0.0.1" } },
    },
  });
  expect(layered.find("input[placeholder]").exists()).toBe(false);
  expect((layered.get('input[type="checkbox"]').element as HTMLInputElement).checked).toBe(false);
  await layered.setProps({
    effectiveValue: { service: { enabled: true, type: "a", host: "10.0.0.1" } },
  });
  expect(layered.text()).toContain("10.0.0.1");
  await layered.findAll("button").find((b) => b.text().includes("服务"))!.trigger("click");
  expect((layered.get('select[aria-label="类型"]').element as HTMLSelectElement).value).toBe("a");
  layered.unmount();
});
