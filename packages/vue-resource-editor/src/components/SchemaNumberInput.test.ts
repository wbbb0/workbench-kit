import { mount } from "@vue/test-utils";
import { expect, it } from "vitest";
import SchemaNumberInput from "./SchemaNumberInput.vue";
import SchemaField from "./SchemaField.vue";
const number = {
  kind: "number",
  optional: false,
  hasDefault: true,
  defaultValue: 10,
};
it("有限范围提供滑条，step 和手动无效输入分别保留", async () => {
  const w = mount(SchemaNumberInput, {
    props: {
      schema: { ...number, min: 0, max: 1, step: 0.1 },
      modelValue: 0,
      preserveRawNumber: true,
    },
  });
  expect(w.get('input[type="range"]').attributes("step")).toBe("0.1");
  await w.get('input[type="range"]').setValue("0.7");
  expect(w.emitted("update:modelValue")?.at(-1)).toEqual([0.7]);
  await w.get('input[inputmode="decimal"]').setValue("1e");
  expect(w.emitted("update:modelValue")?.at(-1)).toEqual(["1e"]);
  await w.setProps({ schema: { ...number, min: 0 } });
  expect(w.find('input[type="range"]').exists()).toBe(false);
  w.unmount();
});
it("timescale 决定显示单位，切换单位不修改存储，输入和清空正确换算", async () => {
  const w = mount(SchemaNumberInput, {
    props: {
      schema: { ...number, format: "duration", timescale: "h", step: 1 },
      modelValue: undefined,
      defaultValue: 86400000,
      preserveRawNumber: true,
    },
  });
  const input = w.get('input[inputmode="decimal"]');
  expect(input.attributes("placeholder")).toBe("24");
  expect((input.element as HTMLInputElement).value).toBe("");
  await input.setValue("1.5");
  expect(w.emitted("update:modelValue")?.at(-1)).toEqual([5400000]);
  await w.setProps({ modelValue: 5400000 });
  await w.get("select").setValue("60000");
  expect((input.element as HTMLInputElement).value).toBe("90");
  expect(w.emitted("update:modelValue")).toHaveLength(1);
  await input.setValue("");
  expect(w.emitted("update:modelValue")?.at(-1)).toEqual([""]);
  w.unmount();
  const defaults = mount(SchemaNumberInput, {
    props: { schema: { ...number, format: "duration" }, modelValue: 120000 },
  });
  expect((defaults.get("select").element as HTMLSelectElement).value).toBe("1");
  await defaults.setProps({ schema: { ...number, format: "duration", timescale: "s" } });
  expect((defaults.get("select").element as HTMLSelectElement).value).toBe("1000");
  expect((defaults.get('input[inputmode="decimal"]').element as HTMLInputElement).value).toBe("120");
  defaults.unmount();
});
it.each(["date", "time", "datetime-local", "email", "url"])(
  "字符串格式 %s 自动选择原生控件",
  async (format) => {
    const w = mount(SchemaField, {
      props: {
        schema: {
          kind: "string",
          optional: true,
          hasDefault: false,
          format,
          step: 60,
        },
        modelValue: undefined,
      },
    });
    expect(w.get("input").attributes("type")).toBe(format);
    expect(w.get("input").attributes("step")).toBe("60");
    w.unmount();
  },
);
