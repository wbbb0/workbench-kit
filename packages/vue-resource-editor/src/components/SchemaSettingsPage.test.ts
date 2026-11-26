import { flushPromises, mount } from "@vue/test-utils";
import { expect, it, vi } from "vitest";
import SchemaSettingsPage from "./SchemaSettingsPage.vue";
import type { SchemaMeta } from "../types";
const text: SchemaMeta = { kind: "string", optional: false, hasDefault: false };
const schema: SchemaMeta = {
  kind: "object",
  optional: false,
  hasDefault: false,
  title: "设置",
  fields: {
    service: {
      schema: {
        kind: "object",
        title: "服务",
        optional: false,
        hasDefault: false,
        fields: {
          port: {
            schema: {
              kind: "number",
              title: "端口",
              optional: false,
              hasDefault: true,
              defaultValue: 3031,
            },
          },
          credential: { schema: { ...text, title: "凭据", secret: true } },
        },
      },
    },
    catalog: {
      schema: {
        kind: "record",
        title: "目录",
        optional: false,
        hasDefault: true,
        defaultValue: {},
        recordValue: {
          kind: "object",
          title: "条目",
          optional: false,
          hasDefault: false,
          fields: { name: { schema: { ...text, title: "名称" } } },
        },
      },
    },
  },
};
it("schema 新字段自动成为页面控件，数值原文和秘密输入分别交给宿主", async () => {
  const w = mount(SchemaSettingsPage, {
    props: {
      schema,
      values: { service: { port: 3031 } },
      overrides: {},
      path: ["service"],
    },
  });
  await w.get('input[inputmode="decimal"]').setValue("2e");
  expect(w.emitted("edit")?.at(-1)).toEqual([["service", "port"], "2e"]);
  const secretInput = w.get('input[autocomplete="off"]');
  expect(secretInput.attributes("type")).toBe("text");
  expect(secretInput.attributes("autocapitalize")).toBe("off");
  expect(secretInput.attributes("spellcheck")).toBe("false");
  await secretInput.setValue("secret-test");
  expect(w.emitted("secretInput")?.at(-1)).toEqual([
    ["service", "credential"],
    "secret-test",
  ]);
  expect(w.emitted("secret")).toBeUndefined();
  await w.setProps({
    secretInputs: { '["service","credential"]': "secret-test" },
  });
  await w
    .findAll("button")
    .find((b) => b.text() === "替换")!
    .trigger("click");
  expect(w.emitted("secret")?.at(-1)).toEqual([
    ["service", "credential"],
    "set",
    "secret-test",
  ]);
  w.unmount();
});
it("新增集合条目使用同一导航事件，搜索只索引 schema 与路径，不索引秘密值", async () => {
  const w = mount(SchemaSettingsPage, {
    props: {
      schema,
      values: { catalog: {}, service: { credential: "never-search-this" } },
      overrides: {},
      path: ["catalog"],
    },
  });
  await w.get('[aria-label="新条目名称"]').setValue("one");
  await w.get("form").trigger("submit");
  expect(w.emitted("edit")?.at(-1)).toEqual([["catalog", "one"], { name: "" }]);
  expect(w.emitted("navigate")?.at(-1)).toEqual([["catalog", "one"]]);
  await w.get('[aria-label="搜索设置"]').setValue("never-search-this");
  expect(w.text()).toContain("没有匹配");
  await w.get('[aria-label="搜索设置"]').setValue("端口");
  expect(w.text()).toContain("端口");
  w.unmount();
});

it("嵌入模式关闭自带导航，独立模式保留返回，页面状态跨实例恢复", async () => {
  const { createSettingsPageState } = await import("../settingsPageState");
  const pageState = createSettingsPageState();
  const props = {
    schema,
    values: { service: { port: 3031 } },
    overrides: {},
    path: ["service"],
    pageState,
  };
  const first = mount(SchemaSettingsPage, { props });
  expect(first.find('[aria-label="返回上一级"]').exists()).toBe(true);
  await first.get('[aria-label="搜索设置"]').setValue("端口");
  first.unmount();
  const second = mount(SchemaSettingsPage, {
    props: {
      ...props,
      showBackButton: false,
      showBreadcrumbs: false,
      showTitle: false,
    },
  });
  expect(second.find('[aria-label="返回上一级"]').exists()).toBe(false);
  expect(second.find('[aria-label="设置路径"]').exists()).toBe(false);
  expect(
    second.get<HTMLInputElement>('[aria-label="搜索设置"]').element.value,
  ).toBe("端口");
  second.unmount();
});

