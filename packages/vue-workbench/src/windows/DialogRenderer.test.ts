import { defineComponent, h, nextTick, onMounted, reactive } from "vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import DialogRenderer from "./DialogRenderer.vue";
import { createWindowManager } from "./windowManager.js";

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

  it("derives footer action state from values written by a component block", async () => {
    const StateBlock = defineComponent({
      props: { values: { type: Object, required: true } },
      setup(props) {
        return () => h("button", {
          "data-test": "make-valid",
          onClick: () => {
            props.values.valid = true;
            props.values.updating = true;
          }
        }, "make valid");
      }
    });
    const wrapper = mount(DialogRenderer, {
      props: {
        windowId: "dynamic-action",
        definition: {
          kind: "dialog",
          title: "Dynamic action",
          size: "lg",
          blocks: [{ kind: "component", component: StateBlock }],
          actions: [{
            id: "save",
            label: ({ values }) => values.updating ? "Update" : "Add",
            disabled: ({ values }) => values.valid !== true
          }]
        }
      }
    });

    const action = wrapper.get('[data-action-id="save"]');
    expect(action.text()).toBe("Add");
    expect((action.element as HTMLButtonElement).disabled).toBe(true);
    await wrapper.get('[data-test="make-valid"]').trigger("click");
    expect(action.text()).toBe("Update");
    expect((action.element as HTMLButtonElement).disabled).toBe(false);
  });
});


describe("DialogRenderer live props factories", () => {
  it("preserves controller callbacks and live state through window snapshots", async () => {
    const state = reactive({ label: "Initial", ready: false });
    const controller: { apply?: () => string } = {};
    const Consumer = defineComponent({
      props: { controller: { type: Object, required: true }, label: { type: String, required: true } },
      setup(props) {
        onMounted(() => { props.controller.apply = () => props.label; });
        return () => h("span", { "data-test": "live-label" }, props.label);
      }
    });
    const manager = createWindowManager();
    manager.openSync({
      id: "factory", kind: "dialog", title: "Tool", size: "full",
      blocks: [{ kind: "component", component: Consumer, props: () => ({ controller, label: state.label }) }],
      actions: [{ id: "apply", label: "Apply", disabled: () => !state.ready, run: () => controller.apply?.() }]
    });
    const definition = manager.snapshot()[0]!.definition;
    const wrapper = mount(DialogRenderer, { props: { windowId: "factory", definition } });
    expect(controller.apply?.()).toBe("Initial");
    expect((wrapper.get('[data-action-id="apply"]').element as HTMLButtonElement).disabled).toBe(true);
    state.label = "Updated"; state.ready = true;
    await nextTick();
    expect(wrapper.get('[data-test="live-label"]').text()).toBe("Updated");
    expect(controller.apply?.()).toBe("Updated");
    await wrapper.get('[data-action-id="apply"]').trigger("click");
    expect(wrapper.emitted("resolve")?.[0]?.[0]).toMatchObject({ reason: "action", result: "Updated" });
    wrapper.unmount();
  });
});
