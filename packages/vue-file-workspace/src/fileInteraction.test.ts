import { h, defineComponent } from "vue";
import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useFileClipboard } from "./composables/useFileClipboard.js";
import { filesToUploadEntries, normalizeUploadPath, useFilePicker } from "./composables/useFilePicker.js";
import { readFileDrop, FILE_WORKSPACE_DRAG_TYPE, useFileDrop } from "./composables/useFileDrop.js";

afterEach(() => vi.unstubAllGlobals());
describe("file inputs", () => {
  it("keeps relative upload paths and rejects traversal and absolute paths", () => {
    expect(normalizeUploadPath("folder\\sub//./file.txt")).toBe("folder/sub/file.txt");
    for (const path of ["/etc/passwd", "C:\\file", "a/../b", "..\\a", "a\0b", ""]) expect(() => normalizeUploadPath(path)).toThrow();
    const file = new File(["content"], "a.txt");
    expect(filesToUploadEntries([file])).toEqual([{ kind: "file", relativePath: "a.txt", file }]);
  });
  it("snapshots all DataTransfer entries before asynchronous traversal and preserves empty directories", async () => {
    let protectedMode = false;
    const file = new File(["a"], "a.txt");
    const empty = { name: "empty", isDirectory: true, isFile: false, createReader: () => ({readEntries: (done: (items: unknown[]) => void) => done([])}) };
    const source = { name:"a.txt",isFile:true,isDirectory:false,file:(done: (file: File) => void) => { protectedMode = true; done(file); } };
    const makeItem = (entry: unknown) => ({kind:"file",webkitGetAsEntry:() => { if(protectedMode) throw new Error("DataTransfer protected"); return entry; },getAsFile:()=>null});
    const payload = await readFileDrop({ types:["Files"],files:[],items:[makeItem(source),makeItem(empty)] } as unknown as DataTransfer);
    expect(payload).toEqual({type:"external",entries:[{relativePath:"a.txt",kind:"file",file},{relativePath:"empty",kind:"directory"}]});
  });
  it("reads every browser directory batch", async () => {
    let batch = 0;
    const file = new File([], "a.txt");
    const entry = { name:"dir",isDirectory:true,isFile:false,createReader:()=>({readEntries:(done:(items: unknown[])=>void)=>done(batch++ === 0 ? [{name:"a.txt",isFile:true,isDirectory:false,file:(done:(file:File)=>void)=>done(file)}] : batch === 2 ? [{name:"empty",isDirectory:true,isFile:false,createReader:()=>({readEntries:(done:(items:unknown[])=>void)=>done([])})}] : [])}) };
    const payload = await readFileDrop({types:["Files"],files:[],items:[{kind:"file",webkitGetAsEntry:()=>entry,getAsFile:()=>null}]} as unknown as DataTransfer);
    expect(payload.type === "external" && payload.entries.map(item=>item.relativePath)).toEqual(["dir","dir/a.txt","dir/empty"]);
  });
  it("validates internal drag payloads", async () => {
    const data = {types:[FILE_WORKSPACE_DRAG_TYPE],getData:()=>JSON.stringify({location:{rootId:"a",path:""},entries:[{path:"p",name:"p",kind:"file"}]})};
    expect((await readFileDrop(data as unknown as DataTransfer)).type).toBe("internal");
    data.getData = () => JSON.stringify({location:{rootId:"a",path:""},entries:[{path:"p",name:"p",kind:"unknown"}]});
    await expect(readFileDrop(data as unknown as DataTransfer)).rejects.toThrow("Invalid file drag payload");
  });
  it("uses the native directory picker to retain empty directories", async () => {
    const empty = {name:"empty",kind:"directory",async *values(){}};
    Object.defineProperty(window,"showDirectoryPicker",{ configurable:true,value:vi.fn(async()=>({name:"root",kind:"directory",async *values(){yield empty;}})) });
    let picker!: ReturnType<typeof useFilePicker>;
    const wrapper = mount(defineComponent({setup(){picker=useFilePicker();return()=>h("div");}}));
    expect(await picker.pick({directory:true})).toEqual([{relativePath:"root",kind:"directory"},{relativePath:"root/empty",kind:"directory"}]);
    wrapper.unmount(); delete (window as unknown as Record<string,unknown>).showDirectoryPicker;
  });
  it("defaults drops to copy and marks disabled targets as none", () => {
    let disabled = false;
    let drop!: ReturnType<typeof useFileDrop>;
    const wrapper = mount(defineComponent({setup(){drop=useFileDrop({onDrop:vi.fn(),disabled:()=>disabled});return()=>h("div");}}));
    const data = {types:["Files"],dropEffect:"move"};
    const event = {dataTransfer:data,preventDefault:vi.fn()} as unknown as DragEvent;
    drop.onDragover(event); expect(data.dropEffect).toBe("copy");
    disabled = true; drop.onDragover(event); expect(data.dropEffect).toBe("none"); wrapper.unmount();
  });
});
describe("input cancellation", () => {
  it("rejects invalid fallback paths and cleans up the temporary input", async () => {
    let picker!: ReturnType<typeof useFilePicker>;
    const wrapper = mount(defineComponent({setup(){picker=useFilePicker();return()=>h("div");}}));
    const picked = picker.pick();
    const expectation = expect(picked).rejects.toThrow("Invalid relative upload path");
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([],"file");Object.defineProperty(file,"webkitRelativePath",{value:"../file"});Object.defineProperty(input,"files",{value:[file]});
    input.dispatchEvent(new Event("change"));await expectation;expect(input.isConnected).toBe(false);wrapper.unmount();
  });
  it("ignores native picker completion after unmount", async () => {
    let complete!: (handle: unknown) => void;
    Object.defineProperty(window,"showDirectoryPicker",{ configurable:true,value:()=>new Promise(resolve=>{complete=resolve;}) });
    let picker!: ReturnType<typeof useFilePicker>;
    const wrapper = mount(defineComponent({setup(){picker=useFilePicker();return()=>h("div");}}));
    const picked = picker.pick({directory:true});wrapper.unmount();complete({name:"root",kind:"directory",async *values(){}});
    expect(await picked).toEqual([]);expect(picker.entries.value).toEqual([]);delete (window as unknown as Record<string,unknown>).showDirectoryPicker;
  });
  it("blocks forbidden drop effects and cancels pending directory traversal", async () => {
    let complete!: (file: File) => void;
    let forbidden = true;
    const onDrop = vi.fn();let drop!: ReturnType<typeof useFileDrop>;
    const wrapper = mount(defineComponent({setup(){drop=useFileDrop({onDrop,dropEffect:()=>forbidden ? "none" : "copy"});return()=>h("div");}}));
    const entry={name:"file",isFile:true,isDirectory:false,file:(done:(file:File)=>void)=>{complete=done;}};
    const data={types:["Files"],files:[],items:[{kind:"file",webkitGetAsEntry:()=>entry,getAsFile:()=>null}]};
    const event={dataTransfer:data,preventDefault:vi.fn()} as unknown as DragEvent;
    await drop.onDrop(event);expect(onDrop).not.toHaveBeenCalled();forbidden=false;
    const pending=drop.onDrop(event);drop.cancel();complete(new File([],"file"));await pending;expect(onDrop).not.toHaveBeenCalled();wrapper.unmount();
  });
});
describe("file clipboard", () => {
  it("saves source snapshots and keeps cut entries until the consumer clears them", () => {
    const clipboard = useFileClipboard();
    const source = {location:{rootId:"root",path:"source"},entries:[{path:"source/file",name:"file",kind:"file" as const}]};
    clipboard.cut(source); source.location.path="changed"; source.entries[0]!.name="changed";
    const request = clipboard.pasteRequest({rootId:"target",path:"destination"});
    expect(request).toMatchObject({kind:"move",source:{location:{path:"source"},entries:[{name:"file"}]},target:{rootId:"target"}});
    expect(clipboard.snapshot.value?.mode).toBe("cut"); clipboard.clear(); expect(clipboard.pasteRequest({rootId:"target",path:""})).toBeNull();
  });
});