it("滚动位置按页面保存，切页及布局重建后恢复", async () => {
  const { createSettingsPageState } = await import("../settingsPageState");
  const pageState = createSettingsPageState();
  const props = {
    schema,
    values: { service: { port: 3031 } },
    overrides: {},
    path: ["service"],
    pageState,
  };
  const first = mount(SchemaSettingsPage, { props });
  await flushPromises();
  first.get<HTMLElement>(".overflow-auto").element.scrollTop = 125;
  await first.setProps({ path: ["catalog"] });
  await flushPromises();
  expect(first.get<HTMLElement>(".overflow-auto").element.scrollTop).toBe(0);
  await first.setProps({ path: ["service"] });
  await flushPromises();
  expect(first.get<HTMLElement>(".overflow-auto").element.scrollTop).toBe(125);
  first.unmount();
  const second = mount(SchemaSettingsPage, { props });
  await flushPromises();
  expect(second.get<HTMLElement>(".overflow-auto").element.scrollTop).toBe(125);
  second.unmount();
});

it("外部合并工具栏隐藏整行内置控件，仍共用搜索状态", async () => {
  const { createSettingsPageState } = await import("../settingsPageState");
  const pageState = createSettingsPageState();
  const w = mount(SchemaSettingsPage, {
    props: {
      schema,
      values: {},
      overrides: {},
      path: ["service"],
      showHeader: false,
      pageState,
    },
  });
  expect(w.find("header").exists()).toBe(false);
  pageState.query = "端口";
  await flushPromises();
  expect(w.text()).toContain("端口");
  const result = w
    .findAll("button")
    .find((button) => button.text().includes("端口"))!;
  await result.trigger("click");
  expect(pageState.query).toBe("");
  expect(w.emitted("navigate")?.at(-1)).toEqual([["service", "port"]]);
  w.unmount();
});

it("占位默认值模式保留明确的 0 和 false，清空数值恢复默认且外部搜索不替换表单", async () => {
  const localSchema: SchemaMeta = {
    ...schema,
    fields: {
      count: {
        schema: {
          kind: "number",
          title: "数量",
          optional: false,
          hasDefault: true,
          defaultValue: 10,
        },
      },
      enabled: {
        schema: {
          kind: "boolean",
          title: "启用",
          optional: false,
          hasDefault: true,
          defaultValue: true,
        },
      },
    },
  };
  const w = mount(SchemaSettingsPage, {
    props: {
      schema: localSchema,
      path: [],
      values: { count: 10, enabled: true },
      overrides: {},
      defaultsAsPlaceholders: true,
      searchEnabled: false,
      pageState: { query: "外部搜索", names: {}, positions: new Map() },
    },
  });
  const number = w.get('input[inputmode="decimal"]');
  const checkbox = w.get('input[type="checkbox"]');
  expect((number.element as HTMLInputElement).value).toBe("");
  expect(number.attributes("placeholder")).toBe("10");
  expect((checkbox.element as HTMLInputElement).indeterminate).toBe(true);
  expect(w.text()).not.toContain("内置默认");
  await w.setProps({
    values: { count: 0, enabled: false },
    overrides: { count: 0, enabled: false },
  });
  expect((number.element as HTMLInputElement).value).toBe("0");
  expect((checkbox.element as HTMLInputElement).checked).toBe(false);
  expect((checkbox.element as HTMLInputElement).indeterminate).toBe(false);
  await number.setValue("");
  expect(w.emitted("reset")?.at(-1)).toEqual([["count"]]);
  await checkbox.setValue(true);
  expect(w.emitted("edit")?.at(-1)).toEqual([["enabled"], true]);
  w.unmount();
});
it("有序对象数组使用schema详情，支持添加删除排序与分组引用选项", async () => {
  const candidate: SchemaMeta = {
    ...text,
    kind: "object",
    fields: {
      model: {
        schema: { ...text, reference: { path: ["catalog"], label: "模型" } },
      },
    },
  };
  const root: SchemaMeta = {
    ...text,
    kind: "object",
    fields: { routes: { schema: { ...text, kind: "array", item: candidate } } },
  };
  const values = {
    routes: [{ model: "org/native.v1" }, { model: "org/adapted.v2" }],
  };
  const w = mount(SchemaSettingsPage, {
    props: { schema: root, values, overrides: values, path: ["routes"] },
  });
  expect(
    w.findAll("button").some((button) => button.text().includes("1.")),
  ).toBe(true);
  await w.get('button[title="下移条目"]').trigger("click");
  expect(w.emitted("edit")?.at(-1)).toEqual([
    ["routes"],
    [values.routes[1], values.routes[0]],
  ]);
  await w.get('button[title="删除 1. 条目"]').trigger("click");
  expect(w.emitted("edit")?.at(-1)).toEqual([["routes"], [values.routes[1]]]);
  await w.setProps({
    path: ["routes", "0"],
    referenceOptions: {
      '["routes","0","model"]': [
        { value: "org/native.v1", group: "原生能力" },
        { value: "org/adapted.v2", group: "兼容适配" },
      ],
    },
  });
  const options = w.findAll("select option");
  expect(options.map((option) => option.text())).toContain(
    "──────── 兼容适配 ────────",
  );
  expect(
    options
      .find((option) => option.text().includes("兼容适配"))!
      .attributes("disabled"),
  ).toBeDefined();
  await w.get("select").setValue("org/adapted.v2");
  expect(w.emitted("edit")?.at(-1)).toEqual([
    ["routes", "0", "model"],
    "org/adapted.v2",
  ]);
  w.unmount();
});

