# Usage

`workbench-kit` is intended to be consumed as a git-managed source dependency. The recommended setup is to add this repository to each application as a submodule and reference the aggregate Vue package with a `file:` dependency.

## Add As Submodule

From the application repository root:

```bash
git submodule add https://github.com/wbbb0/workbench-kit.git vendor/workbench-kit
git submodule update --init --recursive
```

## Add Package Dependencies

If the frontend package lives at `webui/`, add dependencies relative to that package:

```json
{
  "dependencies": {
    "@workbench-kit/vue": "file:../vendor/workbench-kit/packages/vue"
  }
}
```

Then install from the application root:

```bash
npm --prefix webui install
```

The consuming app must also install the peer dependencies:

```json
{
  "dependencies": {
    "lucide-vue-next": "^1.0.0",
    "vue": "^3.5.0"
  }
}
```

## Styles

Import one theme template first, then the aggregate workbench styles once from the app stylesheet:

```css
@import "@workbench-kit/vue/theme/midnight.css";
@import "tailwindcss";
@import "@workbench-kit/vue/style.css";
```

`midnight.css` is the default dark/light template extracted from the original llm-onebot WebUI.

Apps can override any token by importing a local file after the template:

```css
@import "@workbench-kit/vue/theme/midnight.css";
@import "./theme-overrides.css";
@import "@workbench-kit/vue/style.css";
```

Example override:

```css
:root,
html[data-theme="dark"] {
  --accent: #2dd4bf;
  --accent-hover: #5eead4;
}
```

`@workbench-kit/vue/style.css` includes the Tailwind `@source` directives for all workbench-kit Vue packages. If a custom build pipeline does not process imported `@source` directives, use this single fallback source path from the app stylesheet:

```css
@source "../../../vendor/workbench-kit/packages";
```

Adjust the relative path to match the app stylesheet location.

## Page Shell And Scrolling

The aggregate style entry intentionally makes the application root a fixed-height workbench surface:

```css
html,
body,
#app,
#__nuxt {
  height: 100%;
  overflow: hidden;
}
```

Do not rely on document/body scrolling after importing `@workbench-kit/vue/style.css`. The consuming app must provide the scroll container.

For a regular Nuxt admin app, prefer `WorkbenchPageRoot`. It provides the app-height shell, internal scroll container, and the workbench runtime hosts needed by toast/menu/window composables:

```vue
<script setup lang="ts">
import { WorkbenchPageRoot } from "@workbench-kit/vue";
</script>

<template>
  <WorkbenchPageRoot title="Auth Server">
    <NuxtPage />

    <template #actions>
      <NuxtLink to="/settings/security">Security</NuxtLink>
      <NuxtLink to="/account">Account</NuxtLink>
    </template>
  </WorkbenchPageRoot>
</template>
```

If the page uses `WorkbenchRoot`, the root shell already owns the workbench-sized viewport and its internal areas own scrolling.

## Choosing A Layout API

Use the lightest workbench component that matches the application shape:

- Use `WorkbenchRoot` for full workbench-style apps that need activity navigation, workbench areas, topbar menus, statusbar items, and multi-window behavior. Mizune-core is the reference shape for this root.
- Use `WorkbenchPageRoot` for ordinary route-based admin pages that still need runtime services such as `useWorkbenchWindows()` or toasts.
- Use `WorkbenchRuntimeRoot` directly only when building another shell wrapper inside `workbench-kit`.
- Use `WorkbenchCompactPage`, `WorkbenchCardStack`, `WorkbenchFeatureCard`, `WorkbenchCard`, and primitives inside a root. `WorkbenchCompactPage` is a visual layout helper, not a runtime provider.
- Keep product-specific routing, API calls, permissions, and stores in the consuming application.

## Workbench Mobile Areas

`defineWorkbenchView()` uses `primarySidebar` as the default mobile root area. On desktop, the sidebar and `mainArea` remain visible together. On mobile, the sidebar becomes the first-level page and `mainArea` opens as a second-level page with built-in back and browser-history behavior.

When a view has no `primarySidebar`, `mainArea` becomes the first-level mobile page. Mobile page headers are generated from the active view title; statusbar items remain available from the mobile workbench menu. `mobileHeader` is not part of the view contract.

Selections emitted by `WorkbenchListItem` and non-collapsible `TreeNodeShell` instances inside that default root sidebar open `mainArea` automatically. The consuming application still handles the original selection event to update its own state, but it does not need to call `useWorkbenchNavigation().showArea("mainArea")` for ordinary sidebar selections.

Keep explicit navigation calls for programmatic flows such as creating an item, or for non-default targets such as opening `secondarySidebar`. Views that override `layout.mobile.rootArea` do not receive the default `primarySidebar` selection navigation.

