import { mount, flushPromises } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import FileOperationPanel from "./FileOperationPanel.vue";
import FileConflictPanel from "./FileConflictPanel.vue";
describe("operation panels",()=>{
  it("updates the target during browsing and leaves submission to the final operation action",async()=>{
    const entry={name:"file",path:"file",kind:"file" as const};
    const request={kind:"copy" as const,source:{location:{rootId:"a",path:""},entries:[entry]},target:{rootId:"a",path:"old"}};
    const wrapper=mount(FileOperationPanel,{props:{request,roots:[{id:"a",label:"a"}],locationClient:{listDirectories:vi.fn(async()=>({entries:[{name:"new",path:"new"}]}))}}});await flushPromises();
    await wrapper.findAll("button").find(button=>button.text()==="new")!.trigger("click");
    expect(wrapper.emitted("update:request")?.at(-1)?.[0]).toMatchObject({target:{rootId:"a",path:"new"}});expect(wrapper.emitted("submit")).toBeUndefined();expect(wrapper.text()).not.toContain("选择此位置");wrapper.unmount();
  });
  it("prevents submitting to a root disabled after the target was picked",async()=>{
    const entry={name:"file",path:"file",kind:"file" as const};
    const request={kind:"copy" as const,source:{location:{rootId:"a",path:""},entries:[entry]},target:{rootId:"a",path:"dest"}};
    const wrapper=mount(FileOperationPanel,{props:{request,roots:[{id:"a",label:"a"}],locationClient:{listDirectories:vi.fn(async()=>({entries:[]}))}}});
    await wrapper.setProps({roots:[{id:"a",label:"a",disabled:true,disabledReason:"只读"}]});
    const submit=wrapper.findAll("button").find(button=>button.text()==="确认复制")!;expect(submit.attributes("disabled")).toBeDefined();await submit.trigger("click");expect(wrapper.emitted("submit")).toBeUndefined();wrapper.unmount();
  });
  it("does not apply to all when the option was withdrawn",async()=>{
    const entry={name:"file",path:"file",kind:"file" as const};
    const wrapper=mount(FileConflictPanel,{props:{conflict:{id:"1",incoming:entry,existing:entry}}});
    await wrapper.get("input").setValue(true);await wrapper.setProps({allowApplyToAll:false});
    await wrapper.findAll("button").find(button=>button.text()==="跳过")!.trigger("click");expect(wrapper.emitted("resolve")).toEqual([["skip",false]]);wrapper.unmount();
  });
});
