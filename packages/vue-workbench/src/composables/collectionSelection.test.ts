import { mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { describe, expect, it, vi } from "vitest";
import { useCollectionSelection } from "./useCollectionSelection.js";
import { useMarqueeSelection } from "./useMarqueeSelection.js";
describe("collection selection",()=>{
  it("ranges across item order and falls back from missing focus when selecting all",()=>{
    const onChange=vi.fn();const selection=useCollectionSelection({keys:()=>["a","b","c"],selectedKeys:()=>["c"],focusedKey:()=>"removed",onChange});
    selection.all();expect(onChange).toHaveBeenLastCalledWith(["a","b","c"],"a");
    selection.select("a");selection.select("c",{range:true});expect(onChange).toHaveBeenLastCalledWith(["a","b","c"],"c");
    selection.select("missing");expect(onChange).toHaveBeenCalledTimes(3);
  });
  it("restores the original selection on pointer cancellation and ignores secondary/touch starts",()=>{
    const onChange=vi.fn();let marquee!:ReturnType<typeof useMarqueeSelection>;
    const wrapper=mount(defineComponent({setup(){marquee=useMarqueeSelection({point:event=>({x:event.clientX,y:event.clientY}),hitTest:()=>["b"],selectedKeys:()=>["a"],onChange});return()=>h("div",{onPointerdown:marquee.start});}}));
    const target=wrapper.get("div").element;
    target.dispatchEvent(new PointerEvent("pointerdown",{pointerId:1,button:2,isPrimary:true}));expect(onChange).not.toHaveBeenCalled();
    target.dispatchEvent(new PointerEvent("pointerdown",{pointerId:2,pointerType:"touch",button:0,isPrimary:true}));expect(onChange).not.toHaveBeenCalled();
    target.dispatchEvent(new PointerEvent("pointerdown",{pointerId:3,pointerType:"mouse",button:0,isPrimary:true,clientX:0,clientY:0}));
    window.dispatchEvent(new PointerEvent("pointermove",{pointerId:3,clientX:20,clientY:20}));expect(onChange).toHaveBeenLastCalledWith(["b"]);
    window.dispatchEvent(new PointerEvent("pointercancel",{pointerId:3}));expect(onChange).toHaveBeenLastCalledWith(["a"]);expect(marquee.rect.value).toBeNull();wrapper.unmount();
  });
});