`WorkbenchRoot` detects the mobile viewport internally with `matchMedia("(max-width: 767px)")`; do not pass an `isMobile` prop. Applications that need a different policy can register a detector before mounting a workbench root:

```ts
import { watch } from "vue";
import { configureWorkbenchViewportDetector } from "@workbench-kit/vue";

configureWorkbenchViewportDetector({
  isMobile: () => customResponsiveStore.compact,
  subscribe: (listener) => watch(() => customResponsiveStore.compact, listener)
});
```

## Responsive Split Panes

Use `ResponsiveSplitPane` for the common two-pane shape. Its default compact behavior is a tab strip. Control the selected pane when a list selection should reveal its detail pane:

```vue
<script setup lang="ts">
import { ref } from "vue";
import { ResponsiveSplitPane } from "@workbench-kit/vue";

const activePaneId = ref<"primary" | "secondary">("primary");

function selectItem() {
  activePaneId.value = "secondary";
}
</script>

<template>
  <ResponsiveSplitPane
    v-model:active-pane-id="activePaneId"
    primary-title="Items"
    secondary-title="Details"
  >
    <template #primary>...</template>
    <template #secondary>...</template>
  </ResponsiveSplitPane>
</template>
```

Use `ResponsiveSplitPaneGroup` when a screen has more than two panes. Pane ids are stable slot and persistence identities. Higher size priority receives new space earlier and is compressed later; directional priorities can override that default:

```vue
<ResponsiveSplitPaneGroup
  v-model:active-pane-id="activePaneId"
  storage-key="project.workspace"
  :panes="[
    { id: 'files', label: 'Files', defaultSize: 280, minSize: 220, maxSize: 420, sizePriority: 20 },
    { id: 'editor', label: 'Editor', minSize: 360, sizePriority: 100, grow: 1 },
    { id: 'details', label: 'Details', defaultSize: 320, minSize: 240, maxSize: 480, sizePriority: 40 }
  ]"
>
  <template #files>...</template>
  <template #editor>...</template>
  <template #details>...</template>
</ResponsiveSplitPaneGroup>
```

Pane fields:

| Field | Meaning |
| --- | --- |
| `id` | Stable slot, active-pane, and persisted-size identity. It must be unique and non-empty. |
| `label` | Visible compact-tab name and fallback separator name. |
| `title` | Optional tab tooltip and preferred separator name. |
| `tabDisabled` | Prevents this pane from becoming the active compact tab. The pane remains visible in desktop and stacked layouts. |
| `defaultSize` | Initial preferred size in pixels on the normal layout axis. |
| `defaultCompactSize` | Initial preferred size for vertical stacked compact layout; falls back to `defaultSize`. |
| `minSize` / `maxSize` | Hard pane constraints in pixels. |
| `sizePriority` | Shared grow/shrink priority when a directional override is absent. |
| `growPriority` | Higher values receive automatically available space first. |
| `shrinkPriority` | Higher values are protected from automatic compression longer. |
| `grow` | Relative automatic-growth weight among panes with the same priority. `0` disables automatic growth, but does not prevent direct or cascading sash resize. |

Direct sash drags resize adjacent panes first, then cascade within the same side after a pane reaches its minimum or maximum. If pane minimum sizes cannot fit, the group preserves those constraints and provides overflow on the layout axis. If pane maximum sizes consume less than the container, the remaining trailing area stays empty.

Set `compact-mode="stacked"` explicitly when a compact layout should render panes vertically instead of using tabs.

For two-pane layouts, `primary-title` and `secondary-title` provide the visible tab names and separator names. The primary and secondary slots remain available in both compact modes and receive `compact`, `stacked`, and `active` state.

`active-pane-id` supports both controlled `v-model` and uncontrolled `default-active-pane-id` usage. Invalid or `tabDisabled` ids fall back to the first enabled tab. Calling the exposed `activatePane(id)` method follows the same validation.

When `storage-key` is set, preferred horizontal and vertical sizes and the latest user-resize anchors are stored under a versioned `.splitGroup.v1` key. Container compression only affects resolved layout sizes and does not overwrite long-term preferences. A drag anchor keeps the current boundary exact while later expansion restores untouched pane preferences before distributing additional growth. Pane ids therefore need to remain stable across releases; old two-pane storage keys are intentionally not migrated.

### Sash And Pointer Sessions

`WorkbenchSash` is the shared visual and accessible separator primitive. It is absolutely positioned over a layout boundary, does not consume grid/flex space, and requires a complete `value-now`, `value-min`, and `value-max` range. The consumer owns size calculations and keyboard behavior.

`usePointerDrag` and `canStartPointerDrag` are available from both `@workbench-kit/vue` and `@workbench-kit/vue/composables`. The composable owns pointer capture, pointer-id filtering, cancellation, lost capture, blur/unmount cleanup, and an optional global cursor. It intentionally does not own geometry or size constraints.

