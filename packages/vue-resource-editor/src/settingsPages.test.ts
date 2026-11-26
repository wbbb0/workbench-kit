import { expect, it } from "vitest";
import { resolveSettingsPage } from "./settingsPages";
import type { SchemaMeta } from "./types";
const base = { optional: false, hasDefault: false };
const text: SchemaMeta = { ...base, kind: "string" };
const schema: SchemaMeta = {
  ...base,
  kind: "object",
  title: "设置",
  fields: {
    items: {
      title: "目录",
      schema: {
        ...base,
        kind: "record",
        recordValue: {
          ...base,
          kind: "union",
          discriminator: "kind",
          options: [
            {
              ...base,
              kind: "object",
              fields: {
                kind: { schema: { ...base, kind: "literal", value: "a" } },
                nested: {
                  schema: {
                    ...base,
                    kind: "object",
                    title: "子项",
                    fields: { token: { schema: text } },
                  },
                },
              },
            },
            {
              ...base,
              kind: "object",
              fields: {
                kind: { schema: { ...base, kind: "literal", value: "b" } },
                name: { schema: text },
              },
            },
          ],
        },
      },
    },
  },
};
it("生成实际祖先页面和 record 名称，叶子定位到所属页面", () => {
  const result = resolveSettingsPage(
    schema,
    { items: { one: { kind: "a", nested: {} } } },
    ["items", "one", "nested", "token"],
  );
  expect(result.valid).toBe(true);
  expect(result.pages.map((p) => p.title)).toEqual([
    "设置",
    "目录",
    "one",
    "子项",
  ]);
  expect(result.path).toEqual(["items", "one", "nested"]);
  expect(result.focusPath).toEqual(["items", "one", "nested", "token"]);
});
it("已删除的 record、失效的 union 子页与标量多余后缀回到最近有效父页", () => {
  const missing = resolveSettingsPage(schema, { items: {} }, ["items", "gone"]);
  expect(missing.valid).toBe(false);
  expect(missing.path).toEqual(["items"]);
  const branch = resolveSettingsPage(
    schema,
    { items: { one: { kind: "b" } } },
    ["items", "one", "nested"],
  );
  expect(branch.valid).toBe(false);
  expect(branch.path).toEqual(["items", "one"]);
  const extra = resolveSettingsPage(schema, { items: { one: { kind: "b" } } }, [
    "items",
    "one",
    "name",
    "bad",
  ]);
  expect(extra.valid).toBe(false);
  expect(extra.focusPath).toBeUndefined();
});

it("关闭的 toggleField 对象仍可被搜索命中，导航时停在对象页并聚焦开关", async () => {
  const { defineBoolean, defineObject, defineString } = await import("@workbench-kit/schema");
  const { searchSettings } = await import("./settingsPages");
  const toggleSchema = defineObject("设置", {
    browser: defineObject(
      "浏览器",
      {
        enabled: defineBoolean("启用浏览器", false),
        proxy: defineString("代理"),
      },
      { toggleField: "enabled" },
    ),
  });
  const hits = searchSettings(toggleSchema, { browser: { enabled: false } }, "代理");
  expect(hits.map((h) => h.path)).toContainEqual(["browser", "proxy"]);
  const resolved = resolveSettingsPage(toggleSchema, { browser: { enabled: false } }, ["browser", "proxy"]);
  expect(resolved.valid).toBe(true);
  expect(resolved.path).toEqual(["browser"]);
  expect(resolved.focusPath).toEqual(["browser", "enabled"]);
});
