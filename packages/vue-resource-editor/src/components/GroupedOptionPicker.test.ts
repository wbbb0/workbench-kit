import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import SchemaNode from "./SchemaNode.vue";
import SchemaField from "./SchemaField.vue";
import { configureResourceEditorClient } from "../resourceEditorClient.js";
import type { EditorOptionGroup, ResourceEditorClient, UiNode } from "../types.js";

const groupedNode: UiNode = {
  kind: "group",
  schema: {
    kind: "object",
    optional: false,
    hasDefault: false,
    dynamicRef: "targets"
  },
  children: {}
};

const groups: EditorOptionGroup[] = [
  {
    key: "first",
    label: "第一组",
    options: [
      {
        key: "shared",
        label: "共享项",
        description: "第一组说明",
        value: { group: "first", item: "shared" }
      },
      {
        key: "disabled",
        label: "已禁用",
        value: { group: "first", item: "disabled" },
        disabled: true
      }
    ]
  },
  {
    key: "second",
    label: "第二组",
    options: [
      {
        key: "shared",
        label: "同名共享项",
        value: { group: "second", item: "shared" }
      },
      {
        key: "other",
        label: "其他项",
        value: { group: "second", item: "other" }
      }
    ]
  },
  {
    key: "empty",
    label: "空组",
    options: []
  }
];

function configureOptions(options: ResourceEditorClient["options"]) {
  configureResourceEditorClient({
    list: vi.fn(async () => ({ resources: [] })),
    load: vi.fn(async () => { throw new Error("unused"); }),
    validate: vi.fn(async () => { throw new Error("unused"); }),
    save: vi.fn(async () => { throw new Error("unused"); }),
    options
  });
}

afterEach(() => {
  configureResourceEditorClient(null);
});

describe("grouped dynamic option picker", () => {
  it("回显完整对象，并在切换分组时按 option key 保留选择并写回新组完整值", async () => {
    configureOptions(vi.fn(async () => ({ groups })));
    const wrapper = mount(SchemaNode, {
      props: {
        node: groupedNode,
        modelValue: { group: "first", item: "shared" }
      }
    });

    await flushPromises();
    const [groupSelect, optionSelect] = wrapper.findAll("select");
    expect((groupSelect!.element as HTMLSelectElement).value).toBe("first");
    expect((optionSelect!.element as HTMLSelectElement).value).toBe("shared");
    expect(wrapper.text()).toContain("第一组说明");

    await groupSelect!.setValue("second");

    expect((optionSelect!.element as HTMLSelectElement).value).toBe("shared");
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([
      { group: "second", item: "shared" }
    ]);
  });

  it("切换到没有同 key 选项的分组时清空，并在选择后写回 unknown 类型的完整 value", async () => {
    configureOptions(vi.fn(async () => ({ groups })));
    const wrapper = mount(SchemaNode, {
      props: {
        node: groupedNode,
        modelValue: { group: "first", item: "shared" }
      }
    });
    await flushPromises();
    const [groupSelect, optionSelect] = wrapper.findAll("select");

    await groupSelect!.setValue("empty");
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([undefined]);
    expect(optionSelect!.attributes("disabled")).toBeDefined();

    await groupSelect!.setValue("second");
    await optionSelect!.setValue("other");
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([
      { group: "second", item: "other" }
    ]);
  });

  it("提示无效初始值，并服从 readOnly 与 option disabled", async () => {
    configureOptions(vi.fn(async () => ({ groups })));
    const wrapper = mount(SchemaNode, {
      props: {
        node: groupedNode,
        modelValue: { legacy: true },
        readOnly: true
      }
    });
    await flushPromises();

    expect(wrapper.text()).toContain("当前值不在选项清单中");
    expect(wrapper.text()).toContain("{\"legacy\":true}");
    expect(wrapper.findAll("select").every((select) => select.attributes("disabled") !== undefined)).toBe(true);

    await wrapper.setProps({
      modelValue: { group: "first", item: "disabled" },
      readOnly: false,
      disabled: true
    });
    expect(wrapper.findAll("select").every((select) => select.attributes("disabled") !== undefined)).toBe(true);

    await wrapper.setProps({ disabled: false });
    const disabledOption = wrapper.findAll("option").find((option) => option.attributes("value") === "disabled");
    expect(disabledOption?.attributes("disabled")).toBeDefined();
  });

  it("展示加载态与错误态，并拒绝在对象节点消费旧的扁平结果", async () => {
    let resolveOptions!: (value: { options: string[] }) => void;
    configureOptions(vi.fn(() => new Promise<{ options: string[] }>((resolve) => { resolveOptions = resolve; })));
    const wrapper = mount(SchemaNode, {
      props: { node: groupedNode, modelValue: undefined }
    });

    expect(wrapper.text()).toContain("加载中");
    resolveOptions({ options: ["legacy"] });
    await flushPromises();
    expect(wrapper.text()).toContain("选项加载失败");
  });

  it("字符串节点继续消费原有扁平 options 契约", async () => {
    configureOptions(vi.fn(async () => ({ options: ["alpha", "beta"] })));
    const wrapper = mount(SchemaField, {
      props: {
        schema: {
          kind: "string",
          optional: false,
          hasDefault: false,
          dynamicRef: "legacy"
        },
        modelValue: "beta"
      }
    });

    await flushPromises();
    expect((wrapper.get("select").element as HTMLSelectElement).value).toBe("beta");
  });
});

describe("record mutation guard", () => {
  const stringField: UiNode = {
    kind: "field",
    schema: { kind: "string", optional: false, hasDefault: false }
  };
  const recordNode: UiNode = {
    kind: "record",
    schema: { kind: "record", optional: false, hasDefault: false },
    key: stringField,
    value: stringField
  };
  const rootNode: UiNode = {
    kind: "group",
    schema: { kind: "object", optional: false, hasDefault: false },
    children: {
      entries: {
        field: { schema: recordNode.schema },
        node: recordNode
      }
    }
  };

  it("递归传递 guard，并在 guard 拒绝时取消删除", async () => {
    const guard = vi.fn(async () => false);
    const wrapper = mount(SchemaNode, {
      props: {
        node: rootNode,
        modelValue: { entries: { old: "value" } },
        path: ["root"],
        beforeRecordMutation: guard
      }
    });

    await wrapper.find("button").trigger("click");
    await wrapper.get('button[title="删除"]').trigger("click");
    await flushPromises();

    expect(guard).toHaveBeenCalledWith({
      kind: "remove",
      path: ["root", "entries"],
      key: "old"
    });
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
  });

  it("guard 允许后再执行 rename，并提供旧 key、新 key 与 record 路径", async () => {
    const guard = vi.fn(async () => true);
    const wrapper = mount(SchemaNode, {
      props: {
        node: recordNode,
        modelValue: { old: "value" },
        path: ["entries"],
        beforeRecordMutation: guard
      }
    });

    await wrapper.get('button[title="重命名"]').trigger("click");
    const input = wrapper.get('input[placeholder="输入 key"]');
    await input.setValue("next");
    await input.trigger("blur");
    await flushPromises();

    expect(guard).toHaveBeenCalledWith({
      kind: "rename",
      path: ["entries"],
      key: "old",
      nextKey: "next"
    });
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([{ next: "value" }]);
  });
});
