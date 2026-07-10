<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { MenuPlacement, MenuStackEntry } from "./types";
import { WORKBENCH_RUNTIME_LAYERS } from "../runtime/layers.js";
import MenuList from "./MenuList.vue";
import { useMenuRuntime } from "./useMenuRuntime";

const { openMenus, closeAllMenus, closeMenu } = useMenuRuntime();

const surfaceElements = new Map<string, HTMLElement>();
const surfaceObservers = new Map<string, ResizeObserver>();
const surfaceSizes = ref<Record<string, { width: number; height: number }>>({});
const viewportRevision = ref(0);
const hostStyle = {
  zIndex: WORKBENCH_RUNTIME_LAYERS.menuHost
};

const MENU_SAFE_INSET_PX = 8;
const MENU_GAP_PX = 4;
const FALLBACK_MENU_WIDTH_PX = 176;
const FALLBACK_MENU_HEIGHT_PX = 120;

const menuOffsets = computed(() =>
  Object.fromEntries(
    openMenus.value.map((menu, index) => [
      menu.id,
      resolveMenuPosition(menu, index)
    ])
  )
);

function setSurfaceElement(menuId: string, element: unknown) {
  const maybeComponentElement = (element as { $el?: unknown } | null)?.$el;
  const resolvedElement =
    element instanceof HTMLElement
      ? element
      : maybeComponentElement instanceof HTMLElement
        ? maybeComponentElement
        : null;

  if (!(resolvedElement instanceof HTMLElement)) {
    surfaceObservers.get(menuId)?.disconnect();
    surfaceObservers.delete(menuId);
    surfaceElements.delete(menuId);
    const { [menuId]: _removed, ...remainingSizes } = surfaceSizes.value;
    surfaceSizes.value = remainingSizes;
    return;
  }

  if (surfaceElements.get(menuId) === resolvedElement) {
    return;
  }
  surfaceObservers.get(menuId)?.disconnect();
  surfaceElements.set(menuId, resolvedElement);
  measureSurface(menuId, resolvedElement);
  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(() => measureSurface(menuId, resolvedElement));
    observer.observe(resolvedElement);
    surfaceObservers.set(menuId, observer);
  }
}

function measureSurface(menuId: string, element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const nextSize = { width: Math.ceil(rect.width), height: Math.ceil(rect.height) };
  const currentSize = surfaceSizes.value[menuId];
  if (currentSize?.width === nextSize.width && currentSize.height === nextSize.height) {
    return;
  }
  surfaceSizes.value = { ...surfaceSizes.value, [menuId]: nextSize };
}

function resolveMenuPosition(menu: MenuStackEntry, index: number) {
  viewportRevision.value;
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1024;
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 768;
  const safeWidth = Math.max(0, viewportWidth - MENU_SAFE_INSET_PX * 2);
  const safeHeight = Math.max(0, viewportHeight - MENU_SAFE_INSET_PX * 2);
  const size = surfaceSizes.value[menu.id] ?? {
    width: FALLBACK_MENU_WIDTH_PX,
    height: FALLBACK_MENU_HEIGHT_PX
  };
  const menuWidth = Math.min(size.width, safeWidth);
  const menuHeight = Math.min(size.height, safeHeight);
  let left = 12;
  let top = 56;
  let placement: MenuPlacement = menu.placement ?? (menu.parentId ? "right-start" : "bottom-start");

  if ("x" in menu.anchor) {
    left = menu.anchor.x;
    top = menu.anchor.y;
  } else if (menu.anchor.element) {
    const rect = menu.anchor.element.getBoundingClientRect();
    ({ left, top } = positionFromAnchor(rect, placement, menuWidth, menuHeight));

    if (placement === "bottom-start" || placement === "bottom-end") {
      const opensBelow = rect.bottom + MENU_GAP_PX + menuHeight <= viewportHeight - MENU_SAFE_INSET_PX;
      const opensAbove = rect.top - MENU_GAP_PX - menuHeight >= MENU_SAFE_INSET_PX;
      if (!opensBelow && opensAbove) {
        top = rect.top - MENU_GAP_PX - menuHeight;
      }
    } else {
      const opensRight = rect.right + MENU_GAP_PX + menuWidth <= viewportWidth - MENU_SAFE_INSET_PX;
      const opensLeft = rect.left - MENU_GAP_PX - menuWidth >= MENU_SAFE_INSET_PX;
      if ((placement === "right-start" && !opensRight && opensLeft) || (placement === "left-start" && !opensLeft && opensRight)) {
        placement = placement === "right-start" ? "left-start" : "right-start";
        ({ left, top } = positionFromAnchor(rect, placement, menuWidth, menuHeight));
      }
    }
  } else {
    left = 12 + index * 220;
    top = 56 + index * 12;
  }

  left = clamp(left, MENU_SAFE_INSET_PX, Math.max(MENU_SAFE_INSET_PX, viewportWidth - MENU_SAFE_INSET_PX - menuWidth));
  top = clamp(top, MENU_SAFE_INSET_PX, Math.max(MENU_SAFE_INSET_PX, viewportHeight - MENU_SAFE_INSET_PX - menuHeight));

  return {
    left: `${left}px`,
    top: `${top}px`,
    maxWidth: `${safeWidth}px`,
    maxHeight: `${safeHeight}px`,
    overflow: "auto"
  };
}

