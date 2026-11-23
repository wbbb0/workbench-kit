import { createApp, defineComponent, h, KeepAlive, ref } from "vue";
import MessageTimeline from "../../packages/vue-workbench/src/messages/MessageTimeline.vue";
const rows = Array.from({ length: 120 }, (_, index) => ({
  id: String(index),
  kind: "record",
  version: 1,
  heading: "Record " + index,
  parts: [{ type: "text", text: "Body " + index + "\n\nSecond paragraph" }],
}));
createApp(
  defineComponent({
    setup() {
      const visible = ref(true);
      const anchor = ref({ id: "40", offset: 8, bottom: false });
      return () => [
        h(
          "button",
          { id: "switch", onClick: () => (visible.value = !visible.value) },
          "Switch",
        ),
        h("div", { id: "stage" }, [
          h(KeepAlive, null, () =>
            visible.value
              ? h(MessageTimeline, {
                  items: rows,
                  anchor: anchor.value,
                  onAnchor: (value) => {
                    anchor.value = value;
                  },
                })
              : null,
          ),
        ]),
      ];
    },
  }),
).mount("#app");
