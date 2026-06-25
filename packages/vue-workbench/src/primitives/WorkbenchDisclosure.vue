<script setup lang="ts">
withDefaults(defineProps<{
  expanded: boolean;
  title?: string;
  collapsedTitle?: string;
  expandedTitle?: string;
  summary?: string | null;
  bodyClass?: string;
  maxBodyHeightClass?: string;
  variant?: "card" | "plain";
}>(), {
  collapsedTitle: undefined,
  expandedTitle: undefined,
  title: "",
  summary: null,
  bodyClass: "",
  maxBodyHeightClass: "max-h-[min(32rem,60dvh)]",
  variant: "card"
});

defineEmits<{
  toggle: [];
}>();
</script>

<template>
  <div
    :class="[
      expanded && variant === 'card' ? 'overflow-hidden rounded-lg border border-border-default bg-surface-input' : 'flex flex-col',
      expanded && variant === 'plain' ? 'overflow-hidden' : ''
    ]"
  >
    <button
      :class="[
        'flex w-full cursor-pointer items-center justify-between gap-3 px-2.5 py-1.75 text-left text-small text-text-muted hover:text-text-primary',
        expanded && variant === 'card' ? 'border-0 border-b border-border-default bg-transparent' : '',
        !expanded && variant === 'card' ? 'rounded-lg border border-border-default bg-surface-input' : '',
        variant === 'plain' ? 'rounded-sm bg-transparent px-1 py-1 hover:bg-transparent hover:text-text-secondary' : ''
      ]"
      type="button"
      @click="$emit('toggle')"
    >
      <span class="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
        {{ expanded ? expandedTitle ?? title : collapsedTitle ?? title }}
      </span>
      <span v-if="summary" class="min-w-0 shrink overflow-hidden text-ellipsis whitespace-nowrap text-right">{{ summary }}</span>
    </button>
    <div
      v-if="expanded"
      :class="[
        'scrollbar-thin flex flex-col gap-2 overflow-auto',
        variant === 'card' ? 'p-2.5' : 'px-1 pb-1 pt-1',
        maxBodyHeightClass,
        bodyClass
      ]"
    >
      <slot />
    </div>
  </div>
</template>