function positionFromAnchor(rect: DOMRect, placement: MenuPlacement, width: number, height: number) {
  if (placement === "bottom-end") {
    return { left: rect.right - width, top: rect.bottom + MENU_GAP_PX };
  }
  if (placement === "right-start") {
    return { left: rect.right + MENU_GAP_PX, top: rect.top };
  }
  if (placement === "left-start") {
    return { left: rect.left - width - MENU_GAP_PX, top: rect.top };
  }
  return { left: rect.left, top: rect.bottom + MENU_GAP_PX };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(value, maximum));
}

function refreshMenuPositions() {
  viewportRevision.value += 1;
}

function focusLatestMenuItem() {
  const latestMenu = openMenus.value.at(-1);
  if (!latestMenu) {
    return;
  }

  const surface = surfaceElements.get(latestMenu.id);
  const firstItem = surface?.querySelector<HTMLElement>("[data-menu-item='true']");
  firstItem?.focus();
}

function handlePointerDown(event: PointerEvent) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    closeAllMenus();
    return;
  }

  if (target.closest("[data-menu-surface]") || target.closest("[data-menu-trigger]")) {
    return;
  }

  closeAllMenus();
}

function moveFocus(step: number) {
  const latestMenu = openMenus.value.at(-1);
  if (!latestMenu) {
    return;
  }

  const surface = surfaceElements.get(latestMenu.id);
  const items = surface ? Array.from(surface.querySelectorAll<HTMLElement>("[data-menu-item='true']")) : [];
  if (items.length === 0) {
    return;
  }

  const activeIndex = items.findIndex((item) => item === document.activeElement);
  const nextIndex = activeIndex < 0 ? 0 : (activeIndex + step + items.length) % items.length;
  items[nextIndex]?.focus();
}

function handleKeydown(event: KeyboardEvent) {
  if (openMenus.value.length === 0) {
    return;
  }

  if (event.key === "Escape") {
    closeAllMenus();
    return;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    moveFocus(1);
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    moveFocus(-1);
    return;
  }

  if (event.key === "ArrowLeft" && openMenus.value.length > 1) {
    event.preventDefault();
    closeMenu(openMenus.value.at(-1)?.id ?? "");
    nextTick(() => focusLatestMenuItem());
    return;
  }

  if (event.key === "ArrowRight" || event.key === "Enter") {
    const activeElement = document.activeElement;
    if (!(activeElement instanceof HTMLButtonElement)) {
      return;
    }

    if (activeElement.dataset.menuKind === "submenu") {
      event.preventDefault();
      activeElement.click();
    }
  }
}

watch(
  () => openMenus.value.map((menu) => menu.id),
  async () => {
    await nextTick();
    focusLatestMenuItem();
  }
);

onMounted(() => {
  window.addEventListener("pointerdown", handlePointerDown, true);
  window.addEventListener("keydown", handleKeydown);
  window.addEventListener("resize", refreshMenuPositions);
  window.addEventListener("scroll", refreshMenuPositions, true);
  window.visualViewport?.addEventListener("resize", refreshMenuPositions);
  window.visualViewport?.addEventListener("scroll", refreshMenuPositions);
});

onBeforeUnmount(() => {
  window.removeEventListener("pointerdown", handlePointerDown, true);
  window.removeEventListener("keydown", handleKeydown);
  window.removeEventListener("resize", refreshMenuPositions);
  window.removeEventListener("scroll", refreshMenuPositions, true);
  window.visualViewport?.removeEventListener("resize", refreshMenuPositions);
  window.visualViewport?.removeEventListener("scroll", refreshMenuPositions);
  surfaceObservers.forEach((observer) => observer.disconnect());
  surfaceObservers.clear();
});
</script>

<template>
  <div class="pointer-events-none fixed inset-0" :style="hostStyle">
    <div
      v-for="menu in openMenus"
      :key="menu.id"
      :ref="(element: unknown) => setSurfaceElement(menu.id, element)"
      class="pointer-events-auto absolute rounded-md border border-border-default bg-surface-panel shadow-xl"
      data-menu-surface="true"
      :style="menuOffsets[menu.id]"
    >
      <MenuList :items="menu.items" :menu-id="menu.id" :source="menu.source" />
    </div>
  </div>
</template>
