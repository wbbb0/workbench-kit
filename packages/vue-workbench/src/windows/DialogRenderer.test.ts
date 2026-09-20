import { defineComponent, h } from "vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import DialogRenderer from "./DialogRenderer.vue";

const CustomBlock = defineComponent({
  name: "CustomBlock",
  setup: () => () => h("div", { "data-test": "custom-block" }, "content")
});

describe("DialogRenderer", () => {
  it("lets an opted-in component block fill the available content height", () => {
    const wrapper = mount(DialogRenderer, {
      props: {
        windowId: "growing-block",
        definition: {
          kind: "dialog",
          title: "Growing block",
          size: "lg",
          blocks: [{ kind: "component", component: CustomBlock, grow: true }]
        }
      }
    });

    expect(wrapper.get("[data-dialog-blocks]").classes()).toContain("flex-1");
    expect(wrapper.get('[data-test="custom-block"]').classes()).toContain("flex-1");
  });

  it("keeps ordinary dialog blocks content-sized by default", () => {
    const wrapper = mount(DialogRenderer, {
      props: {
        windowId: "content-sized-block",
        definition: {
          kind: "dialog",
          title: "Content-sized block",
          size: "sm",
          blocks: [{ kind: "component", component: CustomBlock }]
        }
      }
    });

    expect(wrapper.get("[data-dialog-blocks]").classes()).not.toContain("flex-1");
  });
});