```ts
import { usePointerDrag } from "@workbench-kit/vue/composables";

const resize = usePointerDrag({
  cursor: "col-resize",
  onMove: ({ deltaX }) => updateLayout(deltaX),
  onEnd: ({ cancelled }) => finishLayout(cancelled)
});
```

## Login Pages

Use `WorkbenchLoginPage` for shared login UI. It is intentionally UI-only: the consuming application owns session checks, password/passkey APIs, redirects, and confirmation dialogs.

```vue
<script setup lang="ts">
import { WorkbenchLoginPage } from "@workbench-kit/vue";

const username = ref("");
const password = ref("");
const pending = ref(false);

async function submitLogin() {
  pending.value = true;
  try {
    // Call the app-owned login API here.
  } finally {
    pending.value = false;
  }
}
</script>

<template>
  <WorkbenchLoginPage
    v-model:password="password"
    v-model:username="username"
    brand-label="Auth Server"
    :pending="pending"
    @submit="submitLogin"
  />
</template>
```

## Dialogs And Windows

`WorkbenchDialog` is the route-page friendly dialog primitive. It preserves a simple `v-model` API and does not require mounting `WorkbenchRoot`.

```vue
<WorkbenchDialog v-model="open" title="Edit item">
  ...
</WorkbenchDialog>
```

For movable or resizable dialogs, mount the page under `WorkbenchPageRoot` or `WorkbenchRoot` and open a runtime dialog:

```ts
import { WorkbenchMultiSelect, useWorkbenchWindows } from "@workbench-kit/vue";

const { openDialog } = useWorkbenchWindows();

const result = await openDialog<{ scopes: string[] }>({
  title: "Edit scopes",
  size: "lg",
  modal: true,
  movable: true,
  resizable: true,
  schema: {
    fields: [
      {
        kind: "custom",
        key: "scopes",
        label: "Scopes",
        defaultValue: currentScopes,
        component: WorkbenchMultiSelect,
        props: { options: allScopes }
      }
    ]
  },
  actions: [{ id: "save", label: "Save", variant: "primary" }]
});
```

When a component block contains a workspace-like layout that should follow a resizable window's height, opt it into the remaining content space explicitly:

```ts
await openDialog({
  title: "Inspect resource",
  size: "xl",
  blocks: [{ kind: "component", component: ResourceInspector, grow: true }]
});
```

Blocks remain content-sized by default, so compact confirmation dialogs are unaffected.

Component blocks can write state into their injected `values` object and let the native window footer derive its action label and disabled state:

```ts
actions: [{
  id: "save",
  label: ({ values }) => values.exists ? "Update" : "Add",
  disabled: ({ values }) => values.valid !== true,
  run: ({ values }) => values.entry
}]
```

`WindowSurface` is the only implementation of window movement, window sizing, maximize, and viewport bounds. Shared pointer-session mechanics live in `usePointerDrag`; do not duplicate window geometry behavior in app wrappers or primitives.

`WorkbenchConfirmDialog` is intentionally backward-compatible with the basic confirm shape:

```vue
<WorkbenchConfirmDialog
  v-model="open"
  title="Please confirm"
  message="Continue?"
  confirm-text="Confirm"
  cancel-text="Cancel"
/>
```

Optional behavior such as auto-confirm countdown should be added through optional props, not by changing the existing confirm contract.

## Theme Templates And Contract

The consuming app owns its final theme values, but it does not need to define every token from scratch. Import a template when the default look is good enough, and override only the variables that differ.

`@workbench-kit/vue/style.css` expects the resolved CSS variables to include surface, border, text, accent, state, scrollbar, font, and workbench sizing tokens. Templates provide those variables. A custom app theme can either replace the template entirely or inherit from it with overrides.

## 按类型切换对象表单

对对象 union 的 `SchemaMeta` 添加可选的 `discriminator`（例如 `"type"`），
并在每个对象分支中为该字段声明不同的 literal 值。`SchemaNode` 会按当前值选中分支，
只渲染该分支适用字段；判别字段由上层下拉框管理，不重复渲染。

切换时通过 `projectSchemaVariant(node, value)` 投影到目标分支：保留适用字段及嵌套清单，
写入目标 literal，移除不适用字段，使用目标 schema 默认值。passthrough 对象保留自定义键。
投影创建新值，不修改原值，也支持 Vue 响应式对象。该函数从 `@workbench-kit/vue` 和
`@workbench-kit/vue-resource-editor` 导出，可用于业务层的预览或测试。

此能力不含供应商、模型、网络或业务目录规则。未提供 `discriminator` 的 union 继续使用原有行为；
旧 SchemaMeta 不需要修改。只读和禁用状态不触发切换，外部值刷新后重新按判别字段选择分支。
