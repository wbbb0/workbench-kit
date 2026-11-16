<script setup lang="ts">
import { computed } from "vue";
import MarkdownIt from "markdown-it";
import hljs from "highlight.js/lib/common";
import type { MessagePart } from "./types";
const props = defineProps<{ parts: MessagePart[] }>();
const md: MarkdownIt = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  highlight(code: string, language: string): string {
    return hljs.getLanguage(language)
      ? hljs.highlight(code, { language }).value
      : md.utils.escapeHtml(code);
  },
});
const fence = md.renderer.rules.fence!;
md.renderer.rules.fence = (tokens, index, options, env, renderer) => {
  const token = tokens[index]!;
  const body = fence(tokens, index, options, env, renderer);
  const long =
    token.content.split("\n").length > 50 || token.content.length > 4000;
  const header =
    '<div class="flex items-center justify-between px-3 py-1 text-xs"><span>' +
    md.utils.escapeHtml(token.info || "代码") +
    '</span><button type="button" data-copy-code>复制代码</button></div>';
  const content = '<div class="wb-code">' + header + body + "</div>";
  return long
    ? '<details><summary class="text-xs cursor-pointer py-2">展开长代码（' +
        token.content.split("\n").length +
        " 行）</summary>" +
        content +
        "</details>"
    : content;
};
const blocks = computed(() =>
  props.parts.map((p) => ({
    ...p,
    html:
      p.type === "text"
        ? md.render(p.text)
        : p.type === "code"
          ? md.render("```" + (p.language ?? "") + "\n" + p.text + "\n```")
          : "",
  })),
);
function copy(event: MouseEvent) {
  const target = event.target as HTMLElement;
  const code = target
    .closest("[data-copy-code]")
    ?.closest(".wb-code")
    ?.querySelector("pre");
  if (!code) return;
  const select = () => {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(code);
    selection?.removeAllRanges();
    selection?.addRange(range);
  };
  if (navigator.clipboard?.writeText)
    void navigator.clipboard.writeText(code.textContent ?? "").catch(select);
  else select();
}
</script>
<template>
  <div
    class="wb-message-content break-words text-[15px] leading-7"
    @click="copy"
  >
    <template v-for="(block, i) in blocks" :key="i"
      ><template v-if="block.type === 'image'"
        ><img
          v-if="block.url"
          :src="block.url"
          :alt="block.label"
          class="max-h-96 max-w-full"
          loading="lazy"
        />
        <p v-else class="text-text-muted">
          附件不可用：{{ block.label }}
        </p></template
      >
      <div v-else v-html="block.html"
    /></template>
  </div>
</template>
