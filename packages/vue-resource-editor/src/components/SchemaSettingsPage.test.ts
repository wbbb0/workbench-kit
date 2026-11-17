import { flushPromises, mount } from "@vue/test-utils";
import { expect, it } from "vitest";
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
  await w.get('input[type="password"]').setValue("secret-test");
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
