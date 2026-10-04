import { mount, flushPromises } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import FileEntryList from "./FileEntryList.vue";
const entries = Array.from({length:1000},(_,index)=>({name:`File ${index}`,path:`file-${index}`,kind:"file" as const,sizeBytes:100,updatedAtMs:0}));
function viewport(width:number,height=400) { vi.stubGlobal("ResizeObserver",class { callback:ResizeObserverCallback; constructor(callback:ResizeObserverCallback){this.callback=callback;}observe(){this.callback([{contentRect:{width,height}}] as ResizeObserverEntry[],this as unknown as ResizeObserver);}disconnect(){} }); }
afterEach(()=>vi.unstubAllGlobals());
describe("FileEntryList",()=>{
  it("finds accessible entries for Home and End when the endpoints are disabled",async()=>{
    viewport(1000);const items=entries.slice(0,4).map((entry,index)=>({...entry,disabledReason:index===0 || index===3 ? "不可访问" : undefined}));
    const wrapper=mount(FileEntryList,{props:{entries:items,focusedPath:"file-2"}});await flushPromises();
    await wrapper.get('[role="listbox"]').trigger("keydown",{key:"Home"});expect(wrapper.emitted("focusEntry")?.at(-1)?.[0]).toEqual(items[1]);
    await wrapper.get('[role="listbox"]').trigger("keydown",{key:"End"});expect(wrapper.emitted("focusEntry")?.at(-1)?.[0]).toEqual(items[2]);wrapper.unmount();
  });
  it("shows the accepted drop target and blocks a forbidden drop",async()=>{
    viewport(1000);let allowed=true;const directory={path:"dir",name:"Directory",kind:"directory" as const};
    const wrapper=mount(FileEntryList,{props:{entries:[directory],dropEnabled:true,dropEffect:()=>allowed ? "move" : "none"}});await flushPromises();
    const data={types:["Files"],dropEffect:"none"};const row=wrapper.get('[role="option"]');
    await row.trigger("dragover",{dataTransfer:data});expect(data.dropEffect).toBe("move");expect(row.classes()).toContain("file-entry-drop-target");expect(wrapper.text()).toContain("移动到Directory");
    allowed=false;await row.trigger("drop",{dataTransfer:data});expect(wrapper.emitted("dropEntries")).toBeUndefined();wrapper.unmount();
  });
  it("virtualizes large desktop directories and keeps mouse selection and range selection",async()=>{
    viewport(1000); const wrapper=mount(FileEntryList,{props:{entries}}); await flushPromises();
    expect(wrapper.findAll('[role="option"]').length).toBeLessThan(30);
    await wrapper.findAll('[role="option"]')[1]!.trigger("click"); expect(wrapper.emitted("setSelection")?.at(-1)).toEqual([["file-1"],"file-1"]);
    await wrapper.setProps({selectedPaths:["file-1"],focusedPath:"file-1"});
    await wrapper.findAll('[role="option"]')[3]!.trigger("click",{shiftKey:true}); expect(wrapper.emitted("setSelection")?.at(-1)).toEqual([["file-1","file-2","file-3"],"file-3"]);
    await wrapper.findAll('[role="option"]')[0]!.trigger("dblclick"); expect(wrapper.emitted("openEntry")?.at(-1)).toEqual([entries[0]]); wrapper.unmount();
  });
  it("uses 68px compact virtual rows, touch opening and explicit selection without nested buttons",async()=>{
    viewport(390); const wrapper=mount(FileEntryList,{props:{entries}}); await flushPromises();
    const row=wrapper.find('[role="option"]'); expect(row.attributes("style")).toContain("height: 68px");
    await row.trigger("pointerdown",{pointerType:"touch"}); await row.trigger("click"); expect(wrapper.emitted("openEntry")?.at(-1)).toEqual([entries[0]]);
    const selection=wrapper.findAll("button").find(button=>button.text()==="选择")!; await selection.trigger("click");
    await row.trigger("click"); expect(wrapper.emitted("setSelection")?.at(-1)).toEqual([["file-0"],"file-0"]);
    expect(wrapper.findAll("button button")).toHaveLength(0); wrapper.unmount();
  });
  it("keeps action buttons from changing selection and does not open disabled entries",async()=>{
    viewport(390); const wrapper=mount(FileEntryList,{props:{entries:[{...entries[0]!,disabledReason:"不可访问"}]}}); await flushPromises();
    await wrapper.find('button[aria-label*="更多操作"]').trigger("click"); expect(wrapper.emitted("entryAction")).toHaveLength(1); expect(wrapper.emitted("setSelection")).toBeUndefined();
    await wrapper.find('[role="option"]').trigger("click"); await wrapper.find('[role="option"]').trigger("dblclick"); expect(wrapper.emitted("openEntry")).toBeUndefined(); wrapper.unmount();
  });
});
