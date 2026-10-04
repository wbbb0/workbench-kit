import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import FileLocationPicker from "./FileLocationPicker.vue";
import FileTree from "./FileTree.vue";
const roots=[{id:"a",label:"Root A"},{id:"b",label:"Root B",disabled:true,disabledReason:"只读"}];
describe("FileLocationPicker",()=>{
  it("can delegate confirmation to an external action while keeping browsing controlled",async()=>{
    const wrapper=mount(FileLocationPicker,{props:{roots,client:{listDirectories:vi.fn(async()=>({entries:[]}))},showSelectButton:false}});
    await wrapper.findAll("button").find(button=>button.text()==="Root A")!.trigger("click");await flushPromises();
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([{rootId:"a",path:""}]);expect(wrapper.emitted("select")).toBeUndefined();expect(wrapper.text()).not.toContain("选择此位置");wrapper.unmount();
  });
  it("resets on controlled null and emits null on returning to roots",async()=>{
    const wrapper=mount(FileLocationPicker,{props:{roots,client:{listDirectories:vi.fn(async()=>({entries:[]}))},modelValue:{rootId:"a",path:""}}});await flushPromises();
    await wrapper.findAll("button").find(button=>button.text()==="返回")!.trigger("click");expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([null]);
    await wrapper.setProps({modelValue:{rootId:"a",path:"child"}});await flushPromises();await wrapper.setProps({modelValue:null});expect(wrapper.text()).toContain("选择根目录");expect(wrapper.text()).not.toContain("选择此位置");wrapper.unmount();
  });
  it("loads roots and paged directories while final selection remains explicit",async()=>{
    const client={listDirectories:vi.fn(async(location:{path:string},options?:{cursor?:string})=>({entries:location.path ? [] : options?.cursor ? [{name:"other",path:"other"}] : [{name:"child",path:"child"}],nextCursor:location.path || options?.cursor ? undefined : "next"}))};
    const wrapper=mount(FileLocationPicker,{props:{roots,client}});
    const rootButton=wrapper.findAll("button").find(button=>button.text()==="Root A")!; await rootButton.trigger("click"); await flushPromises();
    expect(wrapper.emitted("select")).toBeUndefined();
    const more=wrapper.findAll("button").find(button=>button.text()==="加载更多")!;await more.trigger("click");await flushPromises();
    expect(client.listDirectories.mock.calls[1]?.[1]).toMatchObject({cursor:"next"});expect(wrapper.text()).toContain("other");
    const child=wrapper.findAll("button").find(button=>button.text()==="child")!;await child.trigger("click");await flushPromises();
    const select=wrapper.findAll("button").find(button=>button.text()==="选择此位置")!;await select.trigger("click");
    expect(wrapper.emitted("select")?.at(-1)).toEqual([{rootId:"a",path:"child"}]);wrapper.unmount();
  });
  it("rejects stale replies and disabled or removed roots",async()=>{
    let resolveFirst!: (value:{entries:{name:string;path:string}[]})=>void;
    const client={listDirectories:vi.fn().mockImplementationOnce(()=>new Promise(resolve=>{resolveFirst=resolve;})).mockResolvedValue({entries:[{name:"latest",path:"latest"}]})};
    const wrapper=mount(FileLocationPicker,{props:{roots,client,modelValue:{rootId:"a",path:"first"}}});
    await wrapper.setProps({modelValue:{rootId:"a",path:"second"}});await flushPromises();resolveFirst({entries:[{name:"stale",path:"stale"}]});await flushPromises();
    expect(wrapper.text()).toContain("latest");expect(wrapper.text()).not.toContain("stale");
    await wrapper.setProps({roots:[]});const select=wrapper.findAll("button").find(button=>button.text()==="选择此位置")!;expect(select.attributes("disabled")).toBeDefined();wrapper.unmount();
  });
});
describe("FileTree compatibility",()=>{
  it("lets navigation-mode directory labels select without losing the separate expand action",async()=>{
    const dir={name:"dir",path:"dir",kind:"directory" as const,sizeBytes:0,updatedAtMs:0};
    const wrapper=mount(FileTree,{props:{items:[dir],expandedPaths:[],itemsByPath:{},selectedPath:null,directoryNavigation:true},slots:{meta:()=>[]}});
    const folder=wrapper.findAll("button").find(button=>button.text()==="dir")!;await folder.trigger("click");
    expect(wrapper.emitted("selectItem")).toEqual([[dir]]);expect(wrapper.emitted("toggleDirectory")).toBeUndefined();
    await wrapper.get('button[aria-label="展开 dir"]').trigger("click");expect(wrapper.emitted("toggleDirectory")).toEqual([["dir"]]);wrapper.unmount();
  });
  it("preserves old toggle/selection events and forwards directory footer and actions recursively",async()=>{
    const dir={name:"dir",path:"dir",kind:"directory" as const,sizeBytes:0,updatedAtMs:0};const child={...dir,name:"child",path:"dir/child",kind:"file" as const};
    const wrapper=mount(FileTree,{props:{items:[dir],expandedPaths:["dir"],itemsByPath:{dir:[child]},selectedPath:null,showActions:true,contextActions:true},slots:{directoryEnd:'<span class="directory-footer">More directories</span>'}});
    expect(wrapper.findAll(".directory-footer")).toHaveLength(1);
    const folder=wrapper.findAll("button").find(button=>button.text()==="dir")!;await folder.trigger("click");expect(wrapper.emitted("toggleDirectory")).toEqual([["dir"]]);
    const file=wrapper.findAll("button").find(button=>button.text()==="child")!;await file.trigger("click");expect(wrapper.emitted("selectItem")).toEqual([[child]]);
    await file.trigger("contextmenu");expect(wrapper.emitted("itemAction")?.[0]?.[0]).toEqual(child);
    const childShell=wrapper.findAll('.tree-shell-header')[1]!.element.parentElement!;
    childShell.dispatchEvent(new Event('dragstart',{bubbles:true}));expect(wrapper.emitted('dragItem')).toHaveLength(1);expect(wrapper.emitted('dragItem')?.[0]?.[0]).toEqual(child);
    const action=wrapper.find('button[aria-label="child 的更多操作"]');await action.trigger("click");expect(wrapper.emitted("itemAction")?.[0]?.[0]).toEqual(child);wrapper.unmount();
  });
});
