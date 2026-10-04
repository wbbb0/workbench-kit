import { h } from "vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { ArrowLeft } from "lucide-vue-next";
import WorkbenchPageRoot from "../layouts/WorkbenchPageRoot.vue";
import WorkbenchActionToolbar from "./WorkbenchActionToolbar.vue";
describe("WorkbenchActionToolbar",()=>{
  it("preserves accessible action labels while showing icon-only controls",async()=>{
    const wrapper=mount(WorkbenchPageRoot,{slots:{actions:()=>h(WorkbenchActionToolbar,{actions:[{id:"back",label:"Back",icon:ArrowLeft,iconOnly:true},{id:"refresh",label:"Refresh",disabled:true}]})}});
    const toolbar=wrapper.getComponent(WorkbenchActionToolbar);
    const button=wrapper.get('button[aria-label="Back"]');expect(button.text()).toBe("");expect(button.attributes("title")).toBe("Back");await button.trigger("click");expect(toolbar.emitted("action")).toEqual([["back"]]);
    const refresh=wrapper.findAll('button').find(button=>button.text()==="Refresh")!;expect(refresh.attributes("disabled")).toBeDefined();wrapper.unmount();
  });
});
