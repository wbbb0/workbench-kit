import { mount } from "@vue/test-utils";
import { expect, it } from "vitest";
import SchemaSectionForm from "./SchemaSectionForm.vue";
import SchemaField from "./SchemaField.vue";
import type { SchemaMeta } from "../types";
const leaf = (kind: string, extra: Partial<SchemaMeta> = {}): SchemaMeta => ({
  kind,
  optional: true,
  hasDefault: false,
  ...extra,
});
it("扁平分区合并对象标题、具名价格数组增删且错误路径一致", async () => {
  const schema = leaf("object", {
    title: "模型",
    fields: {
      limits: {
        schema: leaf("object", {
          title: "限制",
          fields: { output: { schema: leaf("number", { title: "最大输出" }) } },
        }),
      },
      pricing: {
        schema: leaf("array", {
          title: "价格",
          item: leaf("object", {
            fields: {
              currency: {
                schema: leaf("string", { title: "币种", optional: false }),
              },
              input: { schema: leaf("number", { title: "输入每百万" }) },
            },
          }),
        }),
      },
    },
  });
  const values = {
    limits: { output: 10 },
    pricing: [{ currency: "USD", input: 0 }],
  };
  const w = mount(SchemaSectionForm, {
    props: {
      schema,
      values,
      issues: [{ path: ["pricing", "0", "input"], message: "价格问题" }],
    },
  });
  expect(w.text()).toContain("限制");
  expect(w.text()).toContain("价格 / 第 1 项");
  expect(w.text()).toContain("价格问题");
  expect(
    w.findAllComponents(SchemaField).map((field) => field.props("modelValue")),
  ).toContain(0);
  await w
    .findAll("button")
    .find((button) => button.text() === "新增条目")!
    .trigger("click");
  expect(w.emitted("edit")?.at(-1)).toEqual([
    ["pricing"],
    [{ currency: "USD", input: 0 }, { currency: "" }],
  ]);
  await w
    .findAll("button")
    .find((button) => button.text() === "删除此项")!
    .trigger("click");
  expect(w.emitted("edit")?.at(-1)).toEqual([["pricing"], []]);
  expect(values.pricing).toHaveLength(1);
  w.unmount();
});
it("枚举集合中文标签区分未知和显式空集合，重置仅发路径；union显示真实分支", async () => {
  const schema = leaf("object", {
    fields: {
      modalities: {
        schema: leaf("enum-set", {
          title: "模态",
          values: ["text", "image"],
          valueLabels: { text: "文字", image: "图片" },
        }),
      },
      thinking: {
        schema: leaf("union", {
          title: "思考",
          discriminator: "mode",
          options: [
            leaf("object", {
              title: "关闭",
              fields: {
                mode: {
                  schema: leaf("literal", { value: "off", optional: false }),
                },
              },
            }),
            leaf("object", {
              title: "等级",
              fields: {
                mode: {
                  schema: leaf("literal", { value: "level", optional: false }),
                },
                level: { schema: leaf("enum", { values: ["low", "high"] }) },
              },
            }),
          ],
        }),
      },
    },
  });
  const values = { thinking: { mode: "level", level: "high" } };
  const w = mount(SchemaSectionForm, { props: { schema, values } });
  expect(w.text()).toContain("未知");
  expect(w.text()).toContain("文字");
  expect((w.findAll("select")[0]!.element as HTMLSelectElement).value).toBe(
    "1",
  );
  await w.get('input[value="text"]').setValue(true);
  expect(w.emitted("edit")?.at(-1)).toEqual([["modalities"], ["text"]]);
  await w.setProps({ values: { ...values, modalities: [] } });
  expect(w.text()).not.toContain("未知");
  await w
    .findAll("button")
    .find((button) => button.text() === "恢复默认")!
    .trigger("click");
  expect(w.emitted("reset")?.at(-1)).toEqual([["modalities"]]);
  await w.findAll("select")[0]!.setValue("0");
  expect(w.emitted("edit")?.at(-1)).toEqual([["thinking"], { mode: "off" }]);
  w.unmount();
});
it("非法数组草稿保留输入并显示路径错误，可显式重置，不渲染新增控件", async () => {
  const schema = leaf("object", {
    fields: {
      pricing: {
        schema: leaf("array", { title: "价格", item: leaf("string") }),
      },
    },
  });
  const values = { pricing: "尚未完成的输入" };
  const w = mount(SchemaSectionForm, { props: { schema, values } });
  expect(w.text()).toContain("值应为数组");
  expect(w.text()).not.toContain("新增条目");
  expect(w.get("[data-setting-path='[\"pricing\"]']").text()).toContain(
    "当前输入已保留",
  );
  await w.get("button").trigger("click");
  expect(w.emitted("reset")?.at(-1)).toEqual([["pricing"]]);
  expect(values.pricing).toBe("尚未完成的输入");
  w.unmount();
});

it("紧凑表单支持 toggleField、variantBy、preview 与秘密字段", async () => {
  const { defineBoolean, defineEnum, defineObject, defineOptional, defineString, defineVariantObject } = await import("@workbench-kit/schema");
  const schema = defineObject("根", {
    auth: defineObject(
      "认证",
      {
        enabled: defineBoolean("启用认证", true),
        username: defineString("用户名"),
        password: defineString("密码", undefined, { secret: true }),
      },
      {
        toggleField: "enabled",
        preview: (p) => p.ref("username"),
      },
    ),
    thinking: defineOptional(
      defineVariantObject(
        "思考",
        { mode: defineEnum("模式", ["off", "level"] as const) },
        {
          variantBy: "mode",
          variants: {
            off: { title: "关闭" },
            level: { title: "等级", fields: { level: defineEnum("等级", ["low", "high"] as const) } },
          },
        },
      ),
    ),
  });
  const w = mount(SchemaSectionForm, {
    props: {
      schema,
      values: { auth: { enabled: true, username: "alice" } },
      overrides: { auth: { username: "alice" } },
      secrets: { '["auth","password"]': true },
      secretInputs: {},
    },
  });
  expect(w.text()).toContain("alice");
  expect(w.find('input[autocomplete="off"]').exists()).toBe(true);
  await w.get('select').setValue("level");
  expect(w.emitted("edit")?.at(-1)).toEqual([["thinking"], { mode: "level" }]);
  await w.setProps({ values: { auth: { enabled: false, username: "alice" } }, overrides: { auth: { enabled: false, username: "alice" } } });
  expect(w.find('[data-setting-path=\'["auth","username"]\']').exists()).toBe(false);
  w.unmount();

  const directSecretSchema = defineObject("直接模式密钥", {
    token: defineString("令牌", undefined, { secret: true }),
  });
  const directForm = mount(SchemaSectionForm, {
    props: {
      schema: directSecretSchema,
      values: { token: "plain-secret" },
      overrides: { token: "plain-secret" },
    },
  });
  await directForm.get("button").trigger("click");
  expect(directForm.emitted("reset")?.at(-1)).toEqual([["token"]]);
  directForm.unmount();
});