it("结构编辑失败或抛错时，类型选择仍和生效分支一致", async () => {
  const schema: SchemaMeta = { ...text, kind: "object", fields: {
    variant: { schema: { ...text, kind: "union", options: [
      { ...text, kind: "string", title: "文本" },
      { ...text, kind: "object", title: "对象", fields: {} },
    ] } },
  } };
  const applyStructure = vi.fn()
    .mockResolvedValueOnce(false)
    .mockRejectedValueOnce(new Error("结构编辑失败"));
  const w = mount(SchemaSettingsPage, { props: {
    schema, values: { variant: "原值" }, overrides: {}, path: ["variant"], applyStructure,
  } });
  try {
    const select = w.get<HTMLSelectElement>('select[aria-label="类型"]');
    await select.setValue("1");
    await flushPromises();
    expect(select.element.value).toBe("0");
    await select.setValue("1");
    await flushPromises();
    expect(select.element.value).toBe("0");
    expect(w.get('[role="alert"]').text()).toBe("结构编辑失败");
  } finally {
    w.unmount();
  }
});

it("支持 object.toggleField、object.variantBy 与 preview 展示", async () => {
  const { defineBoolean, defineEnum, defineObject, defineString, defineVariantObject } = await import("@workbench-kit/schema");
  const richSchema = defineObject("设置", {
    auth: defineObject(
      "认证",
      {
        enabled: defineBoolean("启用认证", false),
        username: defineString("用户名"),
        password: defineString("密码", undefined, { secret: true }),
      },
      {
        toggleField: "enabled",
        preview: (p) => p.ref("username", { fallback: "已启用" }),
      },
    ),
    provider: defineVariantObject(
      "供应商",
      {
        type: defineEnum("供应商类型", ["openai", "vertex"] as const),
        common: defineString("公共标签"),
      },
      {
        variantBy: "type",
        variants: {
          openai: { title: "OpenAI", fields: { apiKey: defineString("API Key", undefined, { secret: true }) } },
          vertex: { title: "Vertex", fields: { projectId: defineString("项目 ID") } },
        },
        preview: (p) => p.join(" · ", p.ref("type"), p.ref("common")),
      },
    ),
  });
  const applyStructure = vi.fn().mockResolvedValue(true);
  const w = mount(SchemaSettingsPage, {
    props: {
      schema: richSchema,
      values: { auth: { enabled: false, username: "alice" }, provider: { type: "openai", common: "主通道" } },
      overrides: {},
      path: [],
      defaultsAsPlaceholders: true,
      applyStructure,
    },
  });
  // 父页入口行：auth 关闭时禁入，右侧复选框独立在 button 外
  const authEntry = w.findAll("button[data-setting-entry]").find((b) => b.text().includes("认证"))!;
  expect((authEntry.element as HTMLButtonElement).disabled).toBe(true);
  expect(authEntry.find('input[type="checkbox"]').exists()).toBe(false);
  const providerEntry = w.findAll("button[data-setting-entry]").find((b) => b.text().includes("供应商"))!;
  expect(providerEntry.text()).toContain("openai · 主通道");

  // 进入 auth 页：顶部有开关，关闭态隐藏子项
  await w.setProps({ path: ["auth"] });
  expect(w.find('[data-setting-path=\'["auth","username"]\']').exists()).toBe(false);
  await w.setProps({ values: { auth: { enabled: true, username: "alice" }, provider: { type: "openai", common: "主通道" } } });
  expect(w.find('[data-setting-path=\'["auth","username"]\']').exists()).toBe(true);

  // 进入 provider 页：使用自定义标题下拉框并切换 variant
  await w.setProps({ path: ["provider"] });
  expect(w.find('[data-setting-path=\'["provider","apiKey"]\']').exists()).toBe(true);
  expect(w.find('[data-setting-path=\'["provider","projectId"]\']').exists()).toBe(false);
  await w.get('select[aria-label="供应商类型"]').setValue("vertex");
  expect(applyStructure).toHaveBeenCalledWith({
    type: "set",
    path: ["provider", "type"],
    value: "vertex",
  });
  w.unmount();
});
